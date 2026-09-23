import type {
  HttpPort,
  HttpRequestOptions,
  HttpResponse,
} from "@mosaix/ports-http";

class FetchHttpResponse implements HttpResponse {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly headers: Record<string, string>,
    public readonly body: string,
  ) {}

  json<T>(): T {
    return JSON.parse(this.body) as T;
  }
}

export class FetchHttpAdapter implements HttpPort {
  async send(url: string, options?: HttpRequestOptions): Promise<HttpResponse> {
    const method = options?.method ?? "GET";
    const headers: Record<string, string> = options?.headers ?? {};

    let body: BodyInit | undefined;
    if (options?.body !== undefined) {
      if (typeof options.body === "string" || options.body instanceof Buffer) {
        body = options.body;
      } else {
        body = JSON.stringify(options.body);
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };
    if (body !== undefined) {
      fetchOptions.body = body;
    }

    // Set up abort controller for timeout if needed
    let controller: AbortController | undefined;
    if (options?.timeout !== undefined) {
      controller = new AbortController();
      fetchOptions.signal = controller.signal;
      setTimeout(() => controller?.abort(), options.timeout);
    }

    try {
      const response = await fetch(url, fetchOptions);
      const resBody = await response.text();
      const resHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      return new FetchHttpResponse(
        response.status,
        response.statusText,
        resHeaders,
        resBody,
      );
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "AbortError"
      ) {
        throw new Error(`HTTP request timed out after ${options?.timeout}ms`, {
          cause: error,
        });
      }
      throw error;
    }
  }

  async get(
    url: string,
    options?: Omit<HttpRequestOptions, "method">,
  ): Promise<HttpResponse> {
    return await this.send(url, { ...options, method: "GET" });
  }

  async post(
    url: string,
    body?: unknown,
    options?: Omit<HttpRequestOptions, "method" | "body">,
  ): Promise<HttpResponse> {
    return await this.send(url, { ...options, method: "POST", body });
  }
}
