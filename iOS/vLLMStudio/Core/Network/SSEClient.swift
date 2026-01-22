//
//  SSEClient.swift
//  vLLMStudio
//
//  Created for vLLM Studio iOS
//  Server-Sent Events client for chat streaming with auto-reconnection
//

import Foundation

// MARK: - SSE Client

/// Server-Sent Events client for real-time streaming
/// Provides AsyncThrowingStream-based API with automatic reconnection logic
public final class SSEClient: NSObject, Sendable {
    // MARK: - Types

    /// Configuration options for the SSE client
    public struct Configuration: Sendable {
        /// Maximum number of reconnection attempts
        public let maxReconnectAttempts: Int

        /// Base delay for reconnection (in seconds)
        public let reconnectBaseDelay: TimeInterval

        /// Maximum delay cap for reconnection (in seconds)
        public let maxReconnectDelay: TimeInterval

        /// Timeout for initial connection (in seconds)
        public let connectionTimeout: TimeInterval

        /// Whether to automatically reconnect on disconnection
        public let autoReconnect: Bool

        public init(
            maxReconnectAttempts: Int = 5,
            reconnectBaseDelay: TimeInterval = 1.0,
            maxReconnectDelay: TimeInterval = 30.0,
            connectionTimeout: TimeInterval = 30.0,
            autoReconnect: Bool = true
        ) {
            self.maxReconnectAttempts = maxReconnectAttempts
            self.reconnectBaseDelay = reconnectBaseDelay
            self.maxReconnectDelay = maxReconnectDelay
            self.connectionTimeout = connectionTimeout
            self.autoReconnect = autoReconnect
        }

        public static let `default` = Configuration()
    }

    /// State of the SSE connection
    public enum ConnectionState: Sendable {
        case disconnected
        case connecting
        case connected
        case reconnecting(attempt: Int)
        case failed(Error)
    }

    /// Parsed SSE event
    public struct Event: Sendable, Equatable {
        /// Event data payload
        public let data: String

        /// Event type (e.g., "message", "error")
        public let type: String?

        /// Event ID for tracking
        public let id: String?

        /// Retry interval suggested by server (in milliseconds)
        public let retry: Int?

        public init(data: String, type: String? = nil, id: String? = nil, retry: Int? = nil) {
            self.data = data
            self.type = type
            self.id = id
            self.retry = retry
        }

        /// Check if this is a done/end event
        public var isDone: Bool {
            data == "[DONE]" || type == "done" || type == "end"
        }

        /// Attempt to decode the data as JSON
        public func decode<T: Decodable>(as type: T.Type, decoder: JSONDecoder = JSONDecoder()) throws -> T {
            guard let jsonData = data.data(using: .utf8) else {
                throw NetworkError.decodingFailed("Cannot convert event data to UTF-8")
            }
            return try decoder.decode(type, from: jsonData)
        }
    }

    // MARK: - Properties

    private let configuration: Configuration
    private let authService: AuthServiceProtocol?
    private let sessionConfiguration: URLSessionConfiguration

    // MARK: - Initialization

    /// Initialize an SSE client
    /// - Parameters:
    ///   - configuration: Client configuration
    ///   - authService: Optional auth service for Bearer token
    public init(
        configuration: Configuration = .default,
        authService: AuthServiceProtocol? = nil
    ) {
        self.configuration = configuration
        self.authService = authService

        let sessionConfig = URLSessionConfiguration.default
        sessionConfig.timeoutIntervalForRequest = configuration.connectionTimeout
        sessionConfig.timeoutIntervalForResource = 300
        sessionConfig.httpAdditionalHeaders = [
            "Accept": "text/event-stream",
            "Cache-Control": "no-cache"
        ]
        self.sessionConfiguration = sessionConfig

        super.init()
    }

    // MARK: - Public Methods

    /// Connect to an SSE endpoint and return an AsyncThrowingStream of events
    /// - Parameters:
    ///   - url: The SSE endpoint URL
    ///   - headers: Additional headers to include
    ///   - lastEventId: Last event ID for resumption
    /// - Returns: AsyncThrowingStream of SSE events
    public func stream(
        url: URL,
        headers: [String: String]? = nil,
        lastEventId: String? = nil
    ) -> AsyncThrowingStream<Event, Error> {
        AsyncThrowingStream { continuation in
            Task {
                await self.performStream(
                    url: url,
                    headers: headers,
                    lastEventId: lastEventId,
                    continuation: continuation
                )
            }
        }
    }

    /// Connect to an SSE endpoint with automatic reconnection
    /// - Parameters:
    ///   - url: The SSE endpoint URL
    ///   - headers: Additional headers to include
    /// - Returns: AsyncThrowingStream of SSE events with auto-reconnection
    public func streamWithReconnection(
        url: URL,
        headers: [String: String]? = nil
    ) -> AsyncThrowingStream<Event, Error> {
        AsyncThrowingStream { continuation in
            Task {
                var lastEventId: String?
                var reconnectAttempt = 0
                var shouldContinue = true

                while shouldContinue {
                    do {
                        // Reset reconnect attempt on successful connection
                        for try await event in self.stream(url: url, headers: headers, lastEventId: lastEventId) {
                            reconnectAttempt = 0

                            // Track last event ID for reconnection
                            if let eventId = event.id {
                                lastEventId = eventId
                            }

                            continuation.yield(event)

                            // Check for done event
                            if event.isDone {
                                shouldContinue = false
                                break
                            }
                        }

                        // Stream ended normally
                        if shouldContinue && self.configuration.autoReconnect {
                            // Attempt reconnection
                            continue
                        } else {
                            shouldContinue = false
                        }
                    } catch is CancellationError {
                        shouldContinue = false
                        continuation.finish(throwing: NetworkError.cancelled)
                    } catch {
                        // Check if we should reconnect
                        if self.configuration.autoReconnect &&
                           reconnectAttempt < self.configuration.maxReconnectAttempts {
                            reconnectAttempt += 1
                            let delay = self.calculateReconnectDelay(attempt: reconnectAttempt)
                            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                            continue
                        } else {
                            shouldContinue = false
                            continuation.finish(throwing: error)
                        }
                    }
                }

                continuation.finish()
            }
        }
    }

    // MARK: - Private Methods

    private func performStream(
        url: URL,
        headers: [String: String]?,
        lastEventId: String?,
        continuation: AsyncThrowingStream<Event, Error>.Continuation
    ) async {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")

        // Add custom headers
        headers?.forEach { key, value in
            request.setValue(value, forHTTPHeaderField: key)
        }

        // Add last event ID for resumption
        if let lastEventId = lastEventId {
            request.setValue(lastEventId, forHTTPHeaderField: "Last-Event-ID")
        }

        // Add auth token if available
        if let authService = authService {
            if let apiKey = await authService.apiKey {
                request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
            }
        }

        let session = URLSession(configuration: sessionConfiguration)

        do {
            let (asyncBytes, response) = try await session.bytes(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                continuation.finish(throwing: NetworkError.invalidResponse("Not an HTTP response"))
                return
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                let error = NetworkError.from(statusCode: httpResponse.statusCode, data: nil)
                continuation.finish(throwing: error)
                return
            }

            // Verify content type
            let contentType = httpResponse.value(forHTTPHeaderField: "Content-Type") ?? ""
            guard contentType.contains("text/event-stream") || contentType.contains("application/json") else {
                continuation.finish(throwing: NetworkError.sseConnectionFailed("Invalid content type: \(contentType)"))
                return
            }

            // Parse SSE events
            var parser = SSEParser()

            for try await byte in asyncBytes {
                if let events = parser.append(byte) {
                    for event in events {
                        continuation.yield(event)

                        if event.isDone {
                            continuation.finish()
                            return
                        }
                    }
                }
            }

            // Handle any remaining buffered data
            if let events = parser.flush() {
                for event in events {
                    continuation.yield(event)
                }
            }

            continuation.finish()
        } catch let error as URLError {
            continuation.finish(throwing: NetworkError.from(urlError: error))
        } catch is CancellationError {
            continuation.finish(throwing: NetworkError.cancelled)
        } catch {
            continuation.finish(throwing: NetworkError.sseConnectionFailed(error.localizedDescription))
        }
    }

    private func calculateReconnectDelay(attempt: Int) -> TimeInterval {
        let exponentialDelay = configuration.reconnectBaseDelay * pow(2.0, Double(attempt - 1))
        let jitter = Double.random(in: 0...(exponentialDelay * 0.25))
        return min(exponentialDelay + jitter, configuration.maxReconnectDelay)
    }
}

// MARK: - SSE Parser

/// Parser for Server-Sent Events stream
private struct SSEParser {
    private var lineBuffer = ""
    private var eventData = ""
    private var eventType: String?
    private var eventId: String?
    private var eventRetry: Int?

    /// Append a byte and return any complete events
    mutating func append(_ byte: UInt8) -> [SSEClient.Event]? {
        let char = Character(UnicodeScalar(byte))

        // Handle line endings
        if char == "\n" {
            defer { lineBuffer = "" }
            return processLine(lineBuffer)
        } else if char != "\r" {
            lineBuffer.append(char)
        }

        return nil
    }

    /// Flush any remaining buffered data
    mutating func flush() -> [SSEClient.Event]? {
        guard !lineBuffer.isEmpty else { return nil }

        let events = processLine(lineBuffer)
        lineBuffer = ""
        return events
    }

    /// Process a complete line
    private mutating func processLine(_ line: String) -> [SSEClient.Event]? {
        // Empty line indicates end of event
        if line.isEmpty {
            guard !eventData.isEmpty else { return nil }

            let event = SSEClient.Event(
                data: eventData.trimmingCharacters(in: .newlines),
                type: eventType,
                id: eventId,
                retry: eventRetry
            )

            // Reset for next event
            eventData = ""
            eventType = nil
            eventId = nil
            eventRetry = nil

            return [event]
        }

        // Comment line (starts with :)
        if line.hasPrefix(":") {
            return nil
        }

        // Parse field
        let colonIndex = line.firstIndex(of: ":")
        let field: String
        let value: String

        if let colonIndex = colonIndex {
            field = String(line[..<colonIndex])
            let valueStart = line.index(after: colonIndex)
            value = String(line[valueStart...]).trimmingCharacters(in: .init(charactersIn: " "))
        } else {
            field = line
            value = ""
        }

        // Handle field
        switch field {
        case "data":
            if !eventData.isEmpty {
                eventData += "\n"
            }
            eventData += value

        case "event":
            eventType = value

        case "id":
            // SSE spec: id should not contain null
            if !value.contains("\0") {
                eventId = value
            }

        case "retry":
            // Parse retry as integer milliseconds
            eventRetry = Int(value)

        default:
            // Ignore unknown fields per SSE spec
            break
        }

        return nil
    }
}

// MARK: - Chat Streaming Extensions

extension SSEClient {
    /// Stream chat completion events
    /// - Parameters:
    ///   - baseURL: Base URL of the API
    ///   - sessionId: Chat session ID
    ///   - message: Message to send
    ///   - options: Chat options
    /// - Returns: AsyncThrowingStream of chat events
    public func streamChat(
        baseURL: URL,
        sessionId: String,
        message: MessageCreateBody
    ) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            Task {
                // Build the URL
                let url = baseURL.appendingPathComponent("/api/chat/sessions/\(sessionId)/messages")

                // Create POST request
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.setValue("text/event-stream", forHTTPHeaderField: "Accept")

                // Add auth token
                if let authService = self.authService, let apiKey = await authService.apiKey {
                    request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
                }

                // Encode body
                let encoder = JSONEncoder()
                encoder.keyEncodingStrategy = .convertToSnakeCase
                request.httpBody = try? encoder.encode(message)

                let session = URLSession(configuration: self.sessionConfiguration)

                do {
                    let (asyncBytes, response) = try await session.bytes(for: request)

                    guard let httpResponse = response as? HTTPURLResponse,
                          (200...299).contains(httpResponse.statusCode) else {
                        let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
                        continuation.finish(throwing: NetworkError.from(statusCode: statusCode, data: nil))
                        return
                    }

                    var parser = SSEParser()

                    for try await byte in asyncBytes {
                        if let events = parser.append(byte) {
                            for event in events {
                                if event.isDone {
                                    continuation.yield(.done)
                                    continuation.finish()
                                    return
                                }

                                // Parse chat event
                                if let chatEvent = self.parseChatEvent(event) {
                                    continuation.yield(chatEvent)
                                }
                            }
                        }
                    }

                    // Flush remaining
                    if let events = parser.flush() {
                        for event in events {
                            if let chatEvent = self.parseChatEvent(event) {
                                continuation.yield(chatEvent)
                            }
                        }
                    }

                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    private func parseChatEvent(_ event: Event) -> ChatStreamEvent? {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        switch event.type {
        case "content":
            if let data = event.data.data(using: .utf8),
               let content = try? decoder.decode(ContentDelta.self, from: data) {
                return .content(content.text)
            }
            return .content(event.data)

        case "thinking":
            return .thinking(event.data)

        case "tool_call":
            if let data = event.data.data(using: .utf8),
               let toolCall = try? decoder.decode(ToolCallEvent.self, from: data) {
                return .toolCall(toolCall)
            }
            return nil

        case "tool_result":
            if let data = event.data.data(using: .utf8),
               let toolResult = try? decoder.decode(ToolResultEvent.self, from: data) {
                return .toolResult(toolResult)
            }
            return nil

        case "artifact":
            if let data = event.data.data(using: .utf8),
               let artifact = try? decoder.decode(ArtifactEvent.self, from: data) {
                return .artifact(artifact)
            }
            return nil

        case "error":
            return .error(event.data)

        case "done", "end":
            return .done

        default:
            // Default to content for untyped events
            return .content(event.data)
        }
    }
}

// MARK: - Chat Stream Event Types

/// Events emitted during chat streaming
public enum ChatStreamEvent: Sendable {
    case content(String)
    case thinking(String)
    case toolCall(ToolCallEvent)
    case toolResult(ToolResultEvent)
    case artifact(ArtifactEvent)
    case error(String)
    case done
}

public struct ContentDelta: Codable, Sendable {
    public let text: String
}

public struct ToolCallEvent: Codable, Sendable {
    public let id: String
    public let name: String
    public let serverId: String?
    public let arguments: [String: AnyCodableValue]?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case serverId = "server_id"
        case arguments
    }
}

public struct ToolResultEvent: Codable, Sendable {
    public let id: String
    public let name: String
    public let result: String?
    public let error: String?
    public let isSuccess: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case result
        case error
        case isSuccess = "is_success"
    }
}

public struct ArtifactEvent: Codable, Sendable {
    public let id: String
    public let type: String
    public let title: String?
    public let content: String
    public let language: String?
}

/// Type-safe wrapper for any codable value
public enum AnyCodableValue: Codable, Sendable {
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
}
