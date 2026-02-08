// CRITICAL
import { existsSync, readdirSync, readFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { resolveBinary, runCommand } from "../../command/command-utilities";
import { runCli } from "../cli/cli-runner";
import type { SttAdapter, SttBackend } from "./types";

const listFiles = (directory: string): string[] => {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
};

const ensureDirectory = (directory: string): void => {
  try {
    mkdirSync(directory, { recursive: true });
  } catch {
    // ignore
  }
};

/**
 * Adapter for `whisper.cpp` CLI (`whisper-cli`) speech-to-text transcription.
 */
export class WhisperCppAdapter implements SttAdapter {
  public readonly id = "whisper.cpp";

  /**
   * Resolve the configured STT CLI binary.
   * @returns Binary path, or null if not found.
   */
  private resolveCli(): string | null {
    const configured = (process.env["VLLM_STUDIO_STT_CLI"] || "whisper-cli").trim();
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
   * List discoverable STT models in the models directory.
   * @param modelsDirectory - Base models directory.
   * @returns Model filenames.
   */
  public async listModels(modelsDirectory: string): Promise<string[]> {
    const directory = join(modelsDirectory, "stt");
    const files = listFiles(directory);
    return files.filter((name) => name.endsWith(".bin") || name.endsWith(".gguf") || name.endsWith(".ggml"));
  }

  /**
   * Report the preferred backend(s) for this integration.
   * @returns Backends.
   */
  public async getBackends(): Promise<SttBackend[]> {
    const backend = (process.env["VLLM_STUDIO_STT_BACKEND"] || "").trim().toLowerCase();
    if (backend) return [backend as SttBackend];
    // Conservative default: CPU. Operators can opt into Vulkan/CUDA/ROCm via env.
    return ["cpu"];
  }

  /**
   * Transcribe an audio file to text.
   * @param args - Transcription arguments.
   * @param args.audioPath - Input audio file path.
   * @param args.modelPath - STT model path.
   * @param args.language - Optional language code.
   * @returns Transcript text.
   */
  public async transcribe(args: {
    audioPath: string;
    modelPath: string;
    language?: string | null;
  }): Promise<{ text: string }> {
    const cli = this.resolveCli();
    if (!cli) {
      throw new Error("STT integration not installed (missing whisper-cli). Set VLLM_STUDIO_STT_CLI.");
    }
    if (!existsSync(args.modelPath)) {
      throw new Error(`STT model not found: ${args.modelPath}`);
    }
    if (!existsSync(args.audioPath)) {
      throw new Error(`Audio file not found: ${args.audioPath}`);
    }

    const outputDirectory = join(process.cwd(), ".vllm-studio", "tmp", "stt");
    ensureDirectory(outputDirectory);
    const prefix = join(outputDirectory, `transcript-${Date.now()}-${Math.random().toString(16).slice(2)}`);

    const cliArguments: string[] = [
      "-m",
      args.modelPath,
      "-f",
      args.audioPath,
      "-otxt",
      "-of",
      prefix,
    ];
    if (args.language) {
      // whisper.cpp uses -l for language code on some builds.
      cliArguments.push("-l", args.language);
    }

    const result = await runCli(cli, cliArguments, { timeoutMs: 300_000 });
    if (result.exitCode !== 0) {
      const details = result.stderr || result.stdout || "unknown error";
      throw new Error(`STT failed: ${details}`);
    }

    const outPath = `${prefix}.txt`;
    try {
      const text = readFileSync(outPath, "utf-8").trim();
      return { text };
    } catch {
      // Some builds print to stdout; accept that as a fallback.
      const text = (result.stdout || "").trim();
      if (!text) {
        throw new Error(`STT completed but no transcript was produced (expected ${basename(outPath)})`);
      }
      return { text };
    }
  }
}
