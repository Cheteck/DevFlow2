export interface HttpClient {
  get<T = unknown>(url: string, options?: Record<string, unknown>): Promise<T>;
  post<T = unknown>(url: string, body?: unknown, options?: Record<string, unknown>): Promise<T>;
}

/**
 * @mosaix/ports-http — HttpPort (outbound fetch adapter contract).
 *
 * Implemented by `@mosaix/adapter-http-fetch`, consumed by `@mosaix/adapter-auth-oidc`.
 */
export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  /** Timeout in milliseconds (abort). */
  timeout?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  json<T>(): T;
}

export interface HttpPort {
  send(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
  get(url: string, options?: Omit<HttpRequestOptions, "method">): Promise<HttpResponse>;
  post(
    url: string,
    body?: unknown,
    options?: Omit<HttpRequestOptions, "method" | "body">,
  ): Promise<HttpResponse>;
}
