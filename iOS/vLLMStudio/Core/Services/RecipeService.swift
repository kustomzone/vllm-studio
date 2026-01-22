//
//  RecipeService.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation

/// Service for managing vLLM recipes (model configurations).
@Observable
final class RecipeService {

    // MARK: - Singleton

    static let shared = RecipeService()

    // MARK: - Properties

    /// All recipes
    var recipes: [Recipe] = []

    /// Currently loading recipe ID
    var loadingRecipeId: String?

    /// Loading state
    var isLoading: Bool = false

    /// Error message
    var errorMessage: String?

    // MARK: - Computed Properties

    /// Pinned recipes
    var pinnedRecipes: [Recipe] {
        let pinnedIds = UserDefaultsManager.shared.pinnedRecipeIds
        return recipes.filter { pinnedIds.contains($0.id) }
    }

    /// Unpinned recipes
    var unpinnedRecipes: [Recipe] {
        let pinnedIds = UserDefaultsManager.shared.pinnedRecipeIds
        return recipes.filter { !pinnedIds.contains($0.id) }
    }

    /// Currently active recipe
    var activeRecipe: Recipe? {
        recipes.first { $0.isActive }
    }

    // MARK: - Initialization

    private init() {}

    // MARK: - CRUD Operations

    /// Fetches all recipes from the server
    @MainActor
    func fetchRecipes() async throws {
        isLoading = true
        defer { isLoading = false }

        do {
            recipes = try await APIClient.shared.fetchRecipes()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    /// Gets a single recipe by ID
    /// - Parameter id: The recipe ID
    /// - Returns: The recipe
    @MainActor
    func getRecipe(id: String) async throws -> Recipe {
        try await APIClient.shared.request(.recipe(id: id))
    }

    /// Creates a new recipe
    /// - Parameter recipe: The recipe to create
    /// - Returns: The created recipe
    @MainActor
    func createRecipe(_ recipe: CreateRecipeRequest) async throws -> Recipe {
        let created: Recipe = try await APIClient.shared.request(
            .createRecipe,
            body: recipe
        )
        recipes.append(created)
        return created
    }

    /// Updates an existing recipe
    /// - Parameters:
    ///   - id: The recipe ID
    ///   - recipe: The updated recipe data
    /// - Returns: The updated recipe
    @MainActor
    func updateRecipe(id: String, _ recipe: UpdateRecipeRequest) async throws -> Recipe {
        let updated: Recipe = try await APIClient.shared.request(
            .updateRecipe(id: id),
            body: recipe
        )

        if let index = recipes.firstIndex(where: { $0.id == id }) {
            recipes[index] = updated
        }

        return updated
    }

    /// Deletes a recipe
    /// - Parameter id: The recipe ID to delete
    @MainActor
    func deleteRecipe(id: String) async throws {
        try await APIClient.shared.requestNoContent(.deleteRecipe(id: id))
        recipes.removeAll { $0.id == id }
        UserDefaultsManager.shared.unpinRecipe(id: id)
    }

    // MARK: - Model Lifecycle

    /// Launches a model from a recipe
    /// - Parameters:
    ///   - id: The recipe ID to launch
    ///   - force: Whether to force evict any running model first
    @MainActor
    func launchRecipe(id: String, force: Bool = false) async throws {
        loadingRecipeId = id

        do {
            let response: LaunchResponse = try await APIClient.shared.request(
                .launch(recipeId: id, force: force)
            )

            if response.success {
                // Update the recipe status
                if let index = recipes.firstIndex(where: { $0.id == id }) {
                    recipes[index].status = .running
                }
                // Mark other recipes as stopped
                for i in recipes.indices where recipes[i].id != id {
                    recipes[i].status = .stopped
                }
            }

            loadingRecipeId = nil

        } catch {
            loadingRecipeId = nil
            throw error
        }
    }

    /// Waits for the model to be ready after launch
    /// - Parameter timeout: Timeout in seconds (default 300)
    @MainActor
    func waitForReady(timeout: Int = 300) async throws {
        let _: WaitReadyResponse = try await APIClient.shared.request(
            .waitReady(timeout: timeout)
        )
    }

    /// Evicts the currently loaded model
    /// - Parameter force: Whether to force eviction
    @MainActor
    func evictCurrentModel(force: Bool = false) async throws {
        let _: EvictResponse = try await APIClient.shared.request(
            .evict(force: force)
        )

        // Mark all recipes as stopped
        for i in recipes.indices {
            recipes[i].status = .stopped
        }
    }

    // MARK: - Pin Management

    /// Toggles the pin status of a recipe
    /// - Parameter id: The recipe ID
    func togglePin(id: String) {
        if UserDefaultsManager.shared.isRecipePinned(id: id) {
            UserDefaultsManager.shared.unpinRecipe(id: id)
        } else {
            UserDefaultsManager.shared.pinRecipe(id: id)
        }
    }

    /// Checks if a recipe is pinned
    /// - Parameter id: The recipe ID
    /// - Returns: True if pinned
    func isPinned(id: String) -> Bool {
        UserDefaultsManager.shared.isRecipePinned(id: id)
    }

    // MARK: - Search & Filter

    /// Filters recipes by search query
    /// - Parameter query: The search query
    /// - Returns: Filtered recipes
    func searchRecipes(query: String) -> [Recipe] {
        guard !query.isEmpty else { return recipes }

        let lowercased = query.lowercased()
        return recipes.filter { recipe in
            recipe.name.lowercased().contains(lowercased) ||
            recipe.modelName.lowercased().contains(lowercased) ||
            (recipe.description?.lowercased().contains(lowercased) ?? false)
        }
    }
}

// MARK: - Recipe Model

/// Recipe (model launch configuration) matching the vLLM 0.14+ structure
struct Recipe: Identifiable, Codable {
    let id: String
    var name: String
    var modelPath: String
    var backend: String?  // "vllm" or "sglang"
    var status: RecipeStatus?

    // Server settings
    var host: String?
    var port: Int?
    var servedModelName: String?
    var apiKey: String?

    // Model loading
    var tokenizer: String?
    var tokenizerMode: String?
    var trustRemoteCode: Bool?
    var dtype: String?
    var seed: Int?
    var revision: String?
    var loadFormat: String?

    // Quantization
    var quantization: String?
    var quantizationParamPath: String?

    // Parallelism
    var tensorParallelSize: Int?
    var pipelineParallelSize: Int?
    var dataParallelSize: Int?
    var distributedExecutorBackend: String?

    // Memory & KV Cache
    var gpuMemoryUtilization: Double?
    var maxModelLen: Int?
    var kvCacheDtype: String?
    var blockSize: Int?
    var swapSpace: Int?
    var cpuOffloadGb: Int?
    var enablePrefixCaching: Bool?

    // Scheduler & Batching
    var maxNumSeqs: Int?
    var maxNumBatchedTokens: Int?
    var schedulingPolicy: String?
    var enableChunkedPrefill: Bool?

    // Performance tuning
    var enforceEager: Bool?
    var disableCudaGraph: Bool?

    // Speculative decoding
    var speculativeModel: String?
    var numSpeculativeTokens: Int?

    // Reasoning & Tool calling
    var reasoningParser: String?
    var enableThinking: Bool?
    var thinkingBudget: Int?
    var toolCallParser: String?
    var enableAutoToolChoice: Bool?

    // Chat & templates
    var chatTemplate: String?

    // LoRA
    var enableLora: Bool?
    var maxLoras: Int?
    var maxLoraRank: Int?

    // Additional arguments
    var extraArgs: [String: String]?
    var envVars: [String: String]?

    // Coding keys for snake_case conversion
    enum CodingKeys: String, CodingKey {
        case id, name, backend, status, host, port, tokenizer, dtype, seed, revision, quantization
        case modelPath = "model_path"
        case servedModelName = "served_model_name"
        case apiKey = "api_key"
        case tokenizerMode = "tokenizer_mode"
        case trustRemoteCode = "trust_remote_code"
        case loadFormat = "load_format"
        case quantizationParamPath = "quantization_param_path"
        case tensorParallelSize = "tensor_parallel_size"
        case pipelineParallelSize = "pipeline_parallel_size"
        case dataParallelSize = "data_parallel_size"
        case distributedExecutorBackend = "distributed_executor_backend"
        case gpuMemoryUtilization = "gpu_memory_utilization"
        case maxModelLen = "max_model_len"
        case kvCacheDtype = "kv_cache_dtype"
        case blockSize = "block_size"
        case swapSpace = "swap_space"
        case cpuOffloadGb = "cpu_offload_gb"
        case enablePrefixCaching = "enable_prefix_caching"
        case maxNumSeqs = "max_num_seqs"
        case maxNumBatchedTokens = "max_num_batched_tokens"
        case schedulingPolicy = "scheduling_policy"
        case enableChunkedPrefill = "enable_chunked_prefill"
        case enforceEager = "enforce_eager"
        case disableCudaGraph = "disable_cuda_graph"
        case speculativeModel = "speculative_model"
        case numSpeculativeTokens = "num_speculative_tokens"
        case reasoningParser = "reasoning_parser"
        case enableThinking = "enable_thinking"
        case thinkingBudget = "thinking_budget"
        case toolCallParser = "tool_call_parser"
        case enableAutoToolChoice = "enable_auto_tool_choice"
        case chatTemplate = "chat_template"
        case enableLora = "enable_lora"
        case maxLoras = "max_loras"
        case maxLoraRank = "max_lora_rank"
        case extraArgs = "extra_args"
        case envVars = "env_vars"
    }

    // MARK: - Computed Properties

    var isActive: Bool {
        status == .running
    }

    var statusText: String {
        status?.rawValue.capitalized ?? "Stopped"
    }

    var statusColor: String {
        switch status {
        case .running: return "success"
        case .starting: return "warning"
        case .error: return "error"
        default: return "mutedForeground"
        }
    }

    var displayName: String {
        name.isEmpty ? modelPath : name
    }

    /// Short model name (last component of path)
    var shortModelName: String {
        if let lastSlash = modelPath.lastIndex(of: "/") {
            return String(modelPath[modelPath.index(after: lastSlash)...])
        }
        return modelPath
    }
}

/// Recipe status
enum RecipeStatus: String, Codable {
    case running
    case stopped
    case starting
    case error
}

// MARK: - Request/Response Types

struct RecipesResponse: Decodable {
    let recipes: [Recipe]?

    // Handle both array and object response
    init(from decoder: Decoder) throws {
        if let container = try? decoder.singleValueContainer(),
           let array = try? container.decode([Recipe].self) {
            self.recipes = array
        } else {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            self.recipes = try container.decodeIfPresent([Recipe].self, forKey: .recipes)
        }
    }

    enum CodingKeys: String, CodingKey {
        case recipes
    }
}

struct LaunchResponse: Decodable {
    let success: Bool
    let pid: Int?
    let message: String?
}

struct WaitReadyResponse: Decodable {
    let ready: Bool
    let elapsed: Double?
    let error: String?
}

struct EvictResponse: Decodable {
    let success: Bool
    let evictedPid: Int?

    enum CodingKeys: String, CodingKey {
        case success
        case evictedPid = "evicted_pid"
    }
}

struct CreateRecipeRequest: Encodable {
    let name: String
    let modelPath: String
    let backend: String?
    let tensorParallelSize: Int?
    let pipelineParallelSize: Int?
    let maxModelLen: Int?
    let gpuMemoryUtilization: Double?
    let quantization: String?
    let loadFormat: String?
    let kvCacheDtype: String?
    let blockSize: Int?
    let maxNumSeqs: Int?
    let maxNumBatchedTokens: Int?
    let enableChunkedPrefill: Bool?
    let enablePrefixCaching: Bool?
    let enableAutoToolChoice: Bool?
    let toolCallParser: String?
    let speculativeModel: String?
    let numSpeculativeTokens: Int?
    let extraArgs: [String: String]?

    enum CodingKeys: String, CodingKey {
        case name, backend, quantization
        case modelPath = "model_path"
        case tensorParallelSize = "tensor_parallel_size"
        case pipelineParallelSize = "pipeline_parallel_size"
        case maxModelLen = "max_model_len"
        case gpuMemoryUtilization = "gpu_memory_utilization"
        case loadFormat = "load_format"
        case kvCacheDtype = "kv_cache_dtype"
        case blockSize = "block_size"
        case maxNumSeqs = "max_num_seqs"
        case maxNumBatchedTokens = "max_num_batched_tokens"
        case enableChunkedPrefill = "enable_chunked_prefill"
        case enablePrefixCaching = "enable_prefix_caching"
        case enableAutoToolChoice = "enable_auto_tool_choice"
        case toolCallParser = "tool_call_parser"
        case speculativeModel = "speculative_model"
        case numSpeculativeTokens = "num_speculative_tokens"
        case extraArgs = "extra_args"
    }
}

struct UpdateRecipeRequest: Encodable {
    let name: String?
    let tensorParallelSize: Int?
    let pipelineParallelSize: Int?
    let maxModelLen: Int?
    let gpuMemoryUtilization: Double?
    let quantization: String?
    let loadFormat: String?
    let kvCacheDtype: String?
    let blockSize: Int?
    let maxNumSeqs: Int?
    let maxNumBatchedTokens: Int?
    let enableChunkedPrefill: Bool?
    let enablePrefixCaching: Bool?
    let enableAutoToolChoice: Bool?
    let toolCallParser: String?
    let speculativeModel: String?
    let numSpeculativeTokens: Int?
    let extraArgs: [String: String]?

    enum CodingKeys: String, CodingKey {
        case name, quantization
        case tensorParallelSize = "tensor_parallel_size"
        case pipelineParallelSize = "pipeline_parallel_size"
        case maxModelLen = "max_model_len"
        case gpuMemoryUtilization = "gpu_memory_utilization"
        case loadFormat = "load_format"
        case kvCacheDtype = "kv_cache_dtype"
        case blockSize = "block_size"
        case maxNumSeqs = "max_num_seqs"
        case maxNumBatchedTokens = "max_num_batched_tokens"
        case enableChunkedPrefill = "enable_chunked_prefill"
        case enablePrefixCaching = "enable_prefix_caching"
        case enableAutoToolChoice = "enable_auto_tool_choice"
        case toolCallParser = "tool_call_parser"
        case speculativeModel = "speculative_model"
        case numSpeculativeTokens = "num_speculative_tokens"
        case extraArgs = "extra_args"
    }
}
