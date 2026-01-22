//
//  APIEndpoints.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation

/// API endpoint definitions for the vLLM Studio backend
enum APIEndpoint {

    // MARK: - Health & Status

    /// Health check endpoint
    case health

    /// Server status
    case status

    /// GPU information
    case gpus

    /// Real-time metrics (vLLM metrics)
    case metrics

    /// System configuration
    case config

    // MARK: - Recipes

    /// List all recipes
    case recipes

    /// Get a specific recipe
    case recipe(id: String)

    /// Create a new recipe
    case createRecipe

    /// Update an existing recipe
    case updateRecipe(id: String)

    /// Delete a recipe
    case deleteRecipe(id: String)

    // MARK: - Model Lifecycle

    /// Launch a model from a recipe
    case launch(recipeId: String, force: Bool)

    /// Evict the currently loaded model
    case evict(force: Bool)

    /// Wait for model to be ready
    case waitReady(timeout: Int)

    /// List available models (vLLM Studio models)
    case models

    /// OpenAI-compatible models list
    case openAIModels

    // MARK: - Chat

    /// List all chat sessions
    case chatSessions

    /// Get a specific chat session
    case chatSession(id: String)

    /// Create a new chat session
    case createChatSession

    /// Update a chat session
    case updateChatSession(id: String)

    /// Delete a chat session
    case deleteChatSession(id: String)

    /// Get messages for a session
    case chatMessages(sessionId: String)

    /// Add a message to a session
    case addMessage(sessionId: String)

    /// Fork a conversation at a specific message
    case forkSession(sessionId: String)

    /// Get usage for a chat session
    case chatUsage(sessionId: String)

    // MARK: - Chat Completions (OpenAI Compatible)

    /// OpenAI-compatible chat completions endpoint
    case chatCompletions

    // MARK: - MCP (Model Context Protocol)

    /// List MCP servers
    case mcpServers

    /// Add a new MCP server
    case addMCPServer

    /// Update an MCP server
    case updateMCPServer(name: String)

    /// Delete an MCP server
    case deleteMCPServer(name: String)

    /// Get all tools from all servers
    case mcpAllTools

    /// Get tools for a specific MCP server
    case mcpTools(serverId: String)

    /// Execute an MCP tool
    case executeTool(serverId: String, toolName: String)

    // MARK: - Logs

    /// List log sessions
    case logSessions

    /// Get log content
    case logContent(sessionId: String, limit: Int?)

    /// Delete a log session
    case deleteLogSession(sessionId: String)

    // MARK: - Usage & Analytics

    /// Get usage statistics
    case usageStats

    /// Get peak metrics
    case peakMetrics(modelId: String?)

    // MARK: - Utilities

    /// VRAM calculator
    case vramCalculator

    /// Run benchmark
    case benchmark(promptTokens: Int, maxTokens: Int)

    /// Tokenize chat messages
    case tokenize

    /// Count tokens in text
    case countTokens

    // MARK: - Path

    /// The URL path for the endpoint
    var path: String {
        switch self {
        // Health & Status
        case .health:
            return "/health"
        case .status:
            return "/status"
        case .gpus:
            return "/gpus"
        case .metrics:
            return "/v1/metrics/vllm"
        case .config:
            return "/config"

        // Recipes
        case .recipes, .createRecipe:
            return "/recipes"
        case .recipe(let id), .updateRecipe(let id), .deleteRecipe(let id):
            return "/recipes/\(id)"

        // Model Lifecycle
        case .launch(let recipeId, let force):
            return "/launch/\(recipeId)?force=\(force)"
        case .evict(let force):
            return "/evict?force=\(force)"
        case .waitReady(let timeout):
            return "/wait-ready?timeout=\(timeout)"
        case .models:
            return "/v1/studio/models"
        case .openAIModels:
            return "/v1/models"

        // Chat
        case .chatSessions, .createChatSession:
            return "/chats"
        case .chatSession(let id), .updateChatSession(let id), .deleteChatSession(let id):
            return "/chats/\(id)"
        case .chatMessages(let sessionId), .addMessage(let sessionId):
            return "/chats/\(sessionId)/messages"
        case .forkSession(let sessionId):
            return "/chats/\(sessionId)/fork"
        case .chatUsage(let sessionId):
            return "/chats/\(sessionId)/usage"

        // Chat Completions
        case .chatCompletions:
            return "/v1/chat/completions"

        // MCP
        case .mcpServers, .addMCPServer:
            return "/mcp/servers"
        case .updateMCPServer(let name), .deleteMCPServer(let name):
            return "/mcp/servers/\(name)"
        case .mcpAllTools:
            return "/mcp/tools"
        case .mcpTools(let serverId):
            return "/mcp/servers/\(serverId)/tools"
        case .executeTool(let serverId, let toolName):
            return "/mcp/tools/\(serverId)/\(toolName)"

        // Logs
        case .logSessions:
            return "/logs"
        case .logContent(let sessionId, let limit):
            if let limit = limit {
                return "/logs/\(sessionId)?limit=\(limit)"
            }
            return "/logs/\(sessionId)"
        case .deleteLogSession(let sessionId):
            return "/logs/\(sessionId)"

        // Usage
        case .usageStats:
            return "/usage"
        case .peakMetrics(let modelId):
            if let modelId = modelId {
                return "/peak-metrics?model_id=\(modelId)"
            }
            return "/peak-metrics"

        // Utilities
        case .vramCalculator:
            return "/vram-calculator"
        case .benchmark(let promptTokens, let maxTokens):
            return "/benchmark?prompt_tokens=\(promptTokens)&max_tokens=\(maxTokens)"
        case .tokenize:
            return "/v1/chat/completions/tokenize"
        case .countTokens:
            return "/v1/tokens/count"
        }
    }

    // MARK: - HTTP Method

    /// The HTTP method for the endpoint
    var method: HTTPMethod {
        switch self {
        case .createRecipe, .createChatSession, .addMessage, .forkSession,
             .executeTool, .launch, .evict, .addMCPServer, .vramCalculator,
             .benchmark, .tokenize, .countTokens:
            return .post
        case .updateRecipe, .updateChatSession, .updateMCPServer:
            return .put
        case .deleteRecipe, .deleteChatSession, .deleteLogSession, .deleteMCPServer:
            return .delete
        default:
            return .get
        }
    }

    // MARK: - Requires Authentication

    /// Whether the endpoint requires authentication
    var requiresAuth: Bool {
        switch self {
        case .health:
            return false
        default:
            return true
        }
    }

    // MARK: - Timeout

    /// Custom timeout for specific endpoints (in seconds)
    var timeout: TimeInterval {
        switch self {
        case .launch, .waitReady:
            return 360 // 6 minutes for model loading
        case .chatCompletions:
            return 300 // 5 minutes for chat completions
        case .benchmark:
            return 120 // 2 minutes for benchmark
        default:
            return 30 // Default 30 seconds
        }
    }

    // MARK: - Supports Streaming

    /// Whether the endpoint supports streaming responses
    var supportsStreaming: Bool {
        switch self {
        case .chatCompletions:
            return true
        default:
            return false
        }
    }

    // MARK: - Should Retry

    /// Whether the endpoint should retry on failure
    var shouldRetry: Bool {
        switch self {
        case .launch, .evict, .benchmark:
            return false // Don't retry these long-running operations
        default:
            return true
        }
    }
}

// MARK: - HTTP Method

/// HTTP methods used by the API
enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

// MARK: - URL Building

extension APIEndpoint {

    /// Builds the full URL for the endpoint
    /// - Parameter baseURL: The base URL of the API
    /// - Returns: The complete URL
    func url(baseURL: URL) -> URL? {
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: true)

        if let queryParams = queryParameters {
            components?.queryItems = queryParams.map { URLQueryItem(name: $0.key, value: $0.value) }
        }

        return components?.url
    }

    /// Builds a URLRequest for the endpoint
    /// - Parameters:
    ///   - baseURL: The base URL of the API
    ///   - apiKey: Optional API key for authentication
    ///   - body: Optional request body
    /// - Returns: A configured URLRequest
    func request(baseURL: URL, apiKey: String? = nil, body: Data? = nil) throws -> URLRequest {
        guard let url = url(baseURL: baseURL) else {
            throw NetworkError.invalidURL(path)
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.timeoutInterval = timeout

        // Standard headers
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Authentication
        if requiresAuth {
            guard let apiKey = apiKey, !apiKey.isEmpty else {
                throw NetworkError.missingAPIKey
            }
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }

        // Body
        if let body = body {
            request.httpBody = body
        }

        return request
    }
}
