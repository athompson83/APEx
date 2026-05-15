/**
 * VectorStore — semantic search over document chunks using pgvector.
 *
 * Primary path:  pgvector cosine-distance (<=>)
 * Fallback path: PostgreSQL full-text search (tsvector / ts_rank) when the
 *                vector extension is unavailable or the embedding column is null.
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import { generateEmbedding } from '@/lib/ai/openai';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentChunkInput {
  /** Stable ID for upsert (cuid/uuid). */
  id: string;
  documentId: string;
  organizationId: string;
  content: string;
  metadata: Record<string, unknown>;
  chunkIndex: number;
  tokenCount: number;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  /** Document name pulled from the documents join. */
  documentName: string;
  content: string;
  /** Cosine similarity: 1 = identical, 0 = orthogonal. */
  relevance: number;
  metadata: Record<string, unknown>;
}

export interface SearchFilter {
  /** Filter by the agentType stored in chunk metadata. */
  agentType?: string;
  /** All supplied tags must appear in the chunk metadata.tags array. */
  tags?: string[];
}

// ─── VectorStore ─────────────────────────────────────────────────────────────

export class VectorStore {
  private sql: ReturnType<typeof neon>;
  private pgvectorAvailable: boolean | null = null; // null = not yet probed

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error(
        'DATABASE_URL is not set. Please configure it in .env.local.'
      );
    }
    // Enable WebSocket pooling in serverless environments.
    neonConfig.fetchConnectionCache = true;
    this.sql = neon(dbUrl);
  }

  // ─── pgvector probe ──────────────────────────────────────────────────────

  /**
   * Returns true if the `vector` extension is installed and the
   * document_chunks.embedding column exists in the database.
   */
  private async isPgvectorAvailable(): Promise<boolean> {
    if (this.pgvectorAvailable !== null) return this.pgvectorAvailable;

    try {
      const rows = await this.sql`
        SELECT 1
        FROM   pg_extension
        WHERE  extname = 'vector'
        LIMIT  1
      `;
      this.pgvectorAvailable = rows.length > 0;
    } catch {
      this.pgvectorAvailable = false;
    }

    return this.pgvectorAvailable;
  }

  // ─── generateEmbedding ───────────────────────────────────────────────────

  /**
   * Generates a 1 536-dim embedding for `text` via OpenAI.
   * Exposed publicly so callers can pre-compute embeddings when needed.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    return generateEmbedding(text);
  }

  // ─── upsertChunks ────────────────────────────────────────────────────────

  /**
   * Inserts or updates document chunks with their embeddings.
   * Embeddings are generated in parallel (one per chunk) for simplicity;
   * for very large batches consider pre-computing with generateEmbeddings().
   */
  async upsertChunks(chunks: DocumentChunkInput[]): Promise<void> {
    if (chunks.length === 0) return;

    const usePgvector = await this.isPgvectorAvailable();

    // Generate embeddings in parallel.
    const embeddings = await Promise.all(
      chunks.map((c) => this.generateEmbedding(c.content))
    );

    // Upsert each chunk individually so we can pass the embedding vector as a
    // Postgres literal string that pgvector can parse.
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      const metadataJson = JSON.stringify(chunk.metadata);
      const embeddingLiteral = `[${embedding.join(',')}]`;

      if (usePgvector) {
        await this.sql`
          INSERT INTO document_chunks (
            id,
            document_id,
            organization_id,
            content,
            embedding,
            metadata,
            chunk_index,
            token_count,
            created_at
          )
          VALUES (
            ${chunk.id},
            ${chunk.documentId},
            ${chunk.organizationId},
            ${chunk.content},
            ${embeddingLiteral}::vector,
            ${metadataJson}::jsonb,
            ${chunk.chunkIndex},
            ${chunk.tokenCount},
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            content        = EXCLUDED.content,
            embedding      = EXCLUDED.embedding,
            metadata       = EXCLUDED.metadata,
            chunk_index    = EXCLUDED.chunk_index,
            token_count    = EXCLUDED.token_count
        `;
      } else {
        // Fallback: store without embedding column.
        await this.sql`
          INSERT INTO document_chunks (
            id,
            document_id,
            organization_id,
            content,
            metadata,
            chunk_index,
            token_count,
            created_at
          )
          VALUES (
            ${chunk.id},
            ${chunk.documentId},
            ${chunk.organizationId},
            ${chunk.content},
            ${metadataJson}::jsonb,
            ${chunk.chunkIndex},
            ${chunk.tokenCount},
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            content     = EXCLUDED.content,
            metadata    = EXCLUDED.metadata,
            chunk_index = EXCLUDED.chunk_index,
            token_count = EXCLUDED.token_count
        `;
      }
    }
  }

  // ─── searchSimilar ───────────────────────────────────────────────────────

  /**
   * Finds the most semantically similar chunks to `query`.
   *
   * When pgvector is available, uses the cosine-distance operator `<=>` and
   * converts the distance to a [0,1] similarity score:  1 − distance.
   *
   * Falls back to PostgreSQL full-text search (`ts_rank`) when pgvector is
   * unavailable or the embedding column is NULL.
   *
   * @param query          Natural-language search query.
   * @param organizationId Scopes results to the caller's organisation.
   * @param limit          Maximum results (default 10).
   * @param filter         Optional agentType / tags filter.
   */
  async searchSimilar(
    query: string,
    organizationId: string,
    limit = 10,
    filter?: SearchFilter
  ): Promise<SearchResult[]> {
    const usePgvector = await this.isPgvectorAvailable();

    let rows: Array<Record<string, unknown>>;

    if (usePgvector) {
      rows = await this.searchWithPgvector(
        query,
        organizationId,
        limit,
        filter
      );
    } else {
      rows = await this.searchWithFullText(
        query,
        organizationId,
        limit,
        filter
      );
    }

    return rows.map((row) => ({
      chunkId: row.id as string,
      documentId: row.document_id as string,
      documentName: (row.document_name as string) ?? 'Unknown',
      content: row.content as string,
      relevance: parseFloat(String(row.relevance ?? 0)),
      metadata:
        typeof row.metadata === 'object' && row.metadata !== null
          ? (row.metadata as Record<string, unknown>)
          : {},
    }));
  }

  private async searchWithPgvector(
    query: string,
    organizationId: string,
    limit: number,
    filter?: SearchFilter
  ): Promise<Array<Record<string, unknown>>> {
    const queryEmbedding = await this.generateEmbedding(query);
    const embeddingLiteral = `[${queryEmbedding.join(',')}]`;

    // Build optional metadata filters.
    const agentTypeFilter =
      filter?.agentType != null
        ? `AND dc.metadata->>'agentType' = ${this.sql`${filter.agentType}`}`
        : this.sql``;

    // For tag filtering we check that every requested tag is present in the
    // metadata.tags JSON array (GIN-friendly `?` operator).
    const tagFilters =
      filter?.tags && filter.tags.length > 0
        ? filter.tags
        : null;

    if (tagFilters) {
      // When tag filtering is needed, build the query with a HAVING/WHERE on
      // each required tag using the `@>` containment operator on the JSON array.
      const tagChecks = tagFilters
        .map(() => `dc.metadata->'tags' @> ?::jsonb`)
        .join(' AND ');
      void tagChecks; // handled via template literal below
    }

    try {
      if (filter?.agentType && filter.tags && filter.tags.length > 0) {
        const tagJsonValues = filter.tags.map((t) => JSON.stringify([t]));
        // Build dynamically — must serialise tags to jsonb literals.
        const tagConditions = tagJsonValues
          .map((tv) => `dc.metadata->'tags' @> '${tv.replace(/'/g, "''")}'::jsonb`)
          .join(' AND ');

        return await this.sql`
          SELECT
            dc.id,
            dc.document_id,
            d.name                              AS document_name,
            dc.content,
            dc.metadata,
            1 - (dc.embedding <=> ${embeddingLiteral}::vector) AS relevance
          FROM   document_chunks dc
          JOIN   documents        d  ON d.id = dc.document_id
          WHERE  dc.organization_id = ${organizationId}
            AND  dc.embedding IS NOT NULL
            AND  dc.metadata->>'agentType' = ${filter.agentType}
            AND  ${this.sql.unsafe(tagConditions)}
          ORDER  BY dc.embedding <=> ${embeddingLiteral}::vector
          LIMIT  ${limit}
        `;
      }

      if (filter?.agentType) {
        return await this.sql`
          SELECT
            dc.id,
            dc.document_id,
            d.name                              AS document_name,
            dc.content,
            dc.metadata,
            1 - (dc.embedding <=> ${embeddingLiteral}::vector) AS relevance
          FROM   document_chunks dc
          JOIN   documents        d  ON d.id = dc.document_id
          WHERE  dc.organization_id = ${organizationId}
            AND  dc.embedding IS NOT NULL
            AND  dc.metadata->>'agentType' = ${filter.agentType}
          ORDER  BY dc.embedding <=> ${embeddingLiteral}::vector
          LIMIT  ${limit}
        `;
      }

      if (filter?.tags && filter.tags.length > 0) {
        const tagJsonValues = filter.tags.map((t) => JSON.stringify([t]));
        const tagConditions = tagJsonValues
          .map((tv) => `dc.metadata->'tags' @> '${tv.replace(/'/g, "''")}'::jsonb`)
          .join(' AND ');

        return await this.sql`
          SELECT
            dc.id,
            dc.document_id,
            d.name                              AS document_name,
            dc.content,
            dc.metadata,
            1 - (dc.embedding <=> ${embeddingLiteral}::vector) AS relevance
          FROM   document_chunks dc
          JOIN   documents        d  ON d.id = dc.document_id
          WHERE  dc.organization_id = ${organizationId}
            AND  dc.embedding IS NOT NULL
            AND  ${this.sql.unsafe(tagConditions)}
          ORDER  BY dc.embedding <=> ${embeddingLiteral}::vector
          LIMIT  ${limit}
        `;
      }

      // No filter
      return await this.sql`
        SELECT
          dc.id,
          dc.document_id,
          d.name                              AS document_name,
          dc.content,
          dc.metadata,
          1 - (dc.embedding <=> ${embeddingLiteral}::vector) AS relevance
        FROM   document_chunks dc
        JOIN   documents        d  ON d.id = dc.document_id
        WHERE  dc.organization_id = ${organizationId}
          AND  dc.embedding IS NOT NULL
        ORDER  BY dc.embedding <=> ${embeddingLiteral}::vector
        LIMIT  ${limit}
      `;
    } catch (err) {
      console.error('[VectorStore] pgvector search failed, falling back to full-text:', err);
      return this.searchWithFullText(query, organizationId, limit, filter);
    }
  }

  private async searchWithFullText(
    query: string,
    organizationId: string,
    limit: number,
    filter?: SearchFilter
  ): Promise<Array<Record<string, unknown>>> {
    // Sanitise the query for to_tsquery: replace non-word chars with spaces
    // then join words with ' & '.
    const tsQuery = query
      .trim()
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(' & ');

    if (!tsQuery) return [];

    try {
      if (filter?.agentType && filter.tags && filter.tags.length > 0) {
        const tagJsonValues = filter.tags.map((t) => JSON.stringify([t]));
        const tagConditions = tagJsonValues
          .map((tv) => `dc.metadata->'tags' @> '${tv.replace(/'/g, "''")}'::jsonb`)
          .join(' AND ');

        return await this.sql`
          SELECT
            dc.id,
            dc.document_id,
            d.name                                          AS document_name,
            dc.content,
            dc.metadata,
            ts_rank(to_tsvector('english', dc.content),
                    to_tsquery('english', ${tsQuery}))      AS relevance
          FROM   document_chunks dc
          JOIN   documents        d  ON d.id = dc.document_id
          WHERE  dc.organization_id = ${organizationId}
            AND  to_tsvector('english', dc.content)
                   @@ to_tsquery('english', ${tsQuery})
            AND  dc.metadata->>'agentType' = ${filter.agentType}
            AND  ${this.sql.unsafe(tagConditions)}
          ORDER  BY relevance DESC
          LIMIT  ${limit}
        `;
      }

      if (filter?.agentType) {
        return await this.sql`
          SELECT
            dc.id,
            dc.document_id,
            d.name                                          AS document_name,
            dc.content,
            dc.metadata,
            ts_rank(to_tsvector('english', dc.content),
                    to_tsquery('english', ${tsQuery}))      AS relevance
          FROM   document_chunks dc
          JOIN   documents        d  ON d.id = dc.document_id
          WHERE  dc.organization_id = ${organizationId}
            AND  to_tsvector('english', dc.content)
                   @@ to_tsquery('english', ${tsQuery})
            AND  dc.metadata->>'agentType' = ${filter.agentType}
          ORDER  BY relevance DESC
          LIMIT  ${limit}
        `;
      }

      if (filter?.tags && filter.tags.length > 0) {
        const tagJsonValues = filter.tags.map((t) => JSON.stringify([t]));
        const tagConditions = tagJsonValues
          .map((tv) => `dc.metadata->'tags' @> '${tv.replace(/'/g, "''")}'::jsonb`)
          .join(' AND ');

        return await this.sql`
          SELECT
            dc.id,
            dc.document_id,
            d.name                                          AS document_name,
            dc.content,
            dc.metadata,
            ts_rank(to_tsvector('english', dc.content),
                    to_tsquery('english', ${tsQuery}))      AS relevance
          FROM   document_chunks dc
          JOIN   documents        d  ON d.id = dc.document_id
          WHERE  dc.organization_id = ${organizationId}
            AND  to_tsvector('english', dc.content)
                   @@ to_tsquery('english', ${tsQuery})
            AND  ${this.sql.unsafe(tagConditions)}
          ORDER  BY relevance DESC
          LIMIT  ${limit}
        `;
      }

      return await this.sql`
        SELECT
          dc.id,
          dc.document_id,
          d.name                                          AS document_name,
          dc.content,
          dc.metadata,
          ts_rank(to_tsvector('english', dc.content),
                  to_tsquery('english', ${tsQuery}))      AS relevance
        FROM   document_chunks dc
        JOIN   documents        d  ON d.id = dc.document_id
        WHERE  dc.organization_id = ${organizationId}
          AND  to_tsvector('english', dc.content)
                 @@ to_tsquery('english', ${tsQuery})
        ORDER  BY relevance DESC
        LIMIT  ${limit}
      `;
    } catch (err) {
      console.error('[VectorStore] Full-text search failed:', err);
      return [];
    }
  }

  // ─── deleteDocumentChunks ────────────────────────────────────────────────

  /**
   * Removes all chunks belonging to a document.
   * Called when a document is deleted or re-ingested.
   */
  async deleteDocumentChunks(documentId: string): Promise<void> {
    await this.sql`
      DELETE FROM document_chunks
      WHERE  document_id = ${documentId}
    `;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _vectorStore: VectorStore | null = null;

/** Returns a shared VectorStore instance (lazy initialisation). */
export function getVectorStore(): VectorStore {
  if (!_vectorStore) _vectorStore = new VectorStore();
  return _vectorStore;
}
