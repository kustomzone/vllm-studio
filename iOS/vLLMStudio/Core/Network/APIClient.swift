//
//  APIClient.swift
//  vLLMStudio
//
//  Created for vLLM Studio iOS
//  Actor-based HTTP client with async/await, retry logic, and streaming support
//

import Foundation

// MARK: - Auth Service Protocol

/// Protocol for authentication service to provide API keys
public protocol AuthServiceProtocol: Sendable {
    /// The current API key, if available
    var apiKey: String? { get async }

    /// The base URL for API requests
    var baseURL: URL { get async }
}

// MARK: - API Client

/// Actor-based API client with thread safety, retry logic, and streaming support
public actor APIClient {
    // MARK: - Properties

    private let session: URLSession
    private let authService: AuthServiceProtocol
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    /// Maximum number of retry attempts
    private let maxRetries: Int

    /// Base delay for exponential backoff (in seconds)
    private let baseRetryDelay: TimeInterval

    /// Maximum delay cap for exponential backoff (in seconds)
    private let maxRetryDelay: TimeInterval

    // MARK: - Initialization

    /// Initialize the API client with dependencies
    /// - Parameters:
    ///   - authService: Service providing authentication credentials
    ///   - maxRetries: Maximum retry attempts (default: 3)
    ///   - baseRetryDelay: Base delay for exponential backoff (default: 1.0s)
    ///   - maxRetryDelay: Maximum delay cap (default: 30.0s)
    ///   - configuration: URLSession configuration (default: .default)
    public init(
        authService: AuthServiceProtocol,
        maxRetries: Int = 3,
        baseRetryDelay: TimeInterval = 1.0,
        maxRetryDelay: TimeInterval = 30.0,
        configuration: URLSessionConfiguration = .default
    ) {
        self.authService = authService
        self.maxRetries = maxRetries
        self.baseRetryDelay = baseRetryDelay
        self.maxRetryDelay = maxRetryDelay

        // Configure session
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 300
        configuration.waitsForConnectivity = true
        self.session = URLSession(configuration: configuration)

        // Configure decoder
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            // Try ISO8601 with fractional seconds
            if let date = ISO8601DateFormatter.withFractionalSeconds.date(from: dateString) {
                return date
            }
            // Try ISO8601 without fractional seconds
            if let date = ISO8601DateFormatter().date(from: dateString) {
                return date
            }
            // Try common date format
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
            if let date = formatter.date(from: dateString) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date: \(dateString)"
            )
        }
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder = decoder

        // Configure encoder
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.keyEncodingStrategy = .convertToSnakeCase
        self.encoder = encoder
    }

    // MARK: - Public Methods

    /// Perform a request and decode the response
    /// - Parameters:
    ///   - endpoint: The API endpoint to call
    ///   - retries: Number of retry attempts (uses default if not specified)
    /// - Returns: Decoded response of type T
    /// - Throws: NetworkError if the request fails
    public func request<T: Decodable>(
        _ endpoint: APIEndpoint,
        retries: Int? = nil
    ) async throws -> T {
        let maxAttempts = (retries ?? maxRetries) + 1
        var lastError: NetworkError?

        for attempt in 1...maxAttempts {
            do {
                let urlRequest = try await buildRequest(for: endpoint)
                let (data, response) = try await performRequest(urlRequest)

                try validateResponse(response, data: data)

                return try decodeResponse(data, as: T.self)
            } catch let error as NetworkError {
                lastError = error

                // Don't retry for non-retryable errors
                guard error.isRetryable && attempt < maxAttempts else {
                    throw error
                }

                // Calculate delay with exponential backoff and jitter
                let delay = calculateRetryDelay(attempt: attempt, error: error)
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            } catch let error as URLError {
                let networkError = NetworkError.from(urlError: error)
                lastError = networkError

                guard networkError.isRetryable && attempt < maxAttempts else {
                    throw networkError
                }

                let delay = calculateRetryDelay(attempt: attempt, error: networkError)
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            } catch {
                throw NetworkError.unknown(error.localizedDescription)
            }
        }

        throw NetworkError.maxRetriesExceeded(
            attempts: maxAttempts,
            lastError: lastError?.localizedDescription ?? "Unknown error"
        )
    }

    /// Perform a request without decoding the response (for void responses)
    /// - Parameter endpoint: The API endpoint to call
    /// - Throws: NetworkError if the request fails
    public func requestVoid(_ endpoint: APIEndpoint) async throws {
        let _: EmptyResponse = try await request(endpoint)
    }

    /// Perform a streaming request and return an AsyncThrowingStream of data
    /// - Parameter endpoint: The API endpoint to call (should be a streaming endpoint)
    /// - Returns: AsyncThrowingStream of Data chunks
    public func stream(_ endpoint: APIEndpoint) -> AsyncThrowingStream<Data, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let urlRequest = try await buildRequest(for: endpoint, isStreaming: true)

                    let (asyncBytes, response) = try await session.bytes(for: urlRequest)

                    guard let httpResponse = response as? HTTPURLResponse else {
                        continuation.finish(throwing: NetworkError.invalidResponse("Not an HTTP response"))
                        return
                    }

                    guard (200...299).contains(httpResponse.statusCode) else {
                        let error = NetworkError.from(statusCode: httpResponse.statusCode, data: nil)
                        continuation.finish(throwing: error)
                        return
                    }

                    var buffer = Data()

                    for try await byte in asyncBytes {
                        buffer.append(byte)

                        // Check for newline to yield complete chunks
                        if byte == UInt8(ascii: "\n") {
                            if !buffer.isEmpty {
                                continuation.yield(buffer)
                                buffer = Data()
                            }
                        }
                    }

                    // Yield any remaining data
                    if !buffer.isEmpty {
                        continuation.yield(buffer)
                    }

                    continuation.finish()
                } catch let error as NetworkError {
                    continuation.finish(throwing: error)
                } catch let error as URLError {
                    continuation.finish(throwing: NetworkError.from(urlError: error))
                } catch {
                    continuation.finish(throwing: NetworkError.unknown(error.localizedDescription))
                }
            }
        }
    }

    /// Perform a streaming request and return an AsyncThrowingStream for SSE
    /// - Parameter endpoint: The API endpoint to call
    /// - Returns: AsyncThrowingStream of SSE events
    public func streamSSE(_ endpoint: APIEndpoint) -> AsyncThrowingStream<SSEEvent, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let urlRequest = try await buildRequest(for: endpoint, isStreaming: true)

                    let (asyncBytes, response) = try await session.bytes(for: urlRequest)

                    guard let httpResponse = response as? HTTPURLResponse else {
                        continuation.finish(throwing: NetworkError.invalidResponse("Not an HTTP response"))
                        return
                    }

                    guard (200...299).contains(httpResponse.statusCode) else {
                        let error = NetworkError.from(statusCode: httpResponse.statusCode, data: nil)
                        continuation.finish(throwing: error)
                        return
                    }

                    var eventData = ""
                    var eventType: String?
                    var eventId: String?
                    var lineBuffer = ""

                    for try await byte in asyncBytes {
                        let char = Character(UnicodeScalar(byte))

                        if char == "\n" {
                            // Process the line
                            if lineBuffer.isEmpty {
                                // Empty line means end of event
                                if !eventData.isEmpty {
                                    let event = SSEEvent(
                                        data: eventData.trimmingCharacters(in: .newlines),
                                        event: eventType,
                                        id: eventId
                                    )
                                    continuation.yield(event)

                                    // Reset for next event
                                    eventData = ""
                                    eventType = nil
                                    eventId = nil
                                }
                            } else {
                                // Parse the line
                                if lineBuffer.hasPrefix("data:") {
                                    let dataValue = String(lineBuffer.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                                    if !eventData.isEmpty {
                                        eventData += "\n"
                                    }
                                    eventData += dataValue
                                } else if lineBuffer.hasPrefix("event:") {
                                    eventType = String(lineBuffer.dropFirst(6)).trimmingCharacters(in: .whitespaces)
                                } else if lineBuffer.hasPrefix("id:") {
                                    eventId = String(lineBuffer.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                                }
                                // Ignore retry: and comments (:)
                            }
                            lineBuffer = ""
                        } else if char != "\r" {
                            lineBuffer.append(char)
                        }
                    }

                    // Handle any remaining event
                    if !eventData.isEmpty {
                        let event = SSEEvent(
                            data: eventData.trimmingCharacters(in: .newlines),
                            event: eventType,
                            id: eventId
                        )
                        continuation.yield(event)
                    }

                    continuation.finish()
                } catch let error as NetworkError {
                    continuation.finish(throwing: error)
                } catch let error as URLError {
                    continuation.finish(throwing: NetworkError.from(urlError: error))
                } catch is CancellationError {
                    continuation.finish(throwing: NetworkError.cancelled)
                } catch {
                    continuation.finish(throwing: NetworkError.unknown(error.localizedDescription))
                }
            }
        }
    }

    // MARK: - Private Methods

    /// Build a URLRequest for the given endpoint
    private func buildRequest(
        for endpoint: APIEndpoint,
        isStreaming: Bool = false
    ) async throws -> URLRequest {
        let baseURL = await authService.baseURL

        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: true) else {
            throw NetworkError.invalidURL(baseURL.absoluteString)
        }

        components.path = endpoint.path
        components.queryItems = endpoint.queryItems

        guard let url = components.url else {
            throw NetworkError.invalidURL(components.string ?? "Unknown URL")
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.timeoutInterval = isStreaming ? 300 : endpoint.timeout

        // Set headers
        request.setValue(endpoint.contentType, forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if isStreaming {
            request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        }

        // Inject Bearer token
        if let apiKey = await authService.apiKey {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        } else if endpoint.requiresAuth {
            throw NetworkError.missingAuthToken
        }

        // Encode body if present
        if let body = endpoint.body {
            do {
                request.httpBody = try encoder.encode(AnyEncodable(body))
            } catch {
                throw NetworkError.encodingFailed(error.localizedDescription)
            }
        }

        return request
    }

    /// Perform the actual network request
    private func performRequest(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch let error as URLError {
            throw NetworkError.from(urlError: error)
        }
    }

    /// Validate the HTTP response
    private func validateResponse(_ response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidResponse("Not an HTTP response")
        }

        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw NetworkError.unauthorized
        case 403:
            throw NetworkError.forbidden
        case 404:
            throw NetworkError.notFound(resource: "Unknown")
        case 429:
            let retryAfter = httpResponse.value(forHTTPHeaderField: "Retry-After")
                .flatMap { TimeInterval($0) }
            throw NetworkError.rateLimited(retryAfter: retryAfter)
        case 503:
            throw NetworkError.serviceUnavailable
        default:
            // Try to parse error response
            if let errorResponse = try? decoder.decode(APIErrorResponse.self, from: data) {
                throw NetworkError.serverError(
                    statusCode: httpResponse.statusCode,
                    message: errorResponse.displayMessage
                )
            }
            throw NetworkError.from(statusCode: httpResponse.statusCode, data: data)
        }
    }

    /// Decode the response data
    private func decodeResponse<T: Decodable>(_ data: Data, as type: T.Type) throws -> T {
        // Handle empty response
        if data.isEmpty {
            if type == EmptyResponse.self {
                return EmptyResponse() as! T
            }
            throw NetworkError.emptyResponse
        }

        do {
            return try decoder.decode(type, from: data)
        } catch let error as DecodingError {
            throw NetworkError.decodingFailed(describeDecodingError(error))
        }
    }

    /// Calculate retry delay with exponential backoff and jitter
    private func calculateRetryDelay(attempt: Int, error: NetworkError) -> TimeInterval {
        // Check for rate limit retry-after
        if case .rateLimited(let retryAfter) = error, let delay = retryAfter {
            return min(delay, maxRetryDelay)
        }

        // Exponential backoff: baseDelay * 2^(attempt-1)
        let exponentialDelay = baseRetryDelay * pow(2.0, Double(attempt - 1))

        // Add jitter (0-25% of delay)
        let jitter = Double.random(in: 0...(exponentialDelay * 0.25))

        // Cap at max delay
        return min(exponentialDelay + jitter, maxRetryDelay)
    }

    /// Create a human-readable description of a decoding error
    private func describeDecodingError(_ error: DecodingError) -> String {
        switch error {
        case .typeMismatch(let type, let context):
            return "Type mismatch: expected \(type) at \(context.codingPath.map { $0.stringValue }.joined(separator: "."))"
        case .valueNotFound(let type, let context):
            return "Value not found: expected \(type) at \(context.codingPath.map { $0.stringValue }.joined(separator: "."))"
        case .keyNotFound(let key, let context):
            return "Key not found: '\(key.stringValue)' at \(context.codingPath.map { $0.stringValue }.joined(separator: "."))"
        case .dataCorrupted(let context):
            return "Data corrupted: \(context.debugDescription)"
        @unknown default:
            return error.localizedDescription
        }
    }
}

// MARK: - Supporting Types

/// Empty response for void endpoints
public struct EmptyResponse: Codable, Sendable {}

/// Server-Sent Event
public struct SSEEvent: Sendable, Equatable {
    public let data: String
    public let event: String?
    public let id: String?

    public init(data: String, event: String? = nil, id: String? = nil) {
        self.data = data
        self.event = event
        self.id = id
    }

    /// Check if this is a done/end event
    public var isDone: Bool {
        data == "[DONE]" || event == "done" || event == "end"
    }

    /// Attempt to decode the data as JSON
    public func decode<T: Decodable>(as type: T.Type, decoder: JSONDecoder = JSONDecoder()) throws -> T {
        guard let jsonData = data.data(using: .utf8) else {
            throw NetworkError.decodingFailed("Cannot convert event data to UTF-8")
        }
        return try decoder.decode(type, from: jsonData)
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

// MARK: - Date Formatter Extension

extension ISO8601DateFormatter {
    static let withFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

// MARK: - Convenience Extensions

extension APIClient {
    /// Health check endpoint
    public func checkHealth() async throws -> HealthResponse {
        try await request(.health)
    }

    /// Get server status
    public func getStatus() async throws -> StatusResponse {
        try await request(.status)
    }

    /// Get GPU information
    public func getGPUs() async throws -> [GPUInfo] {
        try await request(.gpus)
    }

    /// Get all recipes
    public func getRecipes() async throws -> [RecipeResponse] {
        try await request(.recipes)
    }

    /// Get a specific recipe
    public func getRecipe(id: String) async throws -> RecipeResponse {
        try await request(.recipe(id: id))
    }

    /// Create a new recipe
    public func createRecipe(_ body: RecipeCreateBody) async throws -> RecipeResponse {
        try await request(.createRecipe(body: body))
    }

    /// Update a recipe
    public func updateRecipe(id: String, body: RecipeUpdateBody) async throws -> RecipeResponse {
        try await request(.updateRecipe(id: id, body: body))
    }

    /// Delete a recipe
    public func deleteRecipe(id: String) async throws {
        try await requestVoid(.deleteRecipe(id: id))
    }

    /// Launch a model
    public func launchModel(recipeId: String, options: LaunchOptions? = nil) async throws -> LaunchResponse {
        try await request(.launch(recipeId: recipeId, options: options))
    }

    /// Evict the current model
    public func evictModel() async throws {
        try await requestVoid(.evict)
    }

    /// Get chat sessions
    public func getChatSessions() async throws -> [ChatSessionResponse] {
        try await request(.chatSessions)
    }

    /// Create a chat session
    public func createChatSession(_ body: ChatSessionCreateBody) async throws -> ChatSessionResponse {
        try await request(.createChatSession(body: body))
    }

    /// Get MCP servers
    public func getMCPServers() async throws -> [MCPServerResponse] {
        try await request(.mcpServers)
    }

    /// Get usage statistics
    public func getUsageStats(range: UsageRange? = nil) async throws -> UsageStatsResponse {
        try await request(.usageStats(range: range))
    }
}

// MARK: - Common Response Types

public struct HealthResponse: Codable, Sendable {
    public let status: String
    public let timestamp: Date?
}

public struct StatusResponse: Codable, Sendable {
    public let modelLoaded: Bool
    public let modelName: String?
    public let status: String
    public let uptime: TimeInterval?

    enum CodingKeys: String, CodingKey {
        case modelLoaded = "model_loaded"
        case modelName = "model_name"
        case status
        case uptime
    }
}

public struct GPUInfo: Codable, Sendable, Identifiable {
    public let id: Int
    public let name: String
    public let memoryTotal: Int64
    public let memoryUsed: Int64
    public let memoryFree: Int64
    public let utilizationGpu: Int
    public let temperature: Int?

    public var memoryUtilization: Double {
        guard memoryTotal > 0 else { return 0 }
        return Double(memoryUsed) / Double(memoryTotal)
    }

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case memoryTotal = "memory_total"
        case memoryUsed = "memory_used"
        case memoryFree = "memory_free"
        case utilizationGpu = "utilization_gpu"
        case temperature
    }
}

public struct RecipeResponse: Codable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let description: String?
    public let modelPath: String
    public let parameters: RecipeParameters
    public let createdAt: Date?
    public let updatedAt: Date?
    public let isPinned: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case modelPath = "model_path"
        case parameters
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case isPinned = "is_pinned"
    }
}

public struct LaunchResponse: Codable, Sendable {
    public let success: Bool
    public let message: String?
    public let modelId: String?

    enum CodingKeys: String, CodingKey {
        case success
        case message
        case modelId = "model_id"
    }
}

public struct ChatSessionResponse: Codable, Sendable, Identifiable {
    public let id: String
    public let title: String?
    public let modelId: String?
    public let systemPrompt: String?
    public let messageCount: Int?
    public let createdAt: Date?
    public let updatedAt: Date?
    public let isPinned: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case modelId = "model_id"
        case systemPrompt = "system_prompt"
        case messageCount = "message_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case isPinned = "is_pinned"
    }
}

public struct MCPServerResponse: Codable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let status: String
    public let toolCount: Int?
    public let command: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case status
        case toolCount = "tool_count"
        case command
    }
}

public struct UsageStatsResponse: Codable, Sendable {
    public let totalRequests: Int
    public let totalTokens: Int
    public let totalInputTokens: Int
    public let totalOutputTokens: Int
    public let averageLatency: Double?
    public let periodStart: Date?
    public let periodEnd: Date?

    enum CodingKeys: String, CodingKey {
        case totalRequests = "total_requests"
        case totalTokens = "total_tokens"
        case totalInputTokens = "total_input_tokens"
        case totalOutputTokens = "total_output_tokens"
        case averageLatency = "average_latency"
        case periodStart = "period_start"
        case periodEnd = "period_end"
    }
}
