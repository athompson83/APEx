/**
 * DocumentIngestion — full pipeline for ingesting files and URLs into the
 * knowledge base.
 *
 * Pipeline:
 *   1. Create a Document record (status = PROCESSING)
 *   2. Extract plain text from the buffer / URL
 *   3. Generate a short summary via Claude
 *   4. Chunk the text
 *   5. Store chunks + embeddings via VectorStore
 *   6. Update Document record (status = READY, chunkCount, summary)
 *
 * Supported MIME types:
 *   application/pdf        → pdf-parse
 *   application/vnd.openxmlformats-officedocument.wordprocessingml.document
 *   application/msword     → mammoth
 *   text/csv               → csv-parse
 *   application/json       → JSON.stringify (pretty)
 *   text/plain, text/markdown, text/x-markdown → direct string
 */

import { PrismaClient, DocumentStatus, DocumentType } from '@prisma/client';
import { getVectorStore, DocumentChunkInput } from '@/lib/memory/vector-store';
import { splitIntoChunks, estimateTokens, extractMetadata } from '@/lib/context/chunker';
import { completeWithClaude, FAST_MODEL } from '@/lib/ai/anthropic';

// ─── ID generation ────────────────────────────────────────────────────────────
// Uses the built-in crypto.randomUUID() available in Node 14.17+ and all
// modern browsers.  The hyphens are stripped so IDs look like Prisma cuid()s.
function createId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChunkInput {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  metadata: Record<string, unknown>;
}

// Matches the Prisma Document model shape used externally.
export type Document = {
  id: string;
  organizationId: string;
  knowledgeBaseId: string | null;
  userId: string;
  name: string;
  type: DocumentType;
  mimeType: string | null;
  size: number | null;
  storageKey: string;
  content: string | null;
  summary: string | null;
  status: DocumentStatus;
  metadata: Record<string, unknown>;
  tags: string[];
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
};

// ─── MIME → DocumentType mapping ──────────────────────────────────────────────

function mimeToDocumentType(mimeType: string): DocumentType {
  const m = mimeType.toLowerCase();
  if (m === 'application/pdf') return DocumentType.PDF;
  if (
    m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    m === 'application/msword'
  )
    return DocumentType.DOCX;
  if (m === 'text/csv' || m === 'application/csv') return DocumentType.CSV;
  if (m === 'application/json') return DocumentType.JSON;
  if (m === 'text/markdown' || m === 'text/x-markdown') return DocumentType.MARKDOWN;
  if (m === 'text/plain') return DocumentType.TXT;
  return DocumentType.TXT;
}

// ─── Prisma singleton ─────────────────────────────────────────────────────────

let _prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

// ─── DocumentIngestion ────────────────────────────────────────────────────────

export class DocumentIngestion {
  private prisma: PrismaClient;
  private vectorStore = getVectorStore();

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? getPrisma();
  }

  // ─── ingestDocument ────────────────────────────────────────────────────────

  /**
   * Full ingestion pipeline for an in-memory file buffer.
   *
   * @param file     Raw file bytes.
   * @param fileName Original file name (used for display and type detection).
   * @param mimeType IANA media type string.
   * @param orgId    Owning organisation.
   * @param userId   Uploader user ID.
   * @param kbId     Optional knowledge base to assign the document to.
   */
  async ingestDocument(
    file: Buffer,
    fileName: string,
    mimeType: string,
    orgId: string,
    userId: string,
    kbId?: string
  ): Promise<Document> {
    const docType = mimeToDocumentType(mimeType);
    const storageKey = `${orgId}/${createId()}-${fileName}`;

    // 1. Create document record in PROCESSING state.
    const dbDoc = await this.prisma.document.create({
      data: {
        organizationId: orgId,
        knowledgeBaseId: kbId ?? null,
        userId,
        name: fileName,
        type: docType,
        mimeType,
        size: file.length,
        storageKey,
        status: DocumentStatus.PROCESSING,
        metadata: {},
        tags: [],
        chunkCount: 0,
      },
    });

    try {
      // 2. Extract text.
      const text = await this.extractText(file, mimeType);

      // 3. Generate summary.
      const summary = await this.generateSummary(text, fileName);

      // 4. Extract document-level metadata.
      const docMeta = extractMetadata(text, fileName);

      // 5. Chunk.
      const chunks = await this.chunkText(text, dbDoc.id, orgId);

      // 6. Store chunks in vector store.
      const chunkInputs: DocumentChunkInput[] = chunks.map((c) => ({
        id: createId(),
        documentId: dbDoc.id,
        organizationId: orgId,
        content: c.content,
        metadata: {
          ...c.metadata,
          fileName,
          documentType: docType,
          headings: docMeta.headings,
          entities: docMeta.entities,
        },
        chunkIndex: c.chunkIndex,
        tokenCount: c.tokenCount,
      }));

      await this.vectorStore.upsertChunks(chunkInputs);

      // 7. Update document to READY.
      const updated = await this.prisma.document.update({
        where: { id: dbDoc.id },
        data: {
          status: DocumentStatus.READY,
          summary,
          // Store first 50 000 chars of plain text for reference.
          content: text.slice(0, 50_000),
          chunkCount: chunks.length,
          metadata: {
            wordCount: docMeta.wordCount,
            headings: docMeta.headings,
            entities: docMeta.entities.slice(0, 10),
            dates: docMeta.dates.slice(0, 10),
          },
        },
      });

      return this.prismaDocToDocument(updated);
    } catch (err) {
      // Mark as FAILED so the user can retry.
      await this.prisma.document.update({
        where: { id: dbDoc.id },
        data: {
          status: DocumentStatus.FAILED,
          metadata: {
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        },
      });
      throw new Error(
        `Document ingestion failed for "${fileName}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ─── extractText ───────────────────────────────────────────────────────────

  /**
   * Extracts plain text from a buffer according to its MIME type.
   * Returns an empty string if extraction produces nothing.
   */
  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    const m = mimeType.toLowerCase();

    // PDF
    if (m === 'application/pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      const result = await pdfParse(buffer);
      return result.text ?? '';
    }

    // DOCX / DOC
    if (
      m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      m === 'application/msword'
    ) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value ?? '';
    }

    // CSV
    if (m === 'text/csv' || m === 'application/csv') {
      const { parse } = await import('csv-parse/sync');
      const records: string[][] = parse(buffer, {
        skip_empty_lines: true,
        trim: true,
      }) as string[][];

      if (records.length === 0) return '';

      const headers = records[0];
      const rows = records.slice(1);

      // Convert to a human-readable tabular format.
      const lines = rows.map((row) =>
        headers
          .map((h, i) => `${h}: ${row[i] ?? ''}`)
          .join(', ')
      );
      return `${headers.join(', ')}\n\n${lines.join('\n')}`;
    }

    // JSON
    if (m === 'application/json') {
      const str = buffer.toString('utf-8');
      try {
        const parsed: unknown = JSON.parse(str);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return str;
      }
    }

    // Markdown / plain text — direct string
    return buffer.toString('utf-8');
  }

  // ─── chunkText ─────────────────────────────────────────────────────────────

  /**
   * Splits extracted text into ~512-token chunks with 100-token overlap.
   * Attaches per-chunk metadata including position context.
   */
  async chunkText(
    text: string,
    docId: string,
    orgId: string
  ): Promise<ChunkInput[]> {
    const rawChunks = splitIntoChunks(text, 512, 100);

    return rawChunks.map((content, index) => ({
      content,
      chunkIndex: index,
      tokenCount: estimateTokens(content),
      metadata: {
        documentId: docId,
        organizationId: orgId,
        chunkIndex: index,
        totalChunks: rawChunks.length,
        // Position hint: beginning / middle / end
        position:
          index === 0
            ? 'beginning'
            : index === rawChunks.length - 1
            ? 'end'
            : 'middle',
      },
    }));
  }

  // ─── generateSummary ───────────────────────────────────────────────────────

  /**
   * Uses Claude (Haiku) to generate a concise 2-3 sentence summary of the
   * document. Falls back to a truncated excerpt if Claude is unavailable.
   */
  async generateSummary(text: string, fileName: string): Promise<string> {
    // Use first ~4 000 tokens (≈16 000 chars) for the summary prompt.
    const excerpt = text.slice(0, 16_000);
    if (!excerpt.trim()) return `Document: ${fileName} (no readable content extracted)`;

    try {
      return await completeWithClaude(
        [
          {
            role: 'user',
            content:
              `Summarise the following document in 2-3 concise sentences. ` +
              `Focus on the main topic, key points, and purpose.\n\n` +
              `File: ${fileName}\n\nContent:\n${excerpt}`,
          },
        ],
        'You are a precise document summarisation assistant. Return only the summary, no preamble.',
        { model: FAST_MODEL, maxTokens: 256, temperature: 0.3 }
      );
    } catch (err) {
      console.warn('[DocumentIngestion] Summary generation failed:', err);
      // Graceful fallback: use first 300 chars of text.
      return text.slice(0, 300).trim() + (text.length > 300 ? '…' : '');
    }
  }

  // ─── processUrl ────────────────────────────────────────────────────────────

  /**
   * Fetches a URL, extracts its text content, and ingests it as a document.
   * HTML is converted to plain text by stripping tags.
   *
   * @param url    Fully-qualified URL (http/https).
   * @param orgId  Owning organisation.
   * @param userId Uploader user ID.
   * @param kbId   Optional knowledge base ID.
   */
  async processUrl(
    url: string,
    orgId: string,
    userId: string,
    kbId?: string
  ): Promise<Document> {
    // Validate URL format.
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`Invalid URL: "${url}"`);
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Unsupported URL protocol: "${parsedUrl.protocol}"`);
    }

    // Fetch the URL content.
    let responseBuffer: Buffer;
    let contentType = 'text/plain';

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'APEx-Hub-Ingestion/1.0' },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      contentType = res.headers.get('content-type') ?? 'text/plain';
      // Strip charset suffix: "text/html; charset=utf-8" → "text/html"
      contentType = contentType.split(';')[0].trim();

      const arrayBuffer = await res.arrayBuffer();
      responseBuffer = Buffer.from(arrayBuffer);
    } catch (err) {
      throw new Error(
        `Failed to fetch URL "${url}": ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // For HTML, strip tags to get plain text.
    if (contentType === 'text/html') {
      const html = responseBuffer.toString('utf-8');
      const plainText = this.htmlToPlainText(html);
      responseBuffer = Buffer.from(plainText, 'utf-8');
      contentType = 'text/plain';
    }

    const fileName = parsedUrl.hostname + parsedUrl.pathname.replace(/\/$/, '') || parsedUrl.hostname;

    return this.ingestDocument(responseBuffer, fileName, contentType, orgId, userId, kbId);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private htmlToPlainText(html: string): string {
    return html
      // Remove <script> and <style> blocks entirely.
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      // Replace block-level elements with newlines.
      .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|article|section)>/gi, '\n')
      // Strip remaining HTML tags.
      .replace(/<[^>]+>/g, ' ')
      // Decode common HTML entities.
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // Collapse whitespace.
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private prismaDocToDocument(
    row: Awaited<ReturnType<PrismaClient['document']['create']>>
  ): Document {
    return {
      id: row.id,
      organizationId: row.organizationId,
      knowledgeBaseId: row.knowledgeBaseId,
      userId: row.userId,
      name: row.name,
      type: row.type,
      mimeType: row.mimeType,
      size: row.size,
      storageKey: row.storageKey,
      content: row.content,
      summary: row.summary,
      status: row.status,
      metadata:
        typeof row.metadata === 'object' && row.metadata !== null
          ? (row.metadata as Record<string, unknown>)
          : {},
      tags: row.tags,
      chunkCount: row.chunkCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _ingestion: DocumentIngestion | null = null;

export function getDocumentIngestion(): DocumentIngestion {
  if (!_ingestion) _ingestion = new DocumentIngestion();
  return _ingestion;
}
