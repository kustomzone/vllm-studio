// CRITICAL
import { spawn } from "node:child_process";

export type CliRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

/**
 * Run a CLI command with timeout, capturing stdout/stderr.
 * @param command - Command/binary path.
 * @param args - Argument list.
 * @param options - Run options.
 * @param options.timeoutMs - Timeout in milliseconds.
 * @param options.stdin - Optional stdin payload.
 * @param options.env - Environment variables.
 * @returns Result including exit code and captured output.
 */
export async function runCli(
  command: string,
  args: string[],
  options?: { timeoutMs?: number; stdin?: Uint8Array | string | null; env?: NodeJS.ProcessEnv },
): Promise<CliRunResult> {
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const env = options?.env ?? process.env;

  return await new Promise<CliRunResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let finished = false;

    const child = spawn(command, args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      resolve({ exitCode: null, stdout, stderr: stderr || `Timeout after ${timeoutMs}ms` });
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf-8");
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf-8");
    });

    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({ exitCode: code, stdout: stdout.trimEnd(), stderr: stderr.trimEnd() });
    });

    const stdin = options?.stdin ?? null;
    if (stdin !== null && stdin !== undefined) {
      try {
        child.stdin?.write(stdin);
      } catch {
        // ignore
      }
    }
    try {
      child.stdin?.end();
    } catch {
      // ignore
    }
  });
}
