/**
 * Anthropic client singleton and helper utilities.
 * Uses the official @anthropic-ai/sdk package.
 */

import Anthropic from '@anthropic-ai/sdk';

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
export const FAST_MODEL = 'claude-3-haiku-20240307';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompleteOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _client: Anthropic | null = null;

/**
 * Returns a singleton Anthropic client instance.
 * Reads ANTHROPIC_API_KEY from the environment.
 */
export function getAnthropicClient(): Anthropic {
  if (_client) return _client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is not set. ' +
        'Please add it to your .env.local file.'
    );
  }

  _client = new Anthropic({ apiKey });
  return _client;
}

// ─── One-shot completion ──────────────────────────────────────────────────────

/**
 * Sends messages to Claude and returns the full text response.
 *
 * @param messages     Conversation history in role/content format.
 * @param systemPrompt Optional system prompt prepended to the conversation.
 * @param options      Model, token budget, and sampling overrides.
 */
export async function completeWithClaude(
  messages: ClaudeMessage[],
  systemPrompt?: string,
  options: CompleteOptions = {}
): Promise<string> {
  const client = getAnthropicClient();

  const {
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    temperature = 0.7,
    stopSequences,
  } = options;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      ...(stopSequences ? { stop_sequences: stopSequences } : {}),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude returned no text content in the response.');
    }

    return textBlock.text;
  } catch (error: unknown) {
    if (error instanceof Anthropic.APIError) {
      throw new Error(
        `Anthropic API error ${error.status}: ${error.message}`
      );
    }
    throw error;
  }
}

// ─── Streaming completion ─────────────────────────────────────────────────────

/**
 * Streams a Claude response, invoking `onChunk` for each text delta.
 * Also yields each chunk so callers can consume it as an AsyncGenerator.
 *
 * @param messages     Conversation history.
 * @param systemPrompt Optional system prompt.
 * @param onChunk      Callback invoked with each text chunk as it arrives.
 * @param options      Model and token budget overrides.
 */
export async function* streamWithClaude(
  messages: ClaudeMessage[],
  systemPrompt?: string,
  onChunk?: (chunk: string) => void,
  options: CompleteOptions = {}
): AsyncGenerator<string, void, unknown> {
  const client = getAnthropicClient();

  const {
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    temperature = 0.7,
    stopSequences,
  } = options;

  try {
    const stream = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      stream: true,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      ...(stopSequences ? { stop_sequences: stopSequences } : {}),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        const text = event.delta.text;
        if (onChunk) onChunk(text);
        yield text;
      }
    }
  } catch (error: unknown) {
    if (error instanceof Anthropic.APIError) {
      throw new Error(
        `Anthropic streaming error ${error.status}: ${error.message}`
      );
    }
    throw error;
  }
}
