/**
 * OpenAI client singleton used exclusively for embedding generation.
 * Chat completions are handled by @/lib/ai/anthropic.
 */

import OpenAI from 'openai';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Model that produces 1 536-dimensional vectors. */
const EMBEDDING_MODEL = 'text-embedding-3-small';

/** Maximum number of texts to batch in a single embedding API call. */
const BATCH_SIZE = 100;

// ─── Singleton ────────────────────────────────────────────────────────────────

let _client: OpenAI | null = null;

/**
 * Returns a singleton OpenAI client.
 * Reads OPENAI_API_KEY from the environment.
 */
export function getOpenAIClient(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable is not set. ' +
        'Please add it to your .env.local file.'
    );
  }

  _client = new OpenAI({ apiKey });
  return _client;
}

// ─── Single embedding ─────────────────────────────────────────────────────────

/**
 * Generates a 1 536-dimensional embedding vector for a single text string.
 *
 * @param text The text to embed. Leading/trailing whitespace is trimmed.
 * @returns    Float array of length 1 536.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();
  const normalized = text.trim().replace(/\n/g, ' ');

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: normalized,
      encoding_format: 'float',
    });

    if (!response.data[0]?.embedding) {
      throw new Error('OpenAI returned an empty embedding.');
    }

    return response.data[0].embedding;
  } catch (error: unknown) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(
        `OpenAI embedding error ${error.status}: ${error.message}`
      );
    }
    throw error;
  }
}

// ─── Batch embeddings ─────────────────────────────────────────────────────────

/**
 * Generates embeddings for an array of texts in batches of up to 100.
 * Results are returned in the same order as the input array.
 *
 * @param texts Array of strings to embed.
 * @returns     Array of 1 536-dimensional float vectors (same length as input).
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getOpenAIClient();
  const results: number[][] = new Array(texts.length);

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batchInputs = texts
      .slice(i, i + BATCH_SIZE)
      .map((t) => t.trim().replace(/\n/g, ' '));

    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batchInputs,
        encoding_format: 'float',
      });

      // The API guarantees ordering matches input ordering.
      for (const item of response.data) {
        results[i + item.index] = item.embedding;
      }
    } catch (error: unknown) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(
          `OpenAI batch embedding error ${error.status}: ${error.message} ` +
            `(batch starting at index ${i})`
        );
      }
      throw error;
    }
  }

  return results;
}
