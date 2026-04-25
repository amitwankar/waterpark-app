interface ApiErrorPayload {
  message?: string;
  errors?: {
    formErrors?: string[];
    fieldErrors?: Record<string, string[] | undefined>;
  };
  issues?: {
    formErrors?: string[];
    fieldErrors?: Record<string, string[] | undefined>;
  };
}

function flattenFieldErrors(fieldErrors?: Record<string, string[] | undefined>): string[] {
  if (!fieldErrors) return [];
  return Object.entries(fieldErrors).flatMap(([field, messages]) => (messages ?? []).map((message) => `${field}: ${message}`));
}

export function getApiErrorMessage(payload: unknown, fallback = "Request failed"): string {
  const data = (payload ?? {}) as ApiErrorPayload;
  const fieldMessages = [...flattenFieldErrors(data.errors?.fieldErrors), ...flattenFieldErrors(data.issues?.fieldErrors)];
  const formMessages = [...(data.errors?.formErrors ?? []), ...(data.issues?.formErrors ?? [])];
  if (fieldMessages.length > 0) return fieldMessages.join(", ");
  if (formMessages.length > 0) return formMessages.join(", ");
  if (typeof data.message === "string" && data.message.trim().length > 0) return data.message.trim();
  return fallback;
}

