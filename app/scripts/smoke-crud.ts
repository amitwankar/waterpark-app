import process from "node:process";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: JsonObject;
  expectedStatus?: number;
  allowStatuses?: number[];
}

interface HttpResult {
  status: number;
  headers: Headers;
  data: JsonValue;
}

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function safeJsonParse(input: string): JsonValue {
  try {
    return JSON.parse(input) as JsonValue;
  } catch {
    return input;
  }
}

function mergeSetCookieIntoJar(jar: Map<string, string>, setCookieHeader: string | null): void {
  if (!setCookieHeader) return;
  const cookieChunk = setCookieHeader.split(", ");
  for (const chunk of cookieChunk) {
    const pair = chunk.split(";")[0];
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (!name) continue;
    jar.set(name, value);
  }
}

function cookieHeaderFromJar(jar: Map<string, string>): string {
  const items: string[] = [];
  for (const [name, value] of jar.entries()) {
    items.push(`${name}=${value}`);
  }
  return items.join("; ");
}

async function http(baseUrl: string, jar: Map<string, string>, path: string, options: RequestOptions = {}): Promise<HttpResult> {
  const url = `${baseUrl}${path}`;
  const headers = new Headers();
  headers.set("accept", "application/json");
  if (options.body) {
    headers.set("content-type", "application/json");
  }
  const cookieHeader = cookieHeaderFromJar(jar);
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: "manual",
  });

  mergeSetCookieIntoJar(jar, response.headers.get("set-cookie"));

  const raw = await response.text();
  const data = safeJsonParse(raw);

  if (options.expectedStatus !== undefined && response.status !== options.expectedStatus) {
    throw new Error(`Expected ${options.expectedStatus} for ${path}, got ${response.status}: ${raw}`);
  }
  if (options.allowStatuses && !options.allowStatuses.includes(response.status)) {
    throw new Error(`Expected one of [${options.allowStatuses.join(", ")}] for ${path}, got ${response.status}: ${raw}`);
  }

  return { status: response.status, headers: response.headers, data };
}

function nowTag(): string {
  return `${Date.now()}`;
}

function requireObject(value: JsonValue, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object`);
  }
  return value as JsonObject;
}

function requireString(value: JsonValue, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} is not a non-empty string`);
  }
  return value;
}

async function run(): Promise<void> {
  const baseUrl = getEnv("SMOKE_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
  const adminEmail = getEnv("SMOKE_ADMIN_EMAIL", "admin@aquaworld.com");
  const adminPassword = getEnv("SMOKE_ADMIN_PASSWORD", "Admin@1234!");
  const tag = nowTag();

  const jar = new Map<string, string>();
  const steps: string[] = [];

  const record = (message: string): void => {
    steps.push(message);
    console.log(`[smoke] ${message}`);
  };

  record(`Base URL: ${baseUrl}`);

  await http(baseUrl, jar, "/api/health", { allowStatuses: [200, 503] });
  record("Health endpoint reachable");

  await http(baseUrl, jar, "/api/v1/public/site-status", { expectedStatus: 200 });
  record("Public site-status endpoint OK");

  const login = await http(baseUrl, jar, "/api/v1/auth/login/email", {
    method: "POST",
    expectedStatus: 200,
    body: {
      email: adminEmail,
      password: adminPassword,
      rememberMe: false,
    },
  });
  const loginData = requireObject(login.data, "login response");
  if (loginData.success !== true) {
    throw new Error("Login did not return success=true");
  }
  record("Admin email/password login OK");

  const staffMobile = `9${tag.slice(-9)}`;
  const staffEmail = `autotest.staff.${tag}@example.com`;
  const staffName = `Autotest Staff ${tag}`;

  const staffCreate = await http(baseUrl, jar, "/api/v1/staff", {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: staffName,
      mobile: staffMobile,
      email: staffEmail,
      password: "Staff@1234!",
      role: "EMPLOYEE",
      subRole: "TICKET_COUNTER",
      employeeCode: `AT-${tag.slice(-6)}`,
      joiningDate: "2026-01-01",
    },
  });
  const staffCreateData = requireObject(staffCreate.data, "staff create response");
  const staffId = requireString(staffCreateData.id, "staff.id");
  record("Staff create OK");

  await http(baseUrl, jar, `/api/v1/staff/${staffId}`, {
    method: "PUT",
    expectedStatus: 200,
    body: {
      name: `${staffName} Updated`,
      isActive: true,
    },
  });
  record("Staff update OK");

  await http(baseUrl, jar, `/api/v1/staff/${staffId}`, {
    method: "DELETE",
    allowStatuses: [200, 409],
  });
  record("Staff delete endpoint OK (hard delete or conflict-safe)");

  const leadMobile = `8${tag.slice(-9)}`;
  const leadCreate = await http(baseUrl, jar, "/api/v1/crm/leads", {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: `Autotest Lead ${tag}`,
      mobile: leadMobile,
      email: `autotest.lead.${tag}@example.com`,
      source: "WEBSITE",
      type: "INDIVIDUAL",
      notes: "Created by automated smoke test",
    },
  });
  const leadCreateData = requireObject(leadCreate.data, "lead create response");
  const leadObject = requireObject(leadCreateData.lead, "lead create payload.lead");
  const leadId = requireString(leadObject.id, "lead.id");
  record("Lead create OK");

  await http(baseUrl, jar, `/api/v1/crm/leads/${leadId}`, {
    method: "PUT",
    expectedStatus: 200,
    body: {
      stage: "CONTACTED",
      notes: "Updated by automated smoke test",
    },
  });
  record("Lead update OK");

  await http(baseUrl, jar, `/api/v1/crm/leads/${leadId}`, {
    method: "DELETE",
    expectedStatus: 200,
  });
  record("Lead delete OK");

  const categoryCode = `AT_${tag.slice(-8)}`.toUpperCase();
  const categoryCreate = await http(baseUrl, jar, "/api/v1/lockers/categories", {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: `Autotest Category ${tag}`,
      code: categoryCode,
      size: "MEDIUM",
      baseRate: 299,
      gstRate: 18,
      sortOrder: 999,
      isActive: true,
    },
  });
  const categoryData = requireObject(categoryCreate.data, "locker category create response");
  const categoryId = requireString(categoryData.id, "locker category id");
  record("Locker category create OK");

  await http(baseUrl, jar, `/api/v1/lockers/categories/${categoryId}`, {
    method: "PUT",
    expectedStatus: 200,
    body: {
      name: `Autotest Category Updated ${tag}`,
    },
  });
  record("Locker category update OK");

  await http(baseUrl, jar, `/api/v1/lockers/categories/${categoryId}`, {
    method: "DELETE",
    expectedStatus: 200,
  });
  record("Locker category delete OK");

  record(`Completed ${steps.length} smoke steps successfully`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[smoke] FAILED\n${message}`);
  process.exit(1);
});
