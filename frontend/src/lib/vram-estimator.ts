/**
 * Accurate VRAM estimator for LLM inference engines.
 *
 * Sources:
 * - vLLM: KV cache formula from vLLM docs + GPU Memory Calculation guide
 * - llama.cpp: Empirical formula from oobabooga's 19,517 measurement study
 *   (https://oobabooga.github.io/blog/posts/gguf-vram-formula/)
 * - sglang: Same as vLLM with different overhead factor
 *
 * KV cache formula: 2 × layers × kv_heads × head_dim × bytes_per_element × seq_len
 * Model weights: params × bytes_per_param
 */

export interface ModelArchitecture {
  numParams: number;           // Total parameters (e.g. 7e9 for 7B)
  numLayers: number;           // Transformer layers
  numKvHeads: number;          // KV attention heads (GQA/MQA may differ from query heads)
  headDim: number;             // Head dimension (typically 128 or 256)
  hiddenDim: number;           // Hidden/embedding dimension
  feedForwardDim?: number;     // FFN intermediate size
  contextLength: number;       // Max context length
  isMoe?: boolean;            // Mixture of Experts
  activeParamsRatio?: number;  // For MoE: fraction of params active per token (e.g. 0.14 for 14B/100B)
}

export type QuantFormat = "fp16" | "bf16" | "fp8" | "int8" | "int4" | "q4_k_m" | "q5_k_m" | "q8_0" | "q4_0" | "q3_k_m" | "q2_k" | "iq3_m" | "iq2";
export type InferenceEngine = "vllm" | "llamacpp" | "sglang";
export type KvCacheDtype = "fp16" | "fp8" | "q8_0" | "q4_0";

export interface VramEstimate {
  modelWeightsGb: number;
  kvCacheGb: number;
  overheadGb: number;
  totalGb: number;
  fitsInVram: boolean;
  breakdown: {
    weights: number;
    kvCache: number;
    overhead: number;
  };
}

const QUANT_BYTES: Record<QuantFormat, number> = {
  fp16: 2,
  bf16: 2,
  fp8: 1,
  int8: 1,
  int4: 0.5,
  q4_k_m: 0.5625,  // ~4.5 bits per param (empirical average)
  q5_k_m: 0.6875,  // ~5.5 bits
  q8_0: 1.0625,     // ~8.5 bits (slightly more than 1 byte due to group scales)
  q4_0: 0.53125,    // ~4.25 bits
  q3_k_m: 0.4375,   // ~3.5 bits
  q2_k: 0.375,      // ~3 bits
  iq3_m: 0.4375,
  iq2: 0.3125,      // ~2.5 bits
};

const KV_CACHE_BYTES: Record<KvCacheDtype, number> = {
  fp16: 2,
  fp8: 1,
  q8_0: 1,
  q4_0: 0.5,
};

/**
 * Estimate VRAM for vLLM or sglang inference.
 */
export function estimateVramVllm(
  arch: ModelArchitecture,
  quant: QuantFormat,
  maxSeqLen: number,
  batchSize: number,
  kvDtype: KvCacheDtype,
  tpSize: number,
  availableVramGb: number,
  engine: InferenceEngine = "vllm",
): VramEstimate {
  // Active params (for MoE, only count active experts)
  const activeParams = arch.isMoe && arch.activeParamsRatio
    ? arch.numParams * arch.activeParamsRatio
    : arch.numParams;

  // Model weights (per GPU with tensor parallelism)
  const bytesPerParam = QUANT_BYTES[quant] ?? 2;
  const modelWeightsGb = (activeParams * bytesPerParam) / (1024 ** 3 * tpSize);

  // KV cache per token per layer: 2 (K+V) × kv_heads × head_dim × bytes
  const bytesPerTokenPerLayer = 2 * arch.numKvHeads * arch.headDim * KV_CACHE_BYTES[kvDtype];
  // Total KV cache: per_token × layers × seq_len × batch_size / tp_size
  const kvCacheGb = (bytesPerTokenPerLayer * arch.numLayers * maxSeqLen * batchSize) / (1024 ** 3 * tpSize);

  // Overhead: activations, temp buffers, fragmentation
  // vLLM: ~10%, sglang: ~8% (more memory-efficient)
  const overheadPct = engine === "sglang" ? 0.08 : 0.10;
  const overheadGb = (modelWeightsGb + kvCacheGb) * overheadPct;

  const totalGb = modelWeightsGb + kvCacheGb + overheadGb;

  return {
    modelWeightsGb: round3(modelWeightsGb),
    kvCacheGb: round3(kvCacheGb),
    overheadGb: round3(overheadGb),
    totalGb: round3(totalGb),
    fitsInVram: totalGb <= availableVramGb,
    breakdown: {
      weights: round3(modelWeightsGb),
      kvCache: round3(kvCacheGb),
      overhead: round3(overheadGb),
    },
  };
}

/**
 * Estimate VRAM for llama.cpp with GGUF quantization.
 * Uses oobabooga's empirically validated formula (19,517 measurements, median error 365 MiB).
 *
 * Formula:
 *   vram = (size_per_layer - 17.996 + 3.149e-5 × kv_cache_factor)
 *          × (gpu_layers + max(0.969, cache_type - (floor(50.778 × embedding_per_context) + 9.988)))
 *          + 1516.523
 *
 * where:
 *   size_per_layer = size_in_mb / n_layers
 *   kv_cache_factor = n_kv_heads × cache_type × ctx_size
 *   embedding_per_context = embedding_dim / ctx_size
 *   cache_type = 16 (fp16), 8 (q8_0), 4 (q4_0)
 */
export function estimateVramLlamacpp(
  modelSizeMb: number,
  arch: ModelArchitecture,
  gpuLayers: number,
  ctxSize: number,
  cacheType: KvCacheDtype,
): VramEstimate {
  const cacheTypeVal = cacheType === "fp16" ? 16 : cacheType === "q8_0" ? 8 : 4;
  const nLayers = arch.numLayers;
  const nKvHeads = arch.numKvHeads;
  const embeddingDim = arch.hiddenDim;

  const sizePerLayer = modelSizeMb / nLayers;
  const kvCacheFactor = nKvHeads * cacheTypeVal * ctxSize;
  const embeddingPerContext = embeddingDim / ctxSize;

  const vramMib =
    (sizePerLayer - 17.99552795246051 + 3.148552680382576e-5 * kvCacheFactor) *
    (gpuLayers + Math.max(0.9690636483914102, cacheTypeVal - (Math.floor(50.77817218646521 * embeddingPerContext) + 9.987899908205632))) +
    1516.522943869404;

  // Add safety buffer (577 MiB for 95% confidence per oobabooga's analysis)
  const safeVramMib = vramMib + 577;
  const totalGb = safeVramMib / 1024;

  // Breakdown estimation
  const weightsGb = (modelSizeMb * gpuLayers / nLayers) / 1024;
  const kvCacheGb = (2 * nKvHeads * arch.headDim * KV_CACHE_BYTES[cacheType] * nLayers * ctxSize * gpuLayers / nLayers) / (1024 ** 3);

  return {
    modelWeightsGb: round3(weightsGb),
    kvCacheGb: round3(kvCacheGb),
    overheadGb: round3(Math.max(0, totalGb - weightsGb - kvCacheGb)),
    totalGb: round3(totalGb),
    fitsInVram: false, // Caller should compare with available VRAM
    breakdown: {
      weights: round3(weightsGb),
      kvCache: round3(kvCacheGb),
      overhead: round3(Math.max(0, totalGb - weightsGb - kvCacheGb)),
    },
  };
}

/**
 * Auto-detect optimal gpu_layers for llama.cpp given available VRAM.
 * Uses binary search with the oobabooga formula.
 */
export function autoGpuLayers(
  modelSizeMb: number,
  arch: ModelArchitecture,
  ctxSize: number,
  cacheType: KvCacheDtype,
  availableVramGb: number,
): number {
  const availableMib = availableVramGb * 1024;
  let lo = 0;
  let hi = arch.numLayers;
  let best = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const est = estimateVramLlamacpp(modelSizeMb, arch, mid, ctxSize, cacheType);
    const estMib = est.totalGb * 1024;
    if (estMib <= availableMib) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}

/**
 * Estimate model architecture from HuggingFace model ID.
 * Maps common model families to their architecture params.
 */
export function estimateArchitecture(modelId: string, numParams: number): ModelArchitecture {
  const id = modelId.toLowerCase();

  // Detect model family and set architecture params
  let numLayers: number;
  let numKvHeads: number;
  let headDim: number;
  let hiddenDim: number;
  let feedForwardDim: number;
  let contextLength: number;
  let isMoe = false;
  let activeParamsRatio: number | undefined;

  if (id.includes("llama-3.1-70b") || id.includes("llama3.1-70b") || id.includes("llama-3.3-70b")) {
    numLayers = 80; numKvHeads = 8; headDim = 128; hiddenDim = 8192; feedForwardDim = 28672; contextLength = 131072;
  } else if (id.includes("llama-3.1-8b") || id.includes("llama3.1-8b") || id.includes("llama-3.2-3b")) {
    numLayers = 32; numKvHeads = 8; headDim = 128; hiddenDim = 4096; feedForwardDim = 14336; contextLength = 131072;
  } else if (id.includes("llama-3.2-1b")) {
    numLayers = 16; numKvHeads = 8; headDim = 64; hiddenDim = 2048; feedForwardDim = 8192; contextLength = 131072;
  } else if (id.includes("qwen3-235b") || id.includes("qwen3-235b")) {
    numLayers = 94; numKvHeads = 4; headDim = 256; hiddenDim = 4096; feedForwardDim = 12288; contextLength = 131072; isMoe = true; activeParamsRatio = 0.14;
  } else if (id.includes("qwen3-32b")) {
    numLayers = 64; numKvHeads = 4; headDim = 128; hiddenDim = 5120; feedForwardDim = 17408; contextLength = 131072;
  } else if (id.includes("qwen3-14b") || id.includes("qwen2.5-14b") || id.includes("qwen2.5-14b")) {
    numLayers = 40; numKvHeads = 8; headDim = 128; hiddenDim = 5120; feedForwardDim = 13824; contextLength = 131072;
  } else if (id.includes("qwen3-8b") || id.includes("qwen2.5-7b") || id.includes("qwen2-7b")) {
    numLayers = 32; numKvHeads = 4; headDim = 128; hiddenDim = 4096; feedForwardDim = 12288; contextLength = 131072;
  } else if (id.includes("qwen3-4b") || id.includes("qwen2.5-3b")) {
    numLayers = 36; numKvHeads = 4; headDim = 64; hiddenDim = 2560; feedForwardDim = 7168; contextLength = 32768;
  } else if (id.includes("qwen3-1.7b") || id.includes("qwen2.5-1.5b") || id.includes("qwen2-1.5b")) {
    numLayers = 28; numKvHeads = 6; headDim = 64; hiddenDim = 1536; feedForwardDim = 8960; contextLength = 32768;
  } else if (id.includes("qwen3-0.6b")) {
    numLayers = 28; numKvHeads = 4; headDim = 64; hiddenDim = 1024; feedForwardDim = 3072; contextLength = 32768;
  } else if (id.includes("deepseek-r1-671b") || id.includes("deepseek-v3")) {
    numLayers = 61; numKvHeads = 1; headDim = 256; hiddenDim = 7168; feedForwardDim = 18432; contextLength = 131072; isMoe = true; activeParamsRatio = 0.058;
  } else if (id.includes("deepseek-r1-distill-llama-70b") || id.includes("deepseek-r1-70b")) {
    numLayers = 80; numKvHeads = 8; headDim = 128; hiddenDim = 8192; feedForwardDim = 28672; contextLength = 131072;
  } else if (id.includes("deepseek-r1-distill-qwen-32b")) {
    numLayers = 64; numKvHeads = 4; headDim = 128; hiddenDim = 5120; feedForwardDim = 17408; contextLength = 131072;
  } else if (id.includes("deepseek-r1-distill-qwen-14b")) {
    numLayers = 40; numKvHeads = 8; headDim = 128; hiddenDim = 5120; feedForwardDim = 13824; contextLength = 131072;
  } else if (id.includes("deepseek-r1-distill-qwen-7b") || id.includes("deepseek-r1-distill-llama-8b")) {
    numLayers = 32; numKvHeads = 8; headDim = 128; hiddenDim = 4096; feedForwardDim = 14336; contextLength = 131072;
  } else if (id.includes("mistral-nemo") || id.includes("mistral-small-3") || id.includes("mistral-small-24b")) {
    numLayers = 40; numKvHeads = 8; headDim = 128; hiddenDim = 5120; feedForwardDim = 14336; contextLength = 131072;
  } else if (id.includes("mistral-7b")) {
    numLayers = 32; numKvHeads = 8; headDim = 128; hiddenDim = 4096; feedForwardDim = 14336; contextLength = 32768;
  } else if (id.includes("gemma-3-27b")) {
    numLayers = 62; numKvHeads = 16; headDim = 256; hiddenDim = 4608; feedForwardDim = 16384; contextLength = 131072;
  } else if (id.includes("gemma-3-12b")) {
    numLayers = 48; numKvHeads = 4; headDim = 256; hiddenDim = 3072; feedForwardDim = 16384; contextLength = 131072;
  } else if (id.includes("gemma-3-4b")) {
    numLayers = 34; numKvHeads = 4; headDim = 256; hiddenDim = 2560; feedForwardDim = 10240; contextLength = 131072;
  } else if (id.includes("gemma-3-1b")) {
    numLayers = 22; numKvHeads = 4; headDim = 256; hiddenDim = 1152; feedForwardDim = 4096; contextLength = 32768;
  } else if (id.includes("phi-4") || id.includes("phi-4-mini")) {
    numLayers = 40; numKvHeads = 4; headDim = 96; hiddenDim = 3072; feedForwardDim = 9216; contextLength = 16384;
  } else if (id.includes("command-r")) {
    numLayers = 40; numKvHeads = 8; headDim = 128; hiddenDim = 6144; feedForwardDim = 16384; contextLength = 131072;
  } else if (id.includes("glm-4") || id.includes("chatglm")) {
    numLayers = 40; numKvHeads = 4; headDim = 128; hiddenDim = 4096; feedForwardDim = 13696; contextLength = 131072;
  } else if (id.includes("granite-3.3-8b")) {
    numLayers = 40; numKvHeads = 8; headDim = 128; hiddenDim = 4096; feedForwardDim = 12800; contextLength = 131072;
  } else if (id.includes("granite-3.3-2b")) {
    numLayers = 24; numKvHeads = 4; headDim = 96; hiddenDim = 2048; feedForwardDim = 6400; contextLength = 131072;
  } else {
    // Generic fallback based on parameter count
    numLayers = Math.round(Math.sqrt(numParams / 1e6) * 2.5); // rough heuristic
    numKvHeads = 8;
    headDim = 128;
    hiddenDim = Math.round(Math.sqrt(numParams) * 0.85);
    feedForwardDim = hiddenDim * 3.5;
    contextLength = 8192;
  }

  return {
    numParams,
    numLayers,
    numKvHeads,
    headDim,
    hiddenDim,
    feedForwardDim,
    contextLength,
    isMoe,
    activeParamsRatio,
  };
}

/**
 * Get quantized model size in MB from parameter count and quantization.
 */
export function estimateModelSizeMb(numParams: number, quant: QuantFormat): number {
  const bytesPerParam = QUANT_BYTES[quant] ?? 2;
  return (numParams * bytesPerParam) / (1024 * 1024);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
