export interface HttpRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: string | Buffer | unknown;
  timeout?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  json<T>(): T;
}

/**
 * HttpPort — Decouples application HTTP calls from fetch, axios or other clients.
 */
export interface HttpPort {
  /** Asynchronously sends an HTTP request. */
  send(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
  /** Asynchronously sends a GET request. */
  get(
    url: string,
    options?: Omit<HttpRequestOptions, "method">,
  ): Promise<HttpResponse>;
  /** Asynchronously sends a POST request. */
  post(
    url: string,
    body?: unknown,
    options?: Omit<HttpRequestOptions, "method" | "body">,
  ): Promise<HttpResponse>;
}
