import Foundation

// MARK: - Task Types

enum TaskType: String, Codable, CaseIterable, Identifiable {
    case textGeneration = "text-generation"
    case chatCompletion = "chat-completion"
    case codeGeneration = "code-generation"
    case embedding = "embedding"
    case imageGeneration = "image-generation"
    case speechToText = "speech-to-text"
    case textToSpeech = "text-to-speech"
    case translation = "translation"
    case summarization = "summarization"
    case questionAnswering = "question-answering"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .textGeneration: return "Text Generation"
        case .chatCompletion: return "Chat"
        case .codeGeneration: return "Code"
        case .embedding: return "Embedding"
        case .imageGeneration: return "Image"
        case .speechToText: return "Speech to Text"
        case .textToSpeech: return "Text to Speech"
        case .translation: return "Translation"
        case .summarization: return "Summarization"
        case .questionAnswering: return "Q&A"
        }
    }

    var iconName: String {
        switch self {
        case .textGeneration: return "text.alignleft"
        case .chatCompletion: return "bubble.left.and.bubble.right"
        case .codeGeneration: return "chevron.left.forwardslash.chevron.right"
        case .embedding: return "cube.transparent"
        case .imageGeneration: return "photo"
        case .speechToText: return "waveform"
        case .textToSpeech: return "speaker.wave.2"
        case .translation: return "globe"
        case .summarization: return "doc.text"
        case .questionAnswering: return "questionmark.bubble"
        }
    }
}

// MARK: - Provider

enum Provider: String, Codable, CaseIterable, Identifiable {
    case meta = "meta"
    case mistral = "mistral"
    case google = "google"
    case microsoft = "microsoft"
    case openai = "openai"
    case anthropic = "anthropic"
    case huggingFace = "huggingface"
    case stability = "stability"
    case cohere = "cohere"
    case alibaba = "alibaba"
    case deepseek = "deepseek"
    case qwen = "qwen"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .meta: return "Meta"
        case .mistral: return "Mistral AI"
        case .google: return "Google"
        case .microsoft: return "Microsoft"
        case .openai: return "OpenAI"
        case .anthropic: return "Anthropic"
        case .huggingFace: return "Hugging Face"
        case .stability: return "Stability AI"
        case .cohere: return "Cohere"
        case .alibaba: return "Alibaba"
        case .deepseek: return "DeepSeek"
        case .qwen: return "Qwen"
        }
    }
}

// MARK: - Sort Order

enum SortOrder: String, CaseIterable, Identifiable {
    case popularity
    case downloads
    case newest
    case name
    case size

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .popularity: return "Most Popular"
        case .downloads: return "Most Downloads"
        case .newest: return "Newest"
        case .name: return "Name"
        case .size: return "Size"
        }
    }

    var iconName: String {
        switch self {
        case .popularity: return "flame"
        case .downloads: return "arrow.down.circle"
        case .newest: return "clock"
        case .name: return "textformat"
        case .size: return "square.stack.3d.up"
        }
    }
}

// MARK: - Model Size

enum ModelSize: String, Codable, CaseIterable, Identifiable {
    case tiny = "tiny"       // < 1B
    case small = "small"     // 1-7B
    case medium = "medium"   // 7-30B
    case large = "large"     // 30-70B
    case xlarge = "xlarge"   // > 70B

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .tiny: return "Tiny (<1B)"
        case .small: return "Small (1-7B)"
        case .medium: return "Medium (7-30B)"
        case .large: return "Large (30-70B)"
        case .xlarge: return "XL (>70B)"
        }
    }

    var colorHex: String {
        switch self {
        case .tiny: return "#22c55e"    // Green
        case .small: return "#3b82f6"   // Blue
        case .medium: return "#f59e0b"  // Amber
        case .large: return "#ef4444"   // Red
        case .xlarge: return "#a855f7"  // Purple
        }
    }
}

// MARK: - Discover Model

struct DiscoverModel: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let provider: Provider
    let description: String
    let taskTypes: [TaskType]
    let size: ModelSize
    let parameterCount: String
    let downloads: Int
    let likes: Int
    let updatedAt: Date
    let license: String?
    let contextLength: Int?
    let quantizations: [String]?

    // Computed properties
    var formattedDownloads: String {
        if downloads >= 1_000_000 {
            return String(format: "%.1fM", Double(downloads) / 1_000_000)
        } else if downloads >= 1_000 {
            return String(format: "%.1fK", Double(downloads) / 1_000)
        }
        return "\(downloads)"
    }

    var formattedLikes: String {
        if likes >= 1_000_000 {
            return String(format: "%.1fM", Double(likes) / 1_000_000)
        } else if likes >= 1_000 {
            return String(format: "%.1fK", Double(likes) / 1_000)
        }
        return "\(likes)"
    }
}

// MARK: - Sample Data

extension DiscoverModel {
    static let sampleModels: [DiscoverModel] = [
        DiscoverModel(
            id: "meta-llama-3.1-8b",
            name: "Llama 3.1 8B Instruct",
            provider: .meta,
            description: "Meta's latest Llama model with 8B parameters, optimized for instruction following and chat applications.",
            taskTypes: [.textGeneration, .chatCompletion],
            size: .small,
            parameterCount: "8B",
            downloads: 2_500_000,
            likes: 15_000,
            updatedAt: Date().addingTimeInterval(-86400 * 7),
            license: "Meta Llama 3.1 Community",
            contextLength: 128_000,
            quantizations: ["fp16", "int8", "int4"]
        ),
        DiscoverModel(
            id: "meta-llama-3.1-70b",
            name: "Llama 3.1 70B Instruct",
            provider: .meta,
            description: "Large-scale language model with exceptional reasoning and coding capabilities.",
            taskTypes: [.textGeneration, .chatCompletion, .codeGeneration],
            size: .large,
            parameterCount: "70B",
            downloads: 1_800_000,
            likes: 12_500,
            updatedAt: Date().addingTimeInterval(-86400 * 5),
            license: "Meta Llama 3.1 Community",
            contextLength: 128_000,
            quantizations: ["fp16", "int8", "int4", "GPTQ", "AWQ"]
        ),
        DiscoverModel(
            id: "mistral-7b-instruct",
            name: "Mistral 7B Instruct v0.3",
            provider: .mistral,
            description: "Efficient and powerful 7B instruction-tuned model from Mistral AI.",
            taskTypes: [.textGeneration, .chatCompletion],
            size: .small,
            parameterCount: "7B",
            downloads: 3_200_000,
            likes: 18_000,
            updatedAt: Date().addingTimeInterval(-86400 * 14),
            license: "Apache 2.0",
            contextLength: 32_000,
            quantizations: ["fp16", "int8", "int4"]
        ),
        DiscoverModel(
            id: "codellama-34b",
            name: "CodeLlama 34B Instruct",
            provider: .meta,
            description: "Specialized code generation model trained on extensive code datasets.",
            taskTypes: [.codeGeneration, .textGeneration],
            size: .medium,
            parameterCount: "34B",
            downloads: 950_000,
            likes: 8_200,
            updatedAt: Date().addingTimeInterval(-86400 * 30),
            license: "Meta Llama 2 Community",
            contextLength: 16_000,
            quantizations: ["fp16", "int8", "GPTQ"]
        ),
        DiscoverModel(
            id: "deepseek-coder-33b",
            name: "DeepSeek Coder 33B Instruct",
            provider: .deepseek,
            description: "State-of-the-art code generation model with excellent performance across multiple languages.",
            taskTypes: [.codeGeneration, .chatCompletion],
            size: .medium,
            parameterCount: "33B",
            downloads: 720_000,
            likes: 6_500,
            updatedAt: Date().addingTimeInterval(-86400 * 10),
            license: "DeepSeek License",
            contextLength: 16_000,
            quantizations: ["fp16", "int8", "int4"]
        ),
        DiscoverModel(
            id: "qwen-72b-chat",
            name: "Qwen 2 72B Chat",
            provider: .qwen,
            description: "Alibaba's powerful multilingual chat model with strong reasoning capabilities.",
            taskTypes: [.textGeneration, .chatCompletion, .translation],
            size: .large,
            parameterCount: "72B",
            downloads: 650_000,
            likes: 5_800,
            updatedAt: Date().addingTimeInterval(-86400 * 3),
            license: "Qwen License",
            contextLength: 32_000,
            quantizations: ["fp16", "int8", "GPTQ", "AWQ"]
        ),
        DiscoverModel(
            id: "bge-large-en",
            name: "BGE Large English v1.5",
            provider: .huggingFace,
            description: "High-quality text embedding model optimized for retrieval and semantic search.",
            taskTypes: [.embedding],
            size: .tiny,
            parameterCount: "335M",
            downloads: 4_500_000,
            likes: 22_000,
            updatedAt: Date().addingTimeInterval(-86400 * 60),
            license: "MIT",
            contextLength: 512,
            quantizations: nil
        ),
        DiscoverModel(
            id: "mixtral-8x7b",
            name: "Mixtral 8x7B Instruct",
            provider: .mistral,
            description: "Sparse mixture of experts model delivering excellent performance with efficient inference.",
            taskTypes: [.textGeneration, .chatCompletion, .codeGeneration],
            size: .medium,
            parameterCount: "47B (active 13B)",
            downloads: 1_200_000,
            likes: 9_800,
            updatedAt: Date().addingTimeInterval(-86400 * 20),
            license: "Apache 2.0",
            contextLength: 32_000,
            quantizations: ["fp16", "int8", "int4", "GPTQ"]
        )
    ]
}
