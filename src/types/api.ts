/**
 * api.ts
 * Generic types for interacting with the Bubble.io Data API.
 *
 * Bubble's Data API returns consistent envelope shapes for list and detail
 * endpoints.  These types wrap domain objects and provide a uniform
 * interface for all API calls in APEx360.
 *
 * Bubble API base URL pattern:
 *   GET  /api/1.1/obj/<type>        → BubbleListResponse<T>
 *   GET  /api/1.1/obj/<type>/:id    → BubbleDetailResponse<T>
 *   POST /api/1.1/obj/<type>        → BubbleCreateResponse
 *   POST /api/1.1/wf/<workflow>     → BubbleWorkflowResponse<T>
 */

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

/**
 * Standard Bubble Data API list response.
 *
 * @template T  The domain model type of each item in the results array.
 */
export interface BubbleListResponse<T> {
  response: {
    /** The array of matching records for this page */
    results: T[];
    /** Total number of records matching the query (across all pages) */
    count: number;
    /**
     * Number of records remaining after this page.
     * When remaining === 0, no further pagination is needed.
     */
    remaining: number;
    /** Cursor value to pass in the next request for the next page */
    cursor?: number;
  };
  status: 'success';
}

/**
 * Standard Bubble Data API detail (single-record) response.
 *
 * @template T  The domain model type of the returned object.
 */
export interface BubbleDetailResponse<T> {
  response: T;
  status: 'success';
}

/**
 * Response returned by a Bubble Object POST (record creation).
 */
export interface BubbleCreateResponse {
  status: 'success';
  id: string;
}

/**
 * Response returned by a Bubble Workflow (wf) POST.
 *
 * @template T  Optional shape of any data returned by the workflow.
 */
export interface BubbleWorkflowResponse<T = Record<string, unknown>> {
  status: 'success';
  response: T;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/**
 * A single filter constraint passed to Bubble's Data API list endpoints
 * via the `constraints` query parameter (JSON-encoded array).
 *
 * @see https://manual.bubble.io/core-resources/api/the-bubble-api/the-data-api/data-api-requests
 */
export interface BubbleConstraint {
  /**
   * The field name to filter on (must match Bubble's field name exactly,
   * including spaces for fields with spaces).
   */
  key: string;
  /**
   * The Bubble constraint operator.
   * Common values:
   *   equals, not equal, is_empty, is_not_empty,
   *   text contains, not text contains,
   *   greater than, less than, greater than or equal to, less than or equal to,
   *   in, not in,
   *   contains, not contains,
   *   geographic_within
   */
  constraint_type:
    | 'equals'
    | 'not equal'
    | 'is_empty'
    | 'is_not_empty'
    | 'text contains'
    | 'not text contains'
    | 'greater than'
    | 'less than'
    | 'greater than or equal to'
    | 'less than or equal to'
    | 'in'
    | 'not in'
    | 'contains'
    | 'not contains'
    | 'geographic_within';
  /**
   * The value to compare against.
   * For 'is_empty' and 'is_not_empty' constraints, omit this field.
   * For 'in' / 'not in' constraints, pass an array.
   */
  value?: string | number | boolean | string[] | number[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Normalized API error shape used throughout the app.
 * Adapters map Bubble API errors and Axios errors to this shape.
 */
export interface ApiError {
  /** Human-readable error message suitable for display */
  message: string;
  /**
   * Machine-readable error code.
   * Examples: 'unauthorized', 'not_found', 'validation_error', 'network_error'
   */
  code: string;
  /**
   * HTTP status code from the response (0 for network-level errors).
   */
  status: number;
  /**
   * Raw error body from the Bubble API, if available.
   * Useful for debugging — not shown to end users.
   */
  rawBody?: unknown;
}

/**
 * Type guard — returns true if the value is an ApiError.
 */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    'code' in value &&
    'status' in value
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/**
 * Parameters for paginated list requests.
 * Bubble uses cursor-based pagination via the `cursor` parameter.
 */
export interface PaginationParams {
  /**
   * Cursor value returned by the previous response.
   * Omit for the first page.
   */
  cursor?: number;
  /**
   * Maximum number of records to return per page.
   * Bubble default is 100; max is 100.
   */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Filter params
// ---------------------------------------------------------------------------

/**
 * Base type for all filter parameter objects.
 * Extended by domain-specific filter types (e.g. EvalLogFilterParams).
 */
export interface FilterParams extends Record<string, unknown> {
  /** Bubble constraints array, JSON-encoded before sending to the API */
  constraints?: BubbleConstraint[];
  /** Field to sort results by */
  sort_field?: string;
  /** Sort direction */
  descending?: boolean;
}

// ---------------------------------------------------------------------------
// Sort options
// ---------------------------------------------------------------------------

export interface SortOptions {
  field: string;
  descending: boolean;
}

// ---------------------------------------------------------------------------
// Combined list query params
// ---------------------------------------------------------------------------

/**
 * Full parameter set for a Bubble list query, combining pagination,
 * filtering, and sorting.
 */
export type ListQueryParams = PaginationParams & FilterParams;
