// CRITICAL
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveBinary, runCommand } from "../../command/command-utilities";
import { runCli } from "../cli/cli-runner";
import type { TtsAdapter, TtsBackend } from "./types";

const listFiles = (directory: string): string[] => {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
};

/**
 * Adapter for `piper` CLI text-to-speech synthesis.
 */
export class PiperAdapter implements TtsAdapter {
  public readonly id = "piper";

  /**
   * Resolve the configured TTS CLI binary.
   * @returns Binary path, or null if not found.
   */
  private resolveCli(): string | null {
    const configured = (process.env["VLLM_STUDIO_TTS_CLI"] || "piper").trim();
    return resolveBinary(configured);
  }

  /**
   * Check whether the integration is installed (binary resolvable).
   * @returns True if installed.
   */
  public isInstalled(): boolean {
    return Boolean(this.resolveCli());
  }

  /**
   * Get the CLI version string.
   * @returns Version string, or null if unavailable.
   */
  public async getVersion(): Promise<string | null> {
    const cli = this.resolveCli();
    if (!cli) return null;
    const result = runCommand(cli, ["--version"], 2000);
    if (result.status === 0) {
      const line = (result.stdout || result.stderr).split("\n")[0]?.trim();
      return line || null;
    }
    return null;
  }

  /**
   * List discoverable TTS models in the models directory.
   * @param modelsDirectory - Base models directory.
   * @returns Model filenames.
   */
  public async listModels(modelsDirectory: string): Promise<string[]> {
    const directory = join(modelsDirectory, "tts");
    const files = listFiles(directory);
    return files.filter((name) => name.endsWith(".onnx"));
  }

  /**
   * Report the preferred backend(s) for this integration.
   * @returns Backends.
   */
  public async getBackends(): Promise<TtsBackend[]> {
    const backend = (process.env["VLLM_STUDIO_TTS_BACKEND"] || "").trim().toLowerCase();
    if (backend) return [backend as TtsBackend];
    return ["cpu"];
  }

  /**
   * Synthesize TTS audio to a file.
   * @param args - Synthesis arguments.
   * @param args.text - Input text.
   * @param args.modelPath - Model file path.
   * @param args.outputPath - Output audio file path.
   * @returns void
   */
  public async speak(args: { text: string; modelPath: string; outputPath: string }): Promise<void> {
    const cli = this.resolveCli();
    if (!cli) {
      throw new Error("TTS integration not installed (missing piper). Set VLLM_STUDIO_TTS_CLI.");
    }
    if (!existsSync(args.modelPath)) {
      throw new Error(`TTS model not found: ${args.modelPath}`);
    }
    const outputDirectory = dirname(args.outputPath);
    try {
      mkdirSync(outputDirectory, { recursive: true });
    } catch {
      // ignore
    }

    const cliArguments = ["--model", args.modelPath, "--output_file", args.outputPath];
    const result = await runCli(cli, cliArguments, { timeoutMs: 300_000, stdin: args.text });
    if (result.exitCode !== 0) {
      const details = result.stderr || result.stdout || "unknown error";
      throw new Error(`TTS failed: ${details}`);
    }
  }
}
