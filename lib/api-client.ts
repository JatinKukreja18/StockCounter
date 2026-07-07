export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getErrorMessage(error: unknown, fallback = "Request failed") {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  let body: Record<string, unknown> = {};

  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      if (!response.ok) {
        throw new ApiError(text || `Request failed (${response.status})`, response.status);
      }
      throw new ApiError("The server returned an unreadable response.", response.status);
    }
  }

  if (!response.ok) {
    const message = [body.error, body.details, body.hint]
      .filter((value) => typeof value === "string" && value.length > 0)
      .join(" ") || `Request failed (${response.status})`;
    throw new ApiError(String(message), response.status, body);
  }

  return body as T;
}
