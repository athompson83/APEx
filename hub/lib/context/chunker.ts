/**
 * Text chunking utilities for document ingestion.
 *
 * Tokens are estimated at 4 characters each (OpenAI rule of thumb).
 * Splitting respects paragraph → sentence boundaries so chunks are
 * always semantically coherent.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentMetadata {
  /** H1-level headings detected in the content. */
  headings: string[];
  /** Named entities extracted (simple heuristic). */
  entities: string[];
  /** ISO-8601 date strings found in the text. */
  dates: string[];
  /** Source file name. */
  fileName: string;
  /** Approximate word count. */
  wordCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHARS_PER_TOKEN = 4;

// ─── Token estimation ─────────────────────────────────────────────────────────

/**
 * Fast, approximate token count using the 4-chars-per-token heuristic.
 * Accurate to within ~10 % for English prose.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ─── Sentence splitting ───────────────────────────────────────────────────────

/**
 * Splits text into sentences on `.`, `!`, `?`, or `\n` boundaries while
 * preserving the terminator so sentences are readable on their own.
 */
function splitIntoSentences(text: string): string[] {
  // Match sentence-ending punctuation followed by whitespace or end-of-string.
  const raw = text.split(/(?<=[.!?])\s+|(?<=\n)\n+/);
  return raw.map((s) => s.trim()).filter(Boolean);
}

// ─── Core chunk splitter ──────────────────────────────────────────────────────

/**
 * Splits `text` into overlapping chunks that fit within `maxTokens`.
 *
 * Algorithm:
 * 1. Split on double-newlines (paragraph boundaries) first.
 * 2. If a paragraph still exceeds `maxTokens`, split it into sentences.
 * 3. Pack sentences into a sliding window with `overlap` token look-back.
 *
 * @param text      Source text.
 * @param maxTokens Maximum tokens per chunk (default 512).
 * @param overlap   Token overlap between consecutive chunks (default 100).
 * @returns         Array of chunk strings.
 */
export function splitIntoChunks(
  text: string,
  maxTokens = 512,
  overlap = 100
): string[] {
  if (!text || text.trim().length === 0) return [];

  const chunks: string[] = [];

  // ── Step 1: split into paragraphs ────────────────────────────────────────
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Collect all "units" (sentences or short paragraphs) we'll pack.
  const units: string[] = [];
  for (const para of paragraphs) {
    if (estimateTokens(para) <= maxTokens) {
      units.push(para);
    } else {
      // ── Step 2: paragraph too big → split into sentences ──────────────
      units.push(...splitIntoSentences(para));
    }
  }

  // ── Step 3: sliding-window packing ───────────────────────────────────────
  let currentTokens = 0;
  let currentUnits: string[] = [];

  const flushChunk = () => {
    if (currentUnits.length === 0) return;
    chunks.push(currentUnits.join(' '));

    // Roll back `overlap` tokens worth of units for the next chunk.
    let rolledBack = 0;
    const keepUnits: string[] = [];
    for (let i = currentUnits.length - 1; i >= 0; i--) {
      const unitTokens = estimateTokens(currentUnits[i]);
      if (rolledBack + unitTokens > overlap) break;
      keepUnits.unshift(currentUnits[i]);
      rolledBack += unitTokens;
    }

    currentUnits = keepUnits;
    currentTokens = keepUnits.reduce((s, u) => s + estimateTokens(u), 0);
  };

  for (const unit of units) {
    const unitTokens = estimateTokens(unit);

    // A single unit that is already over budget must go alone.
    if (unitTokens >= maxTokens) {
      flushChunk();
      chunks.push(unit);
      currentUnits = [];
      currentTokens = 0;
      continue;
    }

    if (currentTokens + unitTokens > maxTokens) {
      flushChunk();
    }

    currentUnits.push(unit);
    currentTokens += unitTokens;
  }

  // Flush whatever remains.
  flushChunk();

  return chunks.filter((c) => c.trim().length > 0);
}

// ─── Metadata extraction ──────────────────────────────────────────────────────

/** Markdown heading pattern: `# Title` */
const HEADING_RE = /^#{1,3}\s+(.+)$/m;

/**
 * ISO-8601 dates and common human-readable date patterns.
 * Covers: 2024-01-15, Jan 15 2024, January 15, 2024, 01/15/2024
 */
const DATE_RE =
  /\b(\d{4}-\d{2}-\d{2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})\b/gi;

/**
 * Capitalised multi-word phrases that are likely named entities.
 * Simple heuristic: two or more consecutive capitalised words.
 */
const ENTITY_RE = /\b([A-Z][a-z]+(?: [A-Z][a-z]+)+)\b/g;

/**
 * Extracts structural metadata from document content.
 *
 * @param content  Full document text (plain text or Markdown).
 * @param fileName Original file name, stored for provenance.
 * @returns        DocumentMetadata object.
 */
export function extractMetadata(
  content: string,
  fileName: string
): DocumentMetadata {
  // Headings — collect all markdown H1-H3 lines.
  const headings: string[] = [];
  const headingGlobal = /^#{1,3}\s+(.+)$/gm;
  let hMatch: RegExpExecArray | null;
  while ((hMatch = headingGlobal.exec(content)) !== null) {
    headings.push(hMatch[1].trim());
  }

  // Fallback: first ALL-CAPS or title-cased line if no markdown headings found.
  if (headings.length === 0) {
    const firstHeading = HEADING_RE.exec(content);
    if (firstHeading) headings.push(firstHeading[1].trim());
  }

  // Dates.
  const rawDates = content.match(DATE_RE) ?? [];
  const dates = [...new Set(rawDates)];

  // Named entities — deduplicated and capped at 20.
  const rawEntities: string[] = [];
  let eMatch: RegExpExecArray | null;
  const entityRegex = new RegExp(ENTITY_RE.source, 'g');
  while ((eMatch = entityRegex.exec(content)) !== null) {
    rawEntities.push(eMatch[1]);
  }
  const entities = [...new Set(rawEntities)].slice(0, 20);

  const wordCount = content
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return { headings, entities, dates, fileName, wordCount };
}
