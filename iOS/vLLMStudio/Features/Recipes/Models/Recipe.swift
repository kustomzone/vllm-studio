import Foundation

// MARK: - Recipe Status

enum RecipeStatus: String, Codable, CaseIterable {
    case ready = "ready"
    case running = "running"
    case starting = "starting"
    case stopped = "stopped"
    case error = "error"

    var displayName: String {
        switch self {
        case .ready: return "Ready"
        case .running: return "Running"
        case .starting: return "Starting"
        case .stopped: return "Stopped"
        case .error: return "Error"
        }
    }
}

// MARK: - Backend Type

enum BackendType: String, Codable, CaseIterable {
    case vllm = "vllm"
    case sglang = "sglang"

    var displayName: String {
        switch self {
        case .vllm: return "vLLM"
        case .sglang: return "SGLang"
        }
    }
}

// MARK: - Tokenizer Mode

enum TokenizerMode: String, Codable, CaseIterable {
    case auto = "auto"
    case slow = "slow"
    case mistral = "mistral"
}

// MARK: - Distributed Executor Backend

enum DistributedExecutorBackend: String, Codable, CaseIterable {
    case ray = "ray"
    case mp = "mp"
}

// MARK: - Scheduling Policy

enum SchedulingPolicy: String, Codable, CaseIterable {
    case fcfs = "fcfs"
    case priority = "priority"
}

// MARK: - Spec Decoding Acceptance Method

enum SpecDecodingAcceptanceMethod: String, Codable, CaseIterable {
    case rejectionSampler = "rejection_sampler"
    case typicalAcceptanceSampler = "typical_acceptance_sampler"
}

// MARK: - Chat Template Content Format

enum ChatTemplateContentFormat: String, Codable, CaseIterable {
    case auto = "auto"
    case string = "string"
    case openai = "openai"
}

// MARK: - Sort Order

enum RecipeSortOrder: String, CaseIterable {
    case nameAsc = "name_asc"
    case nameDesc = "name_desc"
    case recentlyUsed = "recently_used"
    case modelPath = "model_path"

    var displayName: String {
        switch self {
        case .nameAsc: return "Name (A-Z)"
        case .nameDesc: return "Name (Z-A)"
        case .recentlyUsed: return "Recently Used"
        case .modelPath: return "Model Path"
        }
    }

    var systemImage: String {
        switch self {
        case .nameAsc: return "arrow.up"
        case .nameDesc: return "arrow.down"
        case .recentlyUsed: return "clock"
        case .modelPath: return "folder"
        }
    }
}

// MARK: - Recipe Model

struct Recipe: Identifiable, Codable, Hashable {
    // Core identification
    var id: String
    var name: String
    var modelPath: String
    var backend: BackendType?

    // Server settings
    var host: String?
    var port: Int?
    var servedModelName: String?
    var apiKey: String?

    // Model loading
    var tokenizer: String?
    var tokenizerMode: TokenizerMode?
    var trustRemoteCode: Bool?
    var dtype: String?
    var seed: Int?
    var revision: String?
    var codeRevision: String?
    var loadFormat: String?

    // Quantization
    var quantization: String?
    var quantizationParamPath: String?

    // Parallelism
    var tensorParallelSize: Int?
    var tp: Int?
    var pipelineParallelSize: Int?
    var pp: Int?
    var dataParallelSize: Int?
    var distributedExecutorBackend: DistributedExecutorBackend?
    var enableExpertParallel: Bool?

    // Memory & KV Cache
    var gpuMemoryUtilization: Double?
    var maxModelLen: Int?
    var kvCacheDtype: String?
    var blockSize: Int?
    var swapSpace: Int?
    var cpuOffloadGb: Double?
    var enablePrefixCaching: Bool?
    var numGpuBlocksOverride: Int?

    // Scheduler & Batching
    var maxNumSeqs: Int?
    var maxNumBatchedTokens: Int?
    var schedulingPolicy: SchedulingPolicy?
    var enableChunkedPrefill: Bool?
    var maxPaddings: Int?

    // Performance tuning
    var enforceEager: Bool?
    var disableCudaGraph: Bool?
    var cudaGraphMaxBs: Int?
    var disableCustomAllReduce: Bool?
    var useV2BlockManager: Bool?
    var compilationConfig: String?

    // Speculative decoding
    var speculativeModel: String?
    var speculativeModelQuantization: String?
    var numSpeculativeTokens: Int?
    var speculativeDraftTensorParallelSize: Int?
    var speculativeMaxModelLen: Int?
    var speculativeDisableMqaScorer: Bool?
    var specDecodingAcceptanceMethod: SpecDecodingAcceptanceMethod?
    var typicalAcceptanceSamplerPosteriorThreshold: Double?
    var typicalAcceptanceSamplerPosteriorAlpha: Double?
    var ngramPromptLookupMax: Int?
    var ngramPromptLookupMin: Int?

    // Reasoning & Tool calling
    var reasoningParser: String?
    var enableThinking: Bool?
    var thinkingBudget: Int?
    var toolCallParser: String?
    var enableAutoToolChoice: Bool?
    var toolParserPlugin: String?

    // Guided decoding
    var guidedDecodingBackend: String?

    // Chat & templates
    var chatTemplate: String?
    var chatTemplateContentFormat: ChatTemplateContentFormat?
    var responseRole: String?

    // LoRA
    var enableLora: Bool?
    var maxLoras: Int?
    var maxLoraRank: Int?
    var loraExtraVocabSize: Int?
    var loraDtype: String?
    var longLoraScalingFactors: String?
    var fullyShardedLoras: Bool?

    // Multimodal
    var imageInputType: String?
    var imageTokenId: Int?
    var imageInputShape: String?
    var imageFeatureSize: Int?
    var limitMmPerPrompt: String?
    var mmProcessorKwargs: String?
    var allowedLocalMediaPath: String?

    // Logging & debugging
    var disableLogRequests: Bool?
    var disableLogStats: Bool?
    var maxLogLen: Int?
    var uvicornLogLevel: String?

    // Frontend
    var disableFrontendMultiprocessing: Bool?
    var enableRequestIdHeaders: Bool?
    var disableFastapiDocs: Bool?
    var returnTokensAsTokenIds: Bool?

    // Other
    var pythonPath: String?
    var extraArgs: [String: AnyCodable]?
    var envVars: [String: String]?

    // Runtime status (not persisted)
    var status: RecipeStatus = .stopped

    // CodingKeys for snake_case API
    enum CodingKeys: String, CodingKey {
        case id, name, backend, host, port, tokenizer, dtype, seed, revision, quantization
        case modelPath = "model_path"
        case servedModelName = "served_model_name"
        case apiKey = "api_key"
        case tokenizerMode = "tokenizer_mode"
        case trustRemoteCode = "trust_remote_code"
        case codeRevision = "code_revision"
        case loadFormat = "load_format"
        case quantizationParamPath = "quantization_param_path"
        case tensorParallelSize = "tensor_parallel_size"
        case tp, pp
        case pipelineParallelSize = "pipeline_parallel_size"
        case dataParallelSize = "data_parallel_size"
        case distributedExecutorBackend = "distributed_executor_backend"
        case enableExpertParallel = "enable_expert_parallel"
        case gpuMemoryUtilization = "gpu_memory_utilization"
        case maxModelLen = "max_model_len"
        case kvCacheDtype = "kv_cache_dtype"
        case blockSize = "block_size"
        case swapSpace = "swap_space"
        case cpuOffloadGb = "cpu_offload_gb"
        case enablePrefixCaching = "enable_prefix_caching"
        case numGpuBlocksOverride = "num_gpu_blocks_override"
        case maxNumSeqs = "max_num_seqs"
        case maxNumBatchedTokens = "max_num_batched_tokens"
        case schedulingPolicy = "scheduling_policy"
        case enableChunkedPrefill = "enable_chunked_prefill"
        case maxPaddings = "max_paddings"
        case enforceEager = "enforce_eager"
        case disableCudaGraph = "disable_cuda_graph"
        case cudaGraphMaxBs = "cuda_graph_max_bs"
        case disableCustomAllReduce = "disable_custom_all_reduce"
        case useV2BlockManager = "use_v2_block_manager"
        case compilationConfig = "compilation_config"
        case speculativeModel = "speculative_model"
        case speculativeModelQuantization = "speculative_model_quantization"
        case numSpeculativeTokens = "num_speculative_tokens"
        case speculativeDraftTensorParallelSize = "speculative_draft_tensor_parallel_size"
        case speculativeMaxModelLen = "speculative_max_model_len"
        case speculativeDisableMqaScorer = "speculative_disable_mqa_scorer"
        case specDecodingAcceptanceMethod = "spec_decoding_acceptance_method"
        case typicalAcceptanceSamplerPosteriorThreshold = "typical_acceptance_sampler_posterior_threshold"
        case typicalAcceptanceSamplerPosteriorAlpha = "typical_acceptance_sampler_posterior_alpha"
        case ngramPromptLookupMax = "ngram_prompt_lookup_max"
        case ngramPromptLookupMin = "ngram_prompt_lookup_min"
        case reasoningParser = "reasoning_parser"
        case enableThinking = "enable_thinking"
        case thinkingBudget = "thinking_budget"
        case toolCallParser = "tool_call_parser"
        case enableAutoToolChoice = "enable_auto_tool_choice"
        case toolParserPlugin = "tool_parser_plugin"
        case guidedDecodingBackend = "guided_decoding_backend"
        case chatTemplate = "chat_template"
        case chatTemplateContentFormat = "chat_template_content_format"
        case responseRole = "response_role"
        case enableLora = "enable_lora"
        case maxLoras = "max_loras"
        case maxLoraRank = "max_lora_rank"
        case loraExtraVocabSize = "lora_extra_vocab_size"
        case loraDtype = "lora_dtype"
        case longLoraScalingFactors = "long_lora_scaling_factors"
        case fullyShardedLoras = "fully_sharded_loras"
        case imageInputType = "image_input_type"
        case imageTokenId = "image_token_id"
        case imageInputShape = "image_input_shape"
        case imageFeatureSize = "image_feature_size"
        case limitMmPerPrompt = "limit_mm_per_prompt"
        case mmProcessorKwargs = "mm_processor_kwargs"
        case allowedLocalMediaPath = "allowed_local_media_path"
        case disableLogRequests = "disable_log_requests"
        case disableLogStats = "disable_log_stats"
        case maxLogLen = "max_log_len"
        case uvicornLogLevel = "uvicorn_log_level"
        case disableFrontendMultiprocessing = "disable_frontend_multiprocessing"
        case enableRequestIdHeaders = "enable_request_id_headers"
        case disableFastapiDocs = "disable_fastapi_docs"
        case returnTokensAsTokenIds = "return_tokens_as_token_ids"
        case pythonPath = "python_path"
        case extraArgs = "extra_args"
        case envVars = "env_vars"
    }

    init(
        id: String = UUID().uuidString,
        name: String = "",
        modelPath: String = "",
        backend: BackendType? = .vllm,
        status: RecipeStatus = .stopped
    ) {
        self.id = id
        self.name = name
        self.modelPath = modelPath
        self.backend = backend
        self.status = status
    }

    // Computed property for effective tensor parallel size
    var effectiveTensorParallelSize: Int {
        tp ?? tensorParallelSize ?? 1
    }

    // Computed property for effective pipeline parallel size
    var effectivePipelineParallelSize: Int {
        pp ?? pipelineParallelSize ?? 1
    }

    // Total GPU count
    var totalGpuCount: Int {
        effectiveTensorParallelSize * effectivePipelineParallelSize
    }

    // Display name for the model
    var modelDisplayName: String {
        modelPath.split(separator: "/").last.map(String.init) ?? modelPath
    }
}

// MARK: - AnyCodable Helper

struct AnyCodable: Codable, Hashable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self.value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            self.value = bool
        } else if let int = try? container.decode(Int.self) {
            self.value = int
        } else if let double = try? container.decode(Double.self) {
            self.value = double
        } else if let string = try? container.decode(String.self) {
            self.value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            self.value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            self.value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode AnyCodable")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case is NSNull:
            try container.encodeNil()
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: container.codingPath, debugDescription: "Cannot encode AnyCodable"))
        }
    }

    static func == (lhs: AnyCodable, rhs: AnyCodable) -> Bool {
        String(describing: lhs.value) == String(describing: rhs.value)
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(String(describing: value))
    }
}

// MARK: - Recipe Extensions

extension Recipe {
    /// Generate shell command from recipe
    func toCommand() -> String {
        var lines: [String] = []

        let totalGpus = totalGpuCount
        if totalGpus > 1 {
            let gpuIds = (0..<totalGpus).map(String.init).joined(separator: ",")
            lines.append("CUDA_VISIBLE_DEVICES=\(gpuIds) \\")
        }

        let backendType = backend ?? .vllm
        if backendType == .sglang {
            lines.append("python -m sglang.launch_server \\")
            lines.append("  --model-path \(modelPath) \\")
        } else {
            lines.append("vllm serve \(modelPath) \\")
        }

        // Add flags
        var args: [(String, Any?)] = [
            ("--tensor-parallel-size", effectiveTensorParallelSize > 1 ? effectiveTensorParallelSize : nil),
            ("--pipeline-parallel-size", effectivePipelineParallelSize > 1 ? effectivePipelineParallelSize : nil),
            ("--dtype", dtype),
            ("--max-model-len", maxModelLen),
            ("--block-size", blockSize),
            ("--max-num-seqs", maxNumSeqs),
            ("--max-num-batched-tokens", maxNumBatchedTokens),
            ("--gpu-memory-utilization", gpuMemoryUtilization),
            ("--swap-space", swapSpace),
            ("--kv-cache-dtype", kvCacheDtype),
            ("--quantization", quantization),
            ("--reasoning-parser", reasoningParser),
            ("--tool-call-parser", toolCallParser),
            ("--served-model-name", servedModelName),
        ]

        // Boolean flags
        if enableAutoToolChoice == true { args.append(("--enable-auto-tool-choice", true)) }
        if disableCustomAllReduce == true { args.append(("--disable-custom-all-reduce", true)) }
        if trustRemoteCode == true { args.append(("--trust-remote-code", true)) }
        if disableLogRequests == true { args.append(("--disable-log-requests", true)) }
        if enableExpertParallel == true { args.append(("--enable-expert-parallel", true)) }

        for (flag, value) in args {
            guard let value = value else { continue }
            if let boolValue = value as? Bool {
                if boolValue {
                    lines.append("  \(flag) \\")
                }
            } else {
                lines.append("  \(flag) \(value) \\")
            }
        }

        lines.append("  --host \(host ?? "0.0.0.0") \\")
        lines.append("  --port \(port ?? 8000)")

        return lines.joined(separator: "\n")
    }

    /// Parse command string into recipe
    static func fromCommand(_ command: String, existingRecipe: Recipe? = nil) -> Recipe {
        var recipe = existingRecipe ?? Recipe()

        let normalizedCmd = command
            .replacingOccurrences(of: "\\\n", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)

        if normalizedCmd.contains("sglang") {
            recipe.backend = .sglang
        } else {
            recipe.backend = .vllm
        }

        // Parse model path
        if let modelMatch = normalizedCmd.range(of: "(?:vllm serve|--model-path|--model)\\s+(/[^\\s]+)", options: .regularExpression) {
            let matched = String(normalizedCmd[modelMatch])
            let pathStart = matched.lastIndex(of: " ").map { matched.index(after: $0) } ?? matched.startIndex
            recipe.modelPath = String(matched[pathStart...])
        }

        // Parse flags using regex
        let flagPattern = try! NSRegularExpression(pattern: "--([\\w-]+)(?:\\s+([^\\s-][^\\s]*))?")
        let matches = flagPattern.matches(in: normalizedCmd, range: NSRange(normalizedCmd.startIndex..., in: normalizedCmd))

        for match in matches {
            guard let flagRange = Range(match.range(at: 1), in: normalizedCmd) else { continue }
            let flag = String(normalizedCmd[flagRange])
            let value: String? = {
                guard match.range(at: 2).location != NSNotFound,
                      let valueRange = Range(match.range(at: 2), in: normalizedCmd) else { return nil }
                return String(normalizedCmd[valueRange])
            }()

            switch flag {
            case "tensor-parallel-size":
                recipe.tp = Int(value ?? "")
                recipe.tensorParallelSize = recipe.tp
            case "pipeline-parallel-size":
                recipe.pp = Int(value ?? "")
                recipe.pipelineParallelSize = recipe.pp
            case "max-model-len":
                recipe.maxModelLen = Int(value ?? "")
            case "gpu-memory-utilization":
                recipe.gpuMemoryUtilization = Double(value ?? "")
            case "max-num-seqs":
                recipe.maxNumSeqs = Int(value ?? "")
            case "max-num-batched-tokens":
                recipe.maxNumBatchedTokens = Int(value ?? "")
            case "kv-cache-dtype":
                recipe.kvCacheDtype = value
            case "quantization":
                recipe.quantization = value
            case "dtype":
                recipe.dtype = value
            case "tool-call-parser":
                recipe.toolCallParser = value
            case "served-model-name":
                recipe.servedModelName = value
            case "port":
                recipe.port = Int(value ?? "")
            case "block-size":
                recipe.blockSize = Int(value ?? "")
            case "swap-space":
                recipe.swapSpace = Int(value ?? "")
            case "reasoning-parser":
                recipe.reasoningParser = value
            case "enable-auto-tool-choice":
                recipe.enableAutoToolChoice = true
            case "disable-custom-all-reduce":
                recipe.disableCustomAllReduce = true
            case "trust-remote-code":
                recipe.trustRemoteCode = true
            case "disable-log-requests":
                recipe.disableLogRequests = true
            case "enable-expert-parallel":
                recipe.enableExpertParallel = true
            default:
                break
            }
        }

        // Auto-generate ID and name if needed
        if recipe.id.isEmpty && !recipe.modelPath.isEmpty {
            recipe.id = Recipe.slugify(recipe.modelPath.split(separator: "/").last.map(String.init) ?? "new-recipe")
        }
        if recipe.name.isEmpty && !recipe.modelPath.isEmpty {
            recipe.name = recipe.modelPath.split(separator: "/").last.map(String.init) ?? "New Recipe"
        }

        return recipe
    }

    /// Convert string to URL-safe slug
    static func slugify(_ input: String) -> String {
        input
            .trimmingCharacters(in: .whitespaces)
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }
}

// MARK: - Sample Data

extension Recipe {
    static let sample = Recipe(
        id: "llama-3-70b",
        name: "Llama 3 70B",
        modelPath: "/models/meta-llama/Meta-Llama-3-70B-Instruct",
        backend: .vllm,
        status: .ready
    )

    static let samples: [Recipe] = [
        Recipe(
            id: "llama-3-70b",
            name: "Llama 3 70B",
            modelPath: "/models/meta-llama/Meta-Llama-3-70B-Instruct",
            backend: .vllm,
            status: .running
        ),
        Recipe(
            id: "qwen-2-72b",
            name: "Qwen 2 72B",
            modelPath: "/models/Qwen/Qwen2-72B-Instruct",
            backend: .vllm,
            status: .ready
        ),
        Recipe(
            id: "deepseek-r1",
            name: "DeepSeek R1",
            modelPath: "/models/deepseek-ai/DeepSeek-R1",
            backend: .sglang,
            status: .stopped
        ),
    ]
}
