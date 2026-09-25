export interface HttpClient {
  get<T = unknown>(url: string, options?: Record<string, unknown>): Promise<T>;
  post<T = unknown>(url: string, body?: unknown, options?: Record<string, unknown>): Promise<T>;
}
