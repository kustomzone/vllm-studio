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
    /// - Parameter recipeId: The recipe ID to launch
    @MainActor
    func launchRecipe(id: String) async throws {
        loadingRecipeId = id

        do {
            let response = try await APIClient.shared.launchModel(recipeId: id)

            if response.success {
                // Update the recipe status
                if let index = recipes.firstIndex(where: { $0.id == id }) {
                    recipes[index].isActive = true
                }
                // Mark other recipes as inactive
                for i in recipes.indices where recipes[i].id != id {
                    recipes[i].isActive = false
                }
            }

            loadingRecipeId = nil

        } catch {
            loadingRecipeId = nil
            throw error
        }
    }

    /// Evicts the currently loaded model
    @MainActor
    func evictCurrentModel() async throws {
        try await APIClient.shared.evictModel()

        // Mark all recipes as inactive
        for i in recipes.indices {
            recipes[i].isActive = false
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

struct Recipe: Identifiable, Codable {
    let id: String
    var name: String
    var modelName: String
    var description: String?
    var isActive: Bool

    // Model loading parameters
    var tensorParallelSize: Int?
    var pipelineParallelSize: Int?
    var maxModelLen: Int?
    var gpuMemoryUtilization: Double?

    // Quantization
    var quantization: String?
    var loadFormat: String?

    // KV Cache
    var kvCacheType: String?
    var blockSize: Int?

    // Performance
    var maxNumSeqs: Int?
    var maxNumBatchedTokens: Int?
    var enableChunkedPrefill: Bool?
    var enablePrefixCaching: Bool?

    // Tool calling
    var enableToolCalling: Bool?
    var toolCallParser: String?

    // Speculative decoding
    var speculativeModel: String?
    var speculativeNumTokens: Int?

    // Additional arguments
    var extraArgs: [String: String]?

    // Metadata
    let createdAt: Date?
    var updatedAt: Date?

    // MARK: - Computed Properties

    var statusText: String {
        isActive ? "Active" : "Inactive"
    }

    var statusColor: String {
        isActive ? "success" : "mutedForeground"
    }

    /// Generates the vLLM CLI command for this recipe
    var cliCommand: String {
        var args: [String] = ["vllm", "serve", modelName]

        if let tp = tensorParallelSize, tp > 1 {
            args.append("--tensor-parallel-size \(tp)")
        }

        if let pp = pipelineParallelSize, pp > 1 {
            args.append("--pipeline-parallel-size \(pp)")
        }

        if let maxLen = maxModelLen {
            args.append("--max-model-len \(maxLen)")
        }

        if let gpuUtil = gpuMemoryUtilization {
            args.append("--gpu-memory-utilization \(gpuUtil)")
        }

        if let quant = quantization {
            args.append("--quantization \(quant)")
        }

        if let format = loadFormat {
            args.append("--load-format \(format)")
        }

        if let kvType = kvCacheType {
            args.append("--kv-cache-dtype \(kvType)")
        }

        if let block = blockSize {
            args.append("--block-size \(block)")
        }

        if let maxSeqs = maxNumSeqs {
            args.append("--max-num-seqs \(maxSeqs)")
        }

        if let maxBatched = maxNumBatchedTokens {
            args.append("--max-num-batched-tokens \(maxBatched)")
        }

        if enableChunkedPrefill == true {
            args.append("--enable-chunked-prefill")
        }

        if enablePrefixCaching == true {
            args.append("--enable-prefix-caching")
        }

        if enableToolCalling == true {
            args.append("--enable-auto-tool-choice")
            if let parser = toolCallParser {
                args.append("--tool-call-parser \(parser)")
            }
        }

        if let specModel = speculativeModel {
            args.append("--speculative-model \(specModel)")
            if let numTokens = speculativeNumTokens {
                args.append("--num-speculative-tokens \(numTokens)")
            }
        }

        if let extra = extraArgs {
            for (key, value) in extra {
                args.append("--\(key) \(value)")
            }
        }

        return args.joined(separator: " \\\n  ")
    }
}

// MARK: - Request Types

struct CreateRecipeRequest: Encodable {
    let name: String
    let modelName: String
    let description: String?
    let tensorParallelSize: Int?
    let pipelineParallelSize: Int?
    let maxModelLen: Int?
    let gpuMemoryUtilization: Double?
    let quantization: String?
    let loadFormat: String?
    let kvCacheType: String?
    let blockSize: Int?
    let maxNumSeqs: Int?
    let maxNumBatchedTokens: Int?
    let enableChunkedPrefill: Bool?
    let enablePrefixCaching: Bool?
    let enableToolCalling: Bool?
    let toolCallParser: String?
    let speculativeModel: String?
    let speculativeNumTokens: Int?
    let extraArgs: [String: String]?
}

struct UpdateRecipeRequest: Encodable {
    let name: String?
    let description: String?
    let tensorParallelSize: Int?
    let pipelineParallelSize: Int?
    let maxModelLen: Int?
    let gpuMemoryUtilization: Double?
    let quantization: String?
    let loadFormat: String?
    let kvCacheType: String?
    let blockSize: Int?
    let maxNumSeqs: Int?
    let maxNumBatchedTokens: Int?
    let enableChunkedPrefill: Bool?
    let enablePrefixCaching: Bool?
    let enableToolCalling: Bool?
    let toolCallParser: String?
    let speculativeModel: String?
    let speculativeNumTokens: Int?
    let extraArgs: [String: String]?
}
