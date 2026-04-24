import { execSync, spawn } from "node:child_process";
import process from "node:process";

interface Step {
  name: string;
  command: string;
  args: string[];
  optional?: boolean;
}

function runStep(step: Step): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n[auto-test] START: ${step.name}`);

    const child = spawn(step.command, step.args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        console.log(`[auto-test] PASS: ${step.name}`);
        resolve();
        return;
      }

      const error = new Error(`${step.name} failed with exit code ${code ?? -1}`);
      if (step.optional) {
        console.warn(`[auto-test] WARN: ${error.message}`);
        resolve();
        return;
      }
      reject(error);
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomPort(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET", redirect: "manual" });
      if (response.status >= 200 && response.status < 600) return;
    } catch {
      // keep polling
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for server: ${url}`);
}

async function runSmokeWithManagedServer(): Promise<void> {
  const smokePort = process.env.SMOKE_SERVER_PORT ?? String(randomPort(3107, 3907));
  const smokeBaseUrl = process.env.SMOKE_BASE_URL ?? `http://localhost:${smokePort}`;
  const startupProbe = `${smokeBaseUrl.replace(/\/$/, "")}/api/v1/public/site-status`;

  if (process.platform === "win32") {
    const escapedCwd = process.cwd().replace(/\\/g, "\\\\");
    const cleanupCommand = `$procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like '*next dev*' -and $_.CommandLine -like '*${escapedCwd}*' }; foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }`;
    try {
      execSync(`powershell -NoProfile -Command "${cleanupCommand}"`, { stdio: "ignore" });
    } catch {
      // Best effort cleanup.
    }
  }

  console.log(`\n[auto-test] START: Launch dev server for smoke (${smokeBaseUrl})`);
  const server = spawn("npm", ["run", "dev", "--", "--port", String(smokePort)], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      PORT: String(smokePort),
      NODE_ENV: "development",
    },
  });

  const exitedEarly = new Promise<never>((_, reject) => {
    server.on("exit", (code) => {
      reject(new Error(`Dev server exited before smoke run (code ${code ?? -1})`));
    });
  });

  try {
    await Promise.race([waitForHttp(startupProbe, 120_000), exitedEarly]);
    console.log("[auto-test] PASS: Dev server startup");
    process.env.SMOKE_BASE_URL = smokeBaseUrl;
    await runStep({
      name: "Authenticated CRUD smoke",
      command: "npm",
      args: ["run", "test:smoke:crud"],
    });
  } finally {
    server.kill("SIGTERM");
  }
}

async function run(): Promise<void> {
  const skipBuild = process.env.SMOKE_SKIP_BUILD === "1";
  const optionalBuild = process.env.SMOKE_OPTIONAL_BUILD === "1";
  const manageSmokeServer = process.env.SMOKE_MANAGE_SERVER !== "0";

  const steps: Step[] = [
    { name: "TypeScript check", command: "npx", args: ["tsc", "--noEmit"] },
    { name: "ESLint", command: "npm", args: ["run", "lint"] },
    ...(skipBuild ? [] : [{ name: "Next.js production build", command: "npm", args: ["run", "build"], optional: optionalBuild } satisfies Step]),
  ];

  for (const step of steps) {
    await runStep(step);
  }

  if (manageSmokeServer) {
    await runSmokeWithManagedServer();
  } else {
    await runStep({
      name: "Authenticated CRUD smoke",
      command: "npm",
      args: ["run", "test:smoke:crud"],
    });
  }

  console.log("\n[auto-test] COMPLETE: all configured checks finished");
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`\n[auto-test] FAILED\n${message}`);
  process.exit(1);
});
