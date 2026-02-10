// CRITICAL
import { existsSync, readdirSync, readFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import os from "node:os";
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

    const threadsEnv = Number.parseInt((process.env["VLLM_STUDIO_STT_THREADS"] || "").trim(), 10);
    const threadsDefault = Math.min(16, Math.max(1, os.cpus()?.length ?? 4));
    const threads = Number.isFinite(threadsEnv) && threadsEnv > 0 ? threadsEnv : threadsDefault;

    const fast =
      (process.env["VLLM_STUDIO_STT_FAST"] ?? "1").trim() !== "0" &&
      (process.env["VLLM_STUDIO_STT_FAST"] ?? "1").trim().toLowerCase() !== "false";

    // VAD support varies between whisper.cpp builds and can fail hard when misconfigured.
    // Default to off; operators can opt in explicitly via env.
    const vad =
      (process.env["VLLM_STUDIO_STT_VAD"] ?? "0").trim() !== "0" &&
      (process.env["VLLM_STUDIO_STT_VAD"] ?? "0").trim().toLowerCase() !== "false";

    const vadMaxSpeechEnv = Number.parseFloat((process.env["VLLM_STUDIO_STT_VAD_MAX_SPEECH_S"] || "").trim());
    const vadMaxSpeechS =
      Number.isFinite(vadMaxSpeechEnv) && vadMaxSpeechEnv > 0 ? vadMaxSpeechEnv : 15;

    const cliArguments: string[] = [
      "-m",
      args.modelPath,
      "-f",
      args.audioPath,
      "-t",
      String(threads),
      // For interactive STT, timestamps and extra prints slow things down and aren't needed.
      "-nt",
      "-np",
      "-otxt",
      "-of",
      prefix,
    ];
    if (args.language) {
      // whisper.cpp uses -l for language code on some builds.
      cliArguments.push("-l", args.language);
    }
    if (fast) {
      // Prioritize latency. (Greedy decoding behaves like beam_size=1 and best_of=1.)
      cliArguments.push("-bs", "1", "-bo", "1");
    }
    if (vad) {
      cliArguments.push("--vad", "--vad-max-speech-duration-s", String(vadMaxSpeechS));
    }

    const tryRun = async (argv: string[]): Promise<Awaited<ReturnType<typeof runCli>>> => {
      // Tighten timeout so we fail fast instead of "hanging forever" on misconfigured models.
      const timeoutMsEnv = Number.parseInt((process.env["VLLM_STUDIO_STT_TIMEOUT_MS"] || "").trim(), 10);
      const timeoutMs = Number.isFinite(timeoutMsEnv) && timeoutMsEnv > 0 ? timeoutMsEnv : 90_000;
      return await runCli(cli, argv, { timeoutMs });
    };

    // Some whisper.cpp builds vary; if a flag is unknown, fall back to a minimal invocation.
    let result = await tryRun(cliArguments);
    if (result.exitCode !== 0) {
      const details = (result.stderr || result.stdout || "").toLowerCase();
      const looksLikeUnknownArg =
        details.includes("unknown argument") || details.includes("unknown option") || details.includes("unrecognized option");
      if (looksLikeUnknownArg) {
        const minimal = ["-m", args.modelPath, "-f", args.audioPath, "-otxt", "-of", prefix];
        if (args.language) minimal.push("-l", args.language);
        result = await tryRun(minimal);
      }
    }
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
