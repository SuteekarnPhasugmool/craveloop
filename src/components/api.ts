export class RequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
// randomUUID is unavailable on plain HTTP LAN origins.
export function requestId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join(
    "",
  );
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
export async function api<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  const isForm = body instanceof FormData;
  if (method !== "GET") headers["Idempotency-Key"] = requestId();
  if (body !== undefined && !isForm)
    headers["Content-Type"] = "application/json";
  const init: RequestInit = {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  };
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    response = await fetch(url, init);
  }
  const payload = await response.json();
  if (!response.ok)
    throw new RequestError(
      response.status,
      payload.error?.code ?? "REQUEST_FAILED",
      payload.error?.message ?? "Please try again.",
    );
  return payload.data as T;
}
export function money(satang: number | null) {
  return satang === null
    ? "Unknown"
    : new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(satang / 100);
}
