//
//  ModelService.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation

/// Service for managing model lifecycle and discovery.
@Observable
final class ModelService {

    // MARK: - Singleton

    static let shared = ModelService()

    // MARK: - Properties

    /// Available models
    var models: [ModelInfo] = []

    /// Currently loaded model
    var activeModel: ActiveModel?

    /// Whether a model is currently loading
    var isLoading: Bool = false

    /// Loading progress (0.0 to 1.0)
    var loadingProgress: Double = 0.0

    /// Loading status message
    var loadingStatus: String?

    /// Error message
    var errorMessage: String?

    // MARK: - Computed Properties

    /// Whether a model is currently active
    var hasActiveModel: Bool {
        activeModel != nil
    }

    // MARK: - Initialization

    private init() {}

    // MARK: - Model Discovery

    /// Fetches available models from the server
    @MainActor
    func fetchModels() async throws {
        do {
            let response: ModelsResponse = try await APIClient.shared.request(.models)
            models = response.models ?? []
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    /// Gets the currently running model from OpenAI-compatible endpoint
    @MainActor
    func getRunningModel() async throws -> OpenAIModelInfo? {
        do {
            let response: OpenAIModelsResponse = try await APIClient.shared.request(.models)
            let runningModel = response.data.first
            if let model = runningModel {
                activeModel = ActiveModel(
                    id: model.id,
                    name: model.root,
                    maxModelLen: model.maxModelLen,
                    status: "running"
                )
            } else {
                activeModel = nil
            }
            errorMessage = nil
            return runningModel
        } catch let error as NetworkError {
            // Connection errors likely mean no model is running
            if case .httpError(let code, _) = error, code == 404 || code == 503 {
                activeModel = nil
                return nil
            }
            errorMessage = error.localizedDescription
            throw error
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    /// Fetches GPU status and metrics
    @MainActor
    func getGPUStatus() async throws -> [GPUMetric] {
        do {
            let response: GPUsResponse = try await APIClient.shared.request(.gpus)
            errorMessage = nil
            return response.gpus
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    // MARK: - Model Lifecycle

    /// Launches a model from a recipe
    /// - Parameter recipeId: The recipe ID to use
    /// - Parameter onProgress: Optional callback for progress updates
    @MainActor
    func launchModel(
        recipeId: String,
        onProgress: ((Double, String) -> Void)? = nil
    ) async throws {
        isLoading = true
        loadingProgress = 0.0
        loadingStatus = "Starting model launch..."

        defer {
            isLoading = false
            loadingProgress = 0.0
            loadingStatus = nil
        }

        do {
            // Start the launch
            let response = try await APIClient.shared.launchModel(recipeId: recipeId)

            guard response.success else {
                throw NetworkError.custom(response.message ?? "Failed to launch model")
            }

            // Poll for ready state
            loadingStatus = "Waiting for model to be ready..."
            loadingProgress = 0.3

            try await waitForModelReady(onProgress: onProgress)

            // Fetch the active model info
            try await fetchActiveModel()

            loadingProgress = 1.0
            loadingStatus = "Model loaded successfully"

        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    /// Waits for the model to be ready
    private func waitForModelReady(
        onProgress: ((Double, String) -> Void)? = nil
    ) async throws {
        var attempts = 0
        let maxAttempts = 120 // 10 minutes with 5 second intervals

        while attempts < maxAttempts {
            do {
                let _: WaitReadyResponse = try await APIClient.shared.request(.waitReady)
                return
            } catch {
                attempts += 1

                let progress = 0.3 + (Double(attempts) / Double(maxAttempts)) * 0.6
                let status = "Loading model... (\(attempts * 5)s)"

                await MainActor.run {
                    self.loadingProgress = progress
                    self.loadingStatus = status
                }

                onProgress?(progress, status)

                try await Task.sleep(nanoseconds: 5_000_000_000) // 5 seconds
            }
        }

        throw NetworkError.timeout
    }

    /// Evicts the current model
    @MainActor
    func evictModel() async throws {
        isLoading = true
        loadingStatus = "Evicting model..."

        defer {
            isLoading = false
            loadingStatus = nil
        }

        do {
            try await APIClient.shared.evictModel()
            activeModel = nil
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    // MARK: - Model Search

    /// Searches models by query
    /// - Parameter query: The search query
    /// - Returns: Matching models
    func searchModels(query: String) -> [ModelInfo] {
        guard !query.isEmpty else { return models }

        let lowercased = query.lowercased()
        return models.filter { model in
            model.id.lowercased().contains(lowercased) ||
            (model.name?.lowercased().contains(lowercased) ?? false)
        }
    }

    /// Filters models by type
    /// - Parameter type: The model type to filter by
    /// - Returns: Filtered models
    func filterModels(byType type: String?) -> [ModelInfo] {
        guard let type = type else { return models }

        return models.filter { $0.type == type }
    }
}

// MARK: - Response Types

struct ModelsResponse: Decodable {
    let models: [ModelInfo]?
    let roots: [StudioModelsRoot]?
    let configuredModelsDir: String?

    enum CodingKeys: String, CodingKey {
        case models, roots
        case configuredModelsDir = "configured_models_dir"
    }
}

struct OpenAIModelsResponse: Decodable {
    let data: [OpenAIModelInfo]
}

struct OpenAIModelInfo: Identifiable, Decodable {
    let id: String
    let root: String?
    let maxModelLen: Int?

    enum CodingKeys: String, CodingKey {
        case id, root
        case maxModelLen = "max_model_len"
    }
}

struct GPUsResponse: Decodable {
    let gpus: [GPUMetric]
}

struct StudioModelsRoot: Identifiable, Decodable {
    let path: String
    let exists: Bool
    let sources: [String]?
    let recipeIds: [String]?

    var id: String { path }

    enum CodingKeys: String, CodingKey {
        case path, exists, sources
        case recipeIds = "recipe_ids"
    }
}

// MARK: - Model Info

struct ModelInfo: Identifiable, Codable {
    let path: String
    let name: String
    let sizeBytes: Int?
    let modifiedAt: Double?
    let architecture: String?
    let quantization: String?
    let contextLength: Int?
    let recipeIds: [String]?
    let hasRecipe: Bool?
    let numHiddenLayers: Int?
    let numKvHeads: Int?
    let hiddenSize: Int?
    let headDim: Int?

    var id: String { path }

    enum CodingKeys: String, CodingKey {
        case path, name, architecture, quantization
        case sizeBytes = "size_bytes"
        case modifiedAt = "modified_at"
        case contextLength = "context_length"
        case recipeIds = "recipe_ids"
        case hasRecipe = "has_recipe"
        case numHiddenLayers = "num_hidden_layers"
        case numKvHeads = "num_kv_heads"
        case hiddenSize = "hidden_size"
        case headDim = "head_dim"
    }

    // Computed properties for display
    var displayName: String {
        name.isEmpty ? shortPath : name
    }

    var shortPath: String {
        if let lastSlash = path.lastIndex(of: "/") {
            return String(path[path.index(after: lastSlash)...])
        }
        return path
    }

    var formattedSize: String {
        guard let bytes = sizeBytes else { return "Unknown" }
        let gb = Double(bytes) / 1_000_000_000
        if gb >= 1 {
            return String(format: "%.1f GB", gb)
        }
        let mb = Double(bytes) / 1_000_000
        return String(format: "%.0f MB", mb)
    }
}

// MARK: - GPU Metric

struct GPUMetric: Identifiable, Codable {
    let index: Int
    let name: String
    let memoryTotal: Int
    let memoryUsed: Int
    let memoryFree: Int
    let utilization: Double
    let temperature: Int?
    let powerDraw: Double?
    let powerLimit: Double?

    var id: Int { index }

    enum CodingKeys: String, CodingKey {
        case index, name, utilization, temperature
        case memoryTotal = "memory_total"
        case memoryUsed = "memory_used"
        case memoryFree = "memory_free"
        case powerDraw = "power_draw"
        case powerLimit = "power_limit"
    }

    // Computed properties
    var memoryTotalGB: Double {
        Double(memoryTotal) / 1024
    }

    var memoryUsedGB: Double {
        Double(memoryUsed) / 1024
    }

    var memoryFreeGB: Double {
        Double(memoryFree) / 1024
    }

    var memoryUsagePercent: Double {
        guard memoryTotal > 0 else { return 0 }
        return Double(memoryUsed) / Double(memoryTotal) * 100
    }

    var formattedMemory: String {
        String(format: "%.1f / %.1f GB", memoryUsedGB, memoryTotalGB)
    }

    var formattedUtilization: String {
        String(format: "%.0f%%", utilization)
    }

    var formattedTemperature: String? {
        guard let temp = temperature else { return nil }
        return "\(temp)C"
    }

    var formattedPower: String? {
        guard let power = powerDraw else { return nil }
        if let limit = powerLimit {
            return String(format: "%.0f / %.0f W", power, limit)
        }
        return String(format: "%.0f W", power)
    }
}

// MARK: - Active Model

struct ActiveModel: Decodable {
    let id: String
    let name: String?
    let maxModelLen: Int?
    let status: String?

    enum CodingKeys: String, CodingKey {
        case id, name, status
        case maxModelLen = "max_model_len"
    }
}

// MARK: - Model Category

enum ModelCategory: String, CaseIterable, Identifiable {
    case all = "All"
    case chat = "Chat"
    case completion = "Completion"
    case embedding = "Embedding"
    case vision = "Vision"
    case code = "Code"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .all: return "square.grid.2x2"
        case .chat: return "bubble.left.and.bubble.right"
        case .completion: return "text.cursor"
        case .embedding: return "arrow.triangle.branch"
        case .vision: return "eye"
        case .code: return "chevron.left.forwardslash.chevron.right"
        }
    }
}
