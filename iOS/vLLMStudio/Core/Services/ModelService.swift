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
            models = response.data
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    /// Gets the active model info
    @MainActor
    func fetchActiveModel() async throws {
        do {
            activeModel = try await APIClient.shared.request(.activeModel)
            errorMessage = nil
        } catch let error as NetworkError {
            // 404 means no active model
            if case .httpError(let code, _) = error, code == 404 {
                activeModel = nil
                return
            }
            errorMessage = error.localizedDescription
            throw error
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
    let data: [ModelInfo]
}

struct WaitReadyResponse: Decodable {
    let ready: Bool
}

// MARK: - Model Info

struct ModelInfo: Identifiable, Codable {
    let id: String
    let name: String?
    let type: String?
    let contextLength: Int?
    let provider: String?
    let description: String?
    let parameters: String?
    let quantization: String?
    let license: String?
    let downloadUrl: String?

    // Computed properties for display
    var displayName: String {
        name ?? id
    }

    var shortId: String {
        if let slashIndex = id.lastIndex(of: "/") {
            return String(id[id.index(after: slashIndex)...])
        }
        return id
    }

    var parameterCount: String? {
        parameters
    }

    var sizeCategory: String {
        guard let params = parameters else { return "Unknown" }

        if params.contains("70B") || params.contains("72B") {
            return "Large"
        } else if params.contains("13B") || params.contains("14B") {
            return "Medium"
        } else if params.contains("7B") || params.contains("8B") {
            return "Small"
        } else if params.contains("1B") || params.contains("2B") || params.contains("3B") {
            return "Tiny"
        }

        return "Unknown"
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
