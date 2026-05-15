// ============================================================
// APEx Hub – AI Agent System: Base Agent
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import type {
  AgentContext,
  AgentMessage,
  AgentResponse,
  AgentTool,
  NewMemory,
  StreamChunk,
  SuggestedTask,
} from './types';
import { AgentType } from './types';

const MODEL = 'claude-3-5-sonnet-20241022';
const MAX_TOKENS = 4096;

// ── Helpers ───────────────────────────────────────────────────

/**
 * Extract all fenced ```json ... ``` blocks from a string.
 * Returns an array of parsed objects; invalid JSON blocks are skipped.
 */
function extractJsonBlocks(text: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const regex = /```json\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        results.push(parsed as Record<string, unknown>);
      }
    } catch {
      // silently skip malformed blocks
    }
  }
  return results;
}

function isSuggestedTaskArray(value: unknown): value is SuggestedTask[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as SuggestedTask).title === 'string' &&
      ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes((item as SuggestedTask).priority),
  );
}

function isNewMemoryArray(value: unknown): value is NewMemory[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as NewMemory).content === 'string' &&
      typeof (item as NewMemory).type === 'string',
  );
}

// ── Abstract Base ─────────────────────────────────────────────

export abstract class BaseAgent {
  protected readonly agentType: AgentType;
  protected readonly anthropic: Anthropic;

  constructor(agentType: AgentType, anthropic: Anthropic) {
    this.agentType = agentType;
    this.anthropic = anthropic;
  }

  // ── Abstract interface ──────────────────────────────────────

  abstract getSystemPrompt(ctx: AgentContext): string;
  abstract getTools(): AgentTool[];

  // ── Context injection ───────────────────────────────────────

  /**
   * Serialize memories and relevant docs into a structured context block
   * that is appended to the system prompt.
   */
  injectContext(ctx: AgentContext): string {
    const sections: string[] = [];

    if (ctx.memories.length > 0) {
      const memorySummary = ctx.memories
        .map(
          (m, i) =>
            `  [${i + 1}] (${m.type}, confidence: ${(m.confidence * 100).toFixed(0)}%) ${m.content}` +
            (m.tags.length ? ` [tags: ${m.tags.join(', ')}]` : ''),
        )
        .join('\n');
      sections.push(`## Relevant Memories\n${memorySummary}`);
    }

    if (ctx.documents.length > 0) {
      const docSummary = ctx.documents
        .map(
          (d, i) =>
            `  [DOC-${i + 1}] "${d.name}" (relevance: ${(d.relevance * 100).toFixed(0)}%)\n` +
            `  ${d.content.slice(0, 600)}${d.content.length > 600 ? '…' : ''}`,
        )
        .join('\n\n');
      sections.push(`## Relevant Documents\n${docSummary}`);
    }

    if (ctx.orgSettings && Object.keys(ctx.orgSettings).length > 0) {
      const settings = Object.entries(ctx.orgSettings)
        .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
        .join('\n');
      sections.push(`## Organization Settings\n${settings}`);
    }

    if (sections.length === 0) return '';

    return (
      '\n\n---\n# Retrieved Context\n\n' +
      sections.join('\n\n') +
      '\n\n---\n' +
      'Use the above context to inform your response. Cite documents as [DOC-N] when referencing them.'
    );
  }

  // ── Message building ────────────────────────────────────────

  /**
   * Build the Anthropic messages array from conversation history + the new user message.
   */
  buildMessages(
    ctx: AgentContext,
    userMessage: string,
  ): Anthropic.MessageParam[] {
    const messages: Anthropic.MessageParam[] = [];

    // Include up to the last 20 turns of conversation history
    const history = ctx.conversationHistory.slice(-20);
    for (const msg of history) {
      if (msg.role === 'system') continue; // system messages handled separately
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    // Append the current user turn
    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  // ── Tool schema conversion ──────────────────────────────────

  private buildAnthropicTools(): Anthropic.Tool[] {
    return this.getTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as Anthropic.Tool['input_schema'],
    }));
  }

  // ── Tool dispatch ───────────────────────────────────────────

  private async dispatchTool(
    toolName: string,
    toolInput: Record<string, unknown>,
    ctx: AgentContext,
  ): Promise<unknown> {
    const tool = this.getTools().find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    return tool.execute(toolInput, ctx);
  }

  // ── Parse structured data from response ────────────────────

  private parseResponseBlocks(content: string): {
    structured?: Record<string, unknown>;
    tasks?: SuggestedTask[];
    memories?: NewMemory[];
  } {
    const blocks = extractJsonBlocks(content);
    let structured: Record<string, unknown> | undefined;
    let tasks: SuggestedTask[] | undefined;
    let memories: NewMemory[] | undefined;

    for (const block of blocks) {
      if (isSuggestedTaskArray(block['tasks'])) {
        tasks = block['tasks'] as SuggestedTask[];
      }
      if (isSuggestedTaskArray(block['suggestedTasks'])) {
        tasks = block['suggestedTasks'] as SuggestedTask[];
      }
      if (isNewMemoryArray(block['memories'])) {
        memories = block['memories'] as NewMemory[];
      }
      if (isNewMemoryArray(block['newMemories'])) {
        memories = block['newMemories'] as NewMemory[];
      }
      // Treat any block with neither tasks/memories as the primary structured output
      if (
        !block['tasks'] &&
        !block['suggestedTasks'] &&
        !block['memories'] &&
        !block['newMemories']
      ) {
        structured = block;
      }
    }

    return { structured, tasks, memories };
  }

  // ── Agentic loop (chat) ─────────────────────────────────────

  async chat(userMessage: string, ctx: AgentContext): Promise<AgentResponse> {
    const systemPrompt =
      this.getSystemPrompt(ctx) + this.injectContext(ctx);
    const messages = this.buildMessages(ctx, userMessage);
    const anthropicTools = this.buildAnthropicTools();

    let accumulatedContent = '';
    const currentMessages: Anthropic.MessageParam[] = [...messages];

    // Agentic loop: run until stop_reason is 'end_turn' or 'max_tokens'
    for (let iteration = 0; iteration < 10; iteration++) {
      const response = await this.anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: currentMessages,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      });

      // Accumulate text content
      for (const block of response.content) {
        if (block.type === 'text') {
          accumulatedContent += (accumulatedContent ? '\n' : '') + block.text;
        }
      }

      if (response.stop_reason === 'tool_use') {
        // Execute all tool calls in parallel
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );

        const toolResults = await Promise.all(
          toolUseBlocks.map(async (toolCall) => {
            let result: unknown;
            let isError = false;
            try {
              result = await this.dispatchTool(
                toolCall.name,
                toolCall.input as Record<string, unknown>,
                ctx,
              );
            } catch (err) {
              result = { error: err instanceof Error ? err.message : String(err) };
              isError = true;
            }
            return {
              type: 'tool_result' as const,
              tool_use_id: toolCall.id,
              content: JSON.stringify(result),
              is_error: isError,
            };
          }),
        );

        // Push assistant turn + tool results back into conversation
        currentMessages.push({ role: 'assistant', content: response.content });
        currentMessages.push({ role: 'user', content: toolResults });
        continue;
      }

      // stop_reason is 'end_turn' or 'max_tokens' — we're done
      break;
    }

    const { structured, tasks, memories } = this.parseResponseBlocks(accumulatedContent);

    return {
      content: accumulatedContent,
      structured,
      tasks,
      memories,
    };
  }

  // ── Streaming ───────────────────────────────────────────────

  async *stream(
    userMessage: string,
    ctx: AgentContext,
  ): AsyncGenerator<StreamChunk> {
    const systemPrompt = this.getSystemPrompt(ctx) + this.injectContext(ctx);
    const messages = this.buildMessages(ctx, userMessage);
    const anthropicTools = this.buildAnthropicTools();

    const currentMessages: Anthropic.MessageParam[] = [...messages];
    let continueLoop = true;

    while (continueLoop) {
      let stopReason: string | null = null;
      const assistantContentBlocks: Anthropic.ContentBlock[] = [];
      const pendingToolCalls: Array<{
        id: string;
        name: string;
        inputJson: string;
      }> = [];

      try {
        const stream = await this.anthropic.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          messages: currentMessages,
          tools: anthropicTools.length > 0 ? anthropicTools : undefined,
          stream: true,
        });

        for await (const event of stream) {
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'tool_use') {
              pendingToolCalls.push({
                id: event.content_block.id,
                name: event.content_block.name,
                inputJson: '',
              });
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              yield { type: 'text', content: event.delta.text };
            } else if (event.delta.type === 'input_json_delta') {
              const last = pendingToolCalls[pendingToolCalls.length - 1];
              if (last) {
                last.inputJson += event.delta.partial_json;
              }
            }
          } else if (event.type === 'content_block_stop') {
            // If we just finished a tool_use block, emit it
            const last = pendingToolCalls[pendingToolCalls.length - 1];
            if (last && last.inputJson !== undefined) {
              yield {
                type: 'tool_call',
                content: last.name,
                metadata: { id: last.id, input: last.inputJson },
              };
            }
          } else if (event.type === 'message_delta') {
            stopReason = event.delta.stop_reason ?? null;
          } else if (event.type === 'message_stop') {
            // message_stop signals stream end
          }
        }

        // Handle tool use: execute all pending tool calls and loop back
        if (stopReason === 'tool_use' && pendingToolCalls.length > 0) {
          // 1. Build ToolUseBlock array for the assistant turn
          const toolUseBlocks: Anthropic.ToolUseBlock[] = pendingToolCalls.map((tc) => {
            let parsedInput: Record<string, unknown> = {};
            try {
              parsedInput = JSON.parse(tc.inputJson);
            } catch {
              parsedInput = {};
            }
            return {
              type: 'tool_use' as const,
              id: tc.id,
              name: tc.name,
              input: parsedInput,
            };
          });

          currentMessages.push({ role: 'assistant', content: toolUseBlocks });

          // 2. Execute each tool sequentially so we can yield results inline
          const resolvedResults: Anthropic.ToolResultBlockParam[] = [];

          for (const tc of pendingToolCalls) {
            let parsedInput: Record<string, unknown> = {};
            try {
              parsedInput = JSON.parse(tc.inputJson);
            } catch {
              parsedInput = {};
            }

            let result: unknown;
            let isError = false;
            try {
              result = await this.dispatchTool(tc.name, parsedInput, ctx);
            } catch (err) {
              result = { error: err instanceof Error ? err.message : String(err) };
              isError = true;
            }

            const resultStr = JSON.stringify(result);

            yield {
              type: 'tool_result' as const,
              content: resultStr,
              metadata: { toolName: tc.name, toolId: tc.id, isError },
            };

            resolvedResults.push({
              type: 'tool_result' as const,
              tool_use_id: tc.id,
              content: resultStr,
              is_error: isError,
            });
          }

          currentMessages.push({ role: 'user', content: resolvedResults });
          // Continue the agentic loop
        } else {
          continueLoop = false;
        }
      } catch (err) {
        yield {
          type: 'error',
          content: err instanceof Error ? err.message : 'Unknown streaming error',
        };
        continueLoop = false;
      }

      // Safety valve: assistantContentBlocks tracked but not needed after refactor
      void assistantContentBlocks;
    }

    yield { type: 'done', content: '' };
  }
}
