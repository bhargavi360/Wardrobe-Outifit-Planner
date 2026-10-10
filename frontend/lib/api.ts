export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "/api"
).replace(/\/+$/, "");

export function apiImageUrl(imageUrl: string): string {
  if (/^https?:\/\//i.test(API_URL)) {
    return new URL(imageUrl, `${API_URL}/`).toString();
  }
  if (imageUrl.startsWith("/") || /^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }
  return `${API_URL}/${imageUrl}`;
}

export async function fetchWardrobe<T>(): Promise<T[]> {
  const items: T[] = [];
  const pageSize = 100;
  while (true) {
    const page = await apiRequest<T[]>(
      `/wardrobe?skip=${items.length}&limit=${pageSize}`,
    );
    items.push(...page);
    if (page.length < pageSize) return items;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  const headers = new Headers(init.headers);
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new ApiError(
      "The API could not be reached. Check that the backend is running.",
      0,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body: unknown = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    if (
      response.status === 502 || response.status === 504 ||
      (response.status === 500 && !contentType.includes("application/json"))
    ) {
      throw new ApiError(
        "The API connection failed. Start the backend and MongoDB, then try again.",
        response.status,
      );
    }
    const detail =
      typeof body === "object" &&
      body !== null &&
      "detail" in body &&
      typeof body.detail === "string"
        ? body.detail
        : `The request failed (${response.status}).`;
    throw new ApiError(detail, response.status);
  }

  return body as T;
}
