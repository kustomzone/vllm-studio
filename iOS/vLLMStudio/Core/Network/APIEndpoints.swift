//
//  APIEndpoints.swift
//  vLLMStudio
//
//  Created for vLLM Studio iOS
//  Complete endpoint definitions for all API routes
//

import Foundation

/// HTTP methods supported by the API
public enum HTTPMethod: String, Sendable {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

/// Complete API endpoint definitions for vLLM Studio
public enum APIEndpoint: Sendable {
    // MARK: - Health & Status

    /// Check server health
    case health

    /// Get server status
    case status

    /// Get GPU information
    case gpus

    /// Get system metrics
    case metrics

    // MARK: - Recipes CRUD

    /// Get all recipes
    case recipes

    /// Get a specific recipe by ID
    case recipe(id: String)

    /// Create a new recipe
    case createRecipe(body: RecipeCreateBody)

    /// Update an existing recipe
    case updateRecipe(id: String, body: RecipeUpdateBody)

    /// Delete a recipe
    case deleteRecipe(id: String)

    // MARK: - Model Lifecycle

    /// Launch a model with a recipe
    case launch(recipeId: String, options: LaunchOptions?)

    /// Evict the currently loaded model
    case evict

    /// Wait for model to be ready
    case waitReady(timeout: Int?)

    /// Get list of available/loaded models
    case models

    // MARK: - Chat

    /// Get all chat sessions
    case chatSessions

    /// Get a specific chat session
    case chatSession(id: String)

    /// Get messages for a session
    case chatMessages(sessionId: String)

    /// Create a new message (triggers streaming response)
    case createMessage(sessionId: String, body: MessageCreateBody)

    /// Fork a session at a specific message
    case forkSession(id: String, messageIndex: Int)

    /// Create a new chat session
    case createChatSession(body: ChatSessionCreateBody)

    /// Delete a chat session
    case deleteChatSession(id: String)

    /// Update chat session (rename, etc.)
    case updateChatSession(id: String, body: ChatSessionUpdateBody)

    // MARK: - MCP (Model Context Protocol)

    /// Get all MCP servers
    case mcpServers

    /// Get tools for a specific MCP server
    case mcpTools(serverId: String)

    /// Execute an MCP tool
    case executeTool(serverId: String, toolName: String, arguments: [String: AnyCodableValue])

    /// Add a new MCP server
    case addMCPServer(body: MCPServerCreateBody)

    /// Remove an MCP server
    case removeMCPServer(serverId: String)

    /// Restart an MCP server
    case restartMCPServer(serverId: String)

    // MARK: - Logs

    /// Get all log sessions
    case logSessions

    /// Get content for a specific log session
    case logContent(sessionId: String, options: LogContentOptions?)

    /// Stream logs in real-time
    case streamLogs(sessionId: String)

    // MARK: - Usage Analytics

    /// Get usage statistics
    case usageStats(range: UsageRange?)

    /// Get peak metrics
    case peakMetrics

    /// Get per-model usage breakdown
    case modelUsage

    /// Get daily usage history
    case dailyUsage(days: Int?)

    // MARK: - Computed Properties

    /// The URL path for this endpoint
    public var path: String {
        switch self {
        // Health & Status
        case .health:
            return "/api/health"
        case .status:
            return "/api/status"
        case .gpus:
            return "/api/gpus"
        case .metrics:
            return "/api/metrics"

        // Recipes
        case .recipes:
            return "/api/recipes"
        case .recipe(let id):
            return "/api/recipes/\(id)"
        case .createRecipe:
            return "/api/recipes"
        case .updateRecipe(let id, _):
            return "/api/recipes/\(id)"
        case .deleteRecipe(let id):
            return "/api/recipes/\(id)"

        // Model Lifecycle
        case .launch:
            return "/api/launch"
        case .evict:
            return "/api/evict"
        case .waitReady:
            return "/api/wait-ready"
        case .models:
            return "/api/models"

        // Chat
        case .chatSessions:
            return "/api/chat/sessions"
        case .chatSession(let id):
            return "/api/chat/sessions/\(id)"
        case .chatMessages(let sessionId):
            return "/api/chat/sessions/\(sessionId)/messages"
        case .createMessage(let sessionId, _):
            return "/api/chat/sessions/\(sessionId)/messages"
        case .forkSession(let id, _):
            return "/api/chat/sessions/\(id)/fork"
        case .createChatSession:
            return "/api/chat/sessions"
        case .deleteChatSession(let id):
            return "/api/chat/sessions/\(id)"
        case .updateChatSession(let id, _):
            return "/api/chat/sessions/\(id)"

        // MCP
        case .mcpServers:
            return "/api/mcp/servers"
        case .mcpTools(let serverId):
            return "/api/mcp/servers/\(serverId)/tools"
        case .executeTool(let serverId, let toolName, _):
            return "/api/mcp/servers/\(serverId)/tools/\(toolName)/execute"
        case .addMCPServer:
            return "/api/mcp/servers"
        case .removeMCPServer(let serverId):
            return "/api/mcp/servers/\(serverId)"
        case .restartMCPServer(let serverId):
            return "/api/mcp/servers/\(serverId)/restart"

        // Logs
        case .logSessions:
            return "/api/logs/sessions"
        case .logContent(let sessionId, _):
            return "/api/logs/sessions/\(sessionId)/content"
        case .streamLogs(let sessionId):
            return "/api/logs/sessions/\(sessionId)/stream"

        // Usage
        case .usageStats:
            return "/api/usage/stats"
        case .peakMetrics:
            return "/api/usage/peak"
        case .modelUsage:
            return "/api/usage/models"
        case .dailyUsage:
            return "/api/usage/daily"
        }
    }

    /// The HTTP method for this endpoint
    public var method: HTTPMethod {
        switch self {
        // GET endpoints
        case .health, .status, .gpus, .metrics,
             .recipes, .recipe,
             .models, .waitReady,
             .chatSessions, .chatSession, .chatMessages,
             .mcpServers, .mcpTools,
             .logSessions, .logContent, .streamLogs,
             .usageStats, .peakMetrics, .modelUsage, .dailyUsage:
            return .get

        // POST endpoints
        case .createRecipe, .launch, .evict,
             .createMessage, .forkSession, .createChatSession,
             .executeTool, .addMCPServer, .restartMCPServer:
            return .post

        // PUT/PATCH endpoints
        case .updateRecipe, .updateChatSession:
            return .put

        // DELETE endpoints
        case .deleteRecipe, .deleteChatSession, .removeMCPServer:
            return .delete
        }
    }

    /// The request body for this endpoint (if any)
    public var body: (any Encodable)? {
        switch self {
        case .createRecipe(let body):
            return body
        case .updateRecipe(_, let body):
            return body
        case .launch(let recipeId, let options):
            return LaunchRequestBody(recipeId: recipeId, options: options)
        case .createMessage(_, let body):
            return body
        case .forkSession(_, let messageIndex):
            return ForkSessionBody(messageIndex: messageIndex)
        case .createChatSession(let body):
            return body
        case .updateChatSession(_, let body):
            return body
        case .executeTool(_, _, let arguments):
            return ToolExecutionBody(arguments: arguments)
        case .addMCPServer(let body):
            return body
        default:
            return nil
        }
    }

    /// Query parameters for this endpoint
    public var queryItems: [URLQueryItem]? {
        switch self {
        case .waitReady(let timeout):
            if let timeout = timeout {
                return [URLQueryItem(name: "timeout", value: String(timeout))]
            }
            return nil

        case .logContent(_, let options):
            guard let options = options else { return nil }
            var items: [URLQueryItem] = []
            if let startLine = options.startLine {
                items.append(URLQueryItem(name: "start_line", value: String(startLine)))
            }
            if let limit = options.limit {
                items.append(URLQueryItem(name: "limit", value: String(limit)))
            }
            if let filter = options.filter {
                items.append(URLQueryItem(name: "filter", value: filter))
            }
            return items.isEmpty ? nil : items

        case .usageStats(let range):
            guard let range = range else { return nil }
            return [
                URLQueryItem(name: "start", value: range.start.iso8601String),
                URLQueryItem(name: "end", value: range.end.iso8601String)
            ]

        case .dailyUsage(let days):
            if let days = days {
                return [URLQueryItem(name: "days", value: String(days))]
            }
            return nil

        default:
            return nil
        }
    }

    /// Content type for the request
    public var contentType: String {
        switch self {
        case .streamLogs:
            return "text/event-stream"
        default:
            return "application/json"
        }
    }

    /// Whether this endpoint returns a streaming response
    public var isStreaming: Bool {
        switch self {
        case .createMessage, .streamLogs:
            return true
        default:
            return false
        }
    }

    /// Timeout for this endpoint (in seconds)
    public var timeout: TimeInterval {
        switch self {
        case .launch:
            return 300 // 5 minutes for model loading
        case .waitReady(let timeout):
            return TimeInterval(timeout ?? 120) + 10 // Wait timeout + buffer
        case .createMessage:
            return 180 // 3 minutes for streaming responses
        case .executeTool:
            return 120 // 2 minutes for tool execution
        default:
            return 30 // Standard timeout
        }
    }

    /// Whether authentication is required
    public var requiresAuth: Bool {
        switch self {
        case .health:
            return false
        default:
            return true
        }
    }
}

// MARK: - Request Body Types

/// Body for creating a recipe
public struct RecipeCreateBody: Codable, Sendable {
    public let name: String
    public let description: String?
    public let modelPath: String
    public let parameters: RecipeParameters

    public init(name: String, description: String? = nil, modelPath: String, parameters: RecipeParameters) {
        self.name = name
        self.description = description
        self.modelPath = modelPath
        self.parameters = parameters
    }

    enum CodingKeys: String, CodingKey {
        case name
        case description
        case modelPath = "model_path"
        case parameters
    }
}

/// Body for updating a recipe
public struct RecipeUpdateBody: Codable, Sendable {
    public let name: String?
    public let description: String?
    public let modelPath: String?
    public let parameters: RecipeParameters?

    public init(name: String? = nil, description: String? = nil, modelPath: String? = nil, parameters: RecipeParameters? = nil) {
        self.name = name
        self.description = description
        self.modelPath = modelPath
        self.parameters = parameters
    }

    enum CodingKeys: String, CodingKey {
        case name
        case description
        case modelPath = "model_path"
        case parameters
    }
}

/// Recipe parameters
public struct RecipeParameters: Codable, Sendable {
    public var tensorParallelSize: Int?
    public var pipelineParallelSize: Int?
    public var gpuMemoryUtilization: Double?
    public var maxModelLen: Int?
    public var quantization: String?
    public var dtype: String?
    public var enforceEager: Bool?
    public var enableChunkedPrefill: Bool?
    public var maxNumSeqs: Int?
    public var extraArgs: [String]?

    public init(
        tensorParallelSize: Int? = nil,
        pipelineParallelSize: Int? = nil,
        gpuMemoryUtilization: Double? = nil,
        maxModelLen: Int? = nil,
        quantization: String? = nil,
        dtype: String? = nil,
        enforceEager: Bool? = nil,
        enableChunkedPrefill: Bool? = nil,
        maxNumSeqs: Int? = nil,
        extraArgs: [String]? = nil
    ) {
        self.tensorParallelSize = tensorParallelSize
        self.pipelineParallelSize = pipelineParallelSize
        self.gpuMemoryUtilization = gpuMemoryUtilization
        self.maxModelLen = maxModelLen
        self.quantization = quantization
        self.dtype = dtype
        self.enforceEager = enforceEager
        self.enableChunkedPrefill = enableChunkedPrefill
        self.maxNumSeqs = maxNumSeqs
        self.extraArgs = extraArgs
    }

    enum CodingKeys: String, CodingKey {
        case tensorParallelSize = "tensor_parallel_size"
        case pipelineParallelSize = "pipeline_parallel_size"
        case gpuMemoryUtilization = "gpu_memory_utilization"
        case maxModelLen = "max_model_len"
        case quantization
        case dtype
        case enforceEager = "enforce_eager"
        case enableChunkedPrefill = "enable_chunked_prefill"
        case maxNumSeqs = "max_num_seqs"
        case extraArgs = "extra_args"
    }
}

/// Launch options
public struct LaunchOptions: Codable, Sendable {
    public let waitForReady: Bool?
    public let timeout: Int?

    public init(waitForReady: Bool? = nil, timeout: Int? = nil) {
        self.waitForReady = waitForReady
        self.timeout = timeout
    }

    enum CodingKeys: String, CodingKey {
        case waitForReady = "wait_for_ready"
        case timeout
    }
}

/// Internal launch request body
struct LaunchRequestBody: Codable, Sendable {
    let recipeId: String
    let options: LaunchOptions?

    enum CodingKeys: String, CodingKey {
        case recipeId = "recipe_id"
        case options
    }
}

/// Body for creating a chat message
public struct MessageCreateBody: Codable, Sendable {
    public let content: String
    public let role: String
    public let mcpServers: [String]?
    public let systemPrompt: String?
    public let temperature: Double?
    public let maxTokens: Int?
    public let stream: Bool

    public init(
        content: String,
        role: String = "user",
        mcpServers: [String]? = nil,
        systemPrompt: String? = nil,
        temperature: Double? = nil,
        maxTokens: Int? = nil,
        stream: Bool = true
    ) {
        self.content = content
        self.role = role
        self.mcpServers = mcpServers
        self.systemPrompt = systemPrompt
        self.temperature = temperature
        self.maxTokens = maxTokens
        self.stream = stream
    }

    enum CodingKeys: String, CodingKey {
        case content
        case role
        case mcpServers = "mcp_servers"
        case systemPrompt = "system_prompt"
        case temperature
        case maxTokens = "max_tokens"
        case stream
    }
}

/// Body for forking a session
struct ForkSessionBody: Codable, Sendable {
    let messageIndex: Int

    enum CodingKeys: String, CodingKey {
        case messageIndex = "message_index"
    }
}

/// Body for creating a chat session
public struct ChatSessionCreateBody: Codable, Sendable {
    public let title: String?
    public let modelId: String?
    public let systemPrompt: String?

    public init(title: String? = nil, modelId: String? = nil, systemPrompt: String? = nil) {
        self.title = title
        self.modelId = modelId
        self.systemPrompt = systemPrompt
    }

    enum CodingKeys: String, CodingKey {
        case title
        case modelId = "model_id"
        case systemPrompt = "system_prompt"
    }
}

/// Body for updating a chat session
public struct ChatSessionUpdateBody: Codable, Sendable {
    public let title: String?
    public let systemPrompt: String?
    public let isPinned: Bool?

    public init(title: String? = nil, systemPrompt: String? = nil, isPinned: Bool? = nil) {
        self.title = title
        self.systemPrompt = systemPrompt
        self.isPinned = isPinned
    }

    enum CodingKeys: String, CodingKey {
        case title
        case systemPrompt = "system_prompt"
        case isPinned = "is_pinned"
    }
}

/// Body for executing an MCP tool
struct ToolExecutionBody: Codable, Sendable {
    let arguments: [String: AnyCodableValue]
}

/// Body for adding an MCP server
public struct MCPServerCreateBody: Codable, Sendable {
    public let name: String
    public let command: String
    public let args: [String]?
    public let env: [String: String]?

    public init(name: String, command: String, args: [String]? = nil, env: [String: String]? = nil) {
        self.name = name
        self.command = command
        self.args = args
        self.env = env
    }
}

/// Options for fetching log content
public struct LogContentOptions: Sendable {
    public let startLine: Int?
    public let limit: Int?
    public let filter: String?

    public init(startLine: Int? = nil, limit: Int? = nil, filter: String? = nil) {
        self.startLine = startLine
        self.limit = limit
        self.filter = filter
    }
}

/// Time range for usage stats
public struct UsageRange: Sendable {
    public let start: Date
    public let end: Date

    public init(start: Date, end: Date) {
        self.start = start
        self.end = end
    }
}

// MARK: - Helper Extensions

extension Date {
    var iso8601String: String {
        ISO8601DateFormatter().string(from: self)
    }
}

/// Type-safe wrapper for any codable value
public enum AnyCodableValue: Codable, Sendable, Equatable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case array([AnyCodableValue])
    case dictionary([String: AnyCodableValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
        } else if let string = try? container.decode(String.self) {
            self = .string(string)
        } else if let int = try? container.decode(Int.self) {
            self = .int(int)
        } else if let double = try? container.decode(Double.self) {
            self = .double(double)
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let array = try? container.decode([AnyCodableValue].self) {
            self = .array(array)
        } else if let dict = try? container.decode([String: AnyCodableValue].self) {
            self = .dictionary(dict)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unknown type")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .int(let value): try container.encode(value)
        case .double(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .dictionary(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    /// Get the underlying value
    public var value: Any {
        switch self {
        case .string(let v): return v
        case .int(let v): return v
        case .double(let v): return v
        case .bool(let v): return v
        case .array(let v): return v.map { $0.value }
        case .dictionary(let v): return v.mapValues { $0.value }
        case .null: return NSNull()
        }
    }
}

// MARK: - URL Building Extension

extension APIEndpoint {
    /// Builds the full URL for this endpoint
    /// - Parameter baseURL: The base URL of the API
    /// - Returns: The complete URL or nil if invalid
    public func url(baseURL: URL) -> URL? {
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: true)
        components?.queryItems = queryItems
        return components?.url
    }

    /// Builds a URLRequest for this endpoint
    /// - Parameters:
    ///   - baseURL: The base URL of the API
    ///   - apiKey: Optional API key for authentication
    /// - Returns: A configured URLRequest
    public func request(baseURL: URL, apiKey: String? = nil) throws -> URLRequest {
        guard let url = url(baseURL: baseURL) else {
            throw NetworkError.invalidURL(path)
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.timeoutInterval = timeout

        // Headers
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Authentication
        if requiresAuth {
            guard let apiKey = apiKey, !apiKey.isEmpty else {
                throw NetworkError.missingAuthToken
            }
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }

        // Body
        if let body = body {
            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }

        return request
    }
}

/// Type-erased Encodable wrapper
private struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void

    init(_ wrapped: any Encodable) {
        _encode = wrapped.encode(to:)
    }

    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}
