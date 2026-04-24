export async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.message ?? `Request failed (${response.status})`);
  }

  return (payload ?? {}) as T;
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  return parseApiResponse<T>(response);
}
