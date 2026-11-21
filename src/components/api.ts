export class RequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  const isForm = body instanceof FormData;
  if (method !== "GET") headers["Idempotency-Key"] = crypto.randomUUID();
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
