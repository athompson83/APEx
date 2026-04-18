/**
 * offlineQueue.ts
 * Offline mutation queue — persists pending API writes to AsyncStorage
 * and flushes them when network connectivity is restored.
 *
 * The queue stores serialized mutations and processes them FIFO.
 * Conflicts are handled by retrying with exponential backoff up to
 * a configurable max retry count, after which the mutation is discarded
 * and an error is logged.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';
import type { QueuedMutation, HttpMethod } from '../types/index';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUEUE_STORAGE_KEY = '@apex_offline_queue';
const DEFAULT_MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

// ─── Queue Storage ────────────────────────────────────────────────────────────

/**
 * Reads the full mutation queue from AsyncStorage.
 * Returns an empty array if nothing is stored or parsing fails.
 */
async function readQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedMutation[];
  } catch {
    return [];
  }
}

/**
 * Persists the mutation queue to AsyncStorage.
 */
async function writeQueue(queue: QueuedMutation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[APEx:OfflineQueue] Failed to persist queue:', err);
  }
}

// ─── ID Generation ────────────────────────────────────────────────────────────

/**
 * Generates a unique ID for a queued mutation.
 * Uses timestamp + random suffix — no UUID library required.
 */
function generateMutationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Adds a mutation to the offline queue.
 *
 * The mutation will be executed when flushQueue() is called (typically
 * triggered by a network reconnect event). Mutations are stored durably
 * in AsyncStorage so they survive app restarts.
 */
export async function enqueue(
  mutation: Omit<QueuedMutation, 'id' | 'enqueuedAt' | 'retryCount'> & {
    maxRetries?: number;
  },
): Promise<string> {
  const queue = await readQueue();

  const queuedMutation: QueuedMutation = {
    id: generateMutationId(),
    method: mutation.method,
    url: mutation.url,
    data: mutation.data,
    enqueuedAt: Date.now(),
    retryCount: 0,
    maxRetries: mutation.maxRetries ?? DEFAULT_MAX_RETRIES,
  };

  queue.push(queuedMutation);
  await writeQueue(queue);

  if (__DEV__) {
    console.log(
      `[APEx:OfflineQueue] Enqueued ${mutation.method} ${mutation.url} (id: ${queuedMutation.id})`,
    );
  }

  return queuedMutation.id;
}

/**
 * Processes all pending mutations in the queue.
 *
 * Called when network connectivity is detected. Processes mutations in
 * FIFO order. Mutations that fail are retried with exponential backoff.
 * Mutations that exceed their max retry count are removed and an error logged.
 *
 * Returns the number of mutations successfully flushed.
 */
export async function flushQueue(): Promise<number> {
  const queue = await readQueue();

  if (queue.length === 0) return 0;

  if (__DEV__) {
    console.log(
      `[APEx:OfflineQueue] Flushing ${queue.length} pending mutations`,
    );
  }

  let successCount = 0;
  const remaining: QueuedMutation[] = [];

  for (const mutation of queue) {
    try {
      await executeMutation(mutation);
      successCount++;

      if (__DEV__) {
        console.log(
          `[APEx:OfflineQueue] Flushed ${mutation.method} ${mutation.url} (id: ${mutation.id})`,
        );
      }
    } catch (err) {
      const updatedMutation = {
        ...mutation,
        retryCount: mutation.retryCount + 1,
      };

      if (updatedMutation.retryCount >= updatedMutation.maxRetries) {
        // Max retries exceeded — discard and log
        console.error(
          `[APEx:OfflineQueue] Discarding mutation after ${updatedMutation.retryCount} failures:`,
          { id: mutation.id, method: mutation.method, url: mutation.url },
          err,
        );
      } else {
        // Keep in queue for next flush attempt
        remaining.push(updatedMutation);

        if (__DEV__) {
          console.warn(
            `[APEx:OfflineQueue] Mutation failed (attempt ${updatedMutation.retryCount}/${updatedMutation.maxRetries}):`,
            { id: mutation.id, method: mutation.method, url: mutation.url },
          );
        }
      }
    }
  }

  await writeQueue(remaining);
  return successCount;
}

/**
 * Executes a single queued mutation against the API.
 */
async function executeMutation(mutation: QueuedMutation): Promise<void> {
  const { method, url, data } = mutation;

  switch (method as HttpMethod) {
    case 'GET':
      await apiClient.get(url);
      break;
    case 'POST':
      await apiClient.post(url, data);
      break;
    case 'PATCH':
      await apiClient.patch(url, data);
      break;
    case 'DELETE':
      await apiClient.delete(url);
      break;
    default:
      throw new Error(`Unsupported HTTP method in queue: ${method}`);
  }
}

/**
 * Returns the number of mutations currently in the offline queue.
 * Useful for showing a "pending sync" indicator in the UI.
 */
export async function getQueueLength(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

/**
 * Removes all pending mutations from the offline queue.
 * Use with caution — discards unsent data permanently.
 */
export async function clearQueue(): Promise<void> {
  await writeQueue([]);
}

/**
 * Returns all pending mutations without modifying the queue.
 * Useful for debugging and displaying queue status in dev builds.
 */
export async function inspectQueue(): Promise<QueuedMutation[]> {
  return readQueue();
}

/**
 * Removes a specific mutation from the queue by ID.
 * Used when a mutation becomes irrelevant (e.g. the item was deleted).
 */
export async function dequeue(mutationId: string): Promise<void> {
  const queue = await readQueue();
  const filtered = queue.filter((m) => m.id !== mutationId);
  await writeQueue(filtered);
}
