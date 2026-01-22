//
//  WebSocketManager.swift
//  vLLMStudio
//
//  Created for vLLM Studio iOS
//  WebSocket manager for real-time updates using URLSessionWebSocketTask
//

import Foundation

// MARK: - WebSocket Delegate Protocol

/// Protocol for WebSocket event callbacks
public protocol WebSocketDelegate: AnyObject, Sendable {
    /// Called when connection is established
    func webSocketDidConnect(_ manager: WebSocketManager)

    /// Called when connection is closed
    func webSocketDidDisconnect(_ manager: WebSocketManager, code: URLSessionWebSocketTask.CloseCode?, reason: String?)

    /// Called when a text message is received
    func webSocket(_ manager: WebSocketManager, didReceiveText text: String)

    /// Called when binary data is received
    func webSocket(_ manager: WebSocketManager, didReceiveData data: Data)

    /// Called when an error occurs
    func webSocket(_ manager: WebSocketManager, didFailWithError error: Error)
}

// MARK: - WebSocket Manager

/// WebSocket manager for real-time bidirectional communication
@MainActor
public final class WebSocketManager: NSObject, ObservableObject {
    // MARK: - Types

    /// WebSocket connection state
    public enum ConnectionState: Sendable, Equatable {
        case disconnected
        case connecting
        case connected
        case reconnecting(attempt: Int)
        case failed(String)
    }

    /// Configuration options
    public struct Configuration: Sendable {
        /// Whether to automatically reconnect on disconnection
        public let autoReconnect: Bool

        /// Maximum number of reconnection attempts
        public let maxReconnectAttempts: Int

        /// Base delay for reconnection (in seconds)
        public let reconnectBaseDelay: TimeInterval

        /// Maximum delay cap for reconnection (in seconds)
        public let maxReconnectDelay: TimeInterval

        /// Ping interval (in seconds)
        public let pingInterval: TimeInterval

        /// Pong timeout (in seconds)
        public let pongTimeout: TimeInterval

        public init(
            autoReconnect: Bool = true,
            maxReconnectAttempts: Int = 5,
            reconnectBaseDelay: TimeInterval = 1.0,
            maxReconnectDelay: TimeInterval = 30.0,
            pingInterval: TimeInterval = 30.0,
            pongTimeout: TimeInterval = 10.0
        ) {
            self.autoReconnect = autoReconnect
            self.maxReconnectAttempts = maxReconnectAttempts
            self.reconnectBaseDelay = reconnectBaseDelay
            self.maxReconnectDelay = maxReconnectDelay
            self.pingInterval = pingInterval
            self.pongTimeout = pongTimeout
        }

        public static let `default` = Configuration()
    }

    /// WebSocket message type
    public enum Message: Sendable {
        case text(String)
        case data(Data)

        var urlSessionMessage: URLSessionWebSocketTask.Message {
            switch self {
            case .text(let string):
                return .string(string)
            case .data(let data):
                return .data(data)
            }
        }
    }

    // MARK: - Published Properties

    /// Current connection state
    @Published public private(set) var connectionState: ConnectionState = .disconnected

    /// Whether currently connected
    @Published public private(set) var isConnected: Bool = false

    // MARK: - Properties

    /// Delegate for receiving events
    public weak var delegate: WebSocketDelegate?

    /// Configuration
    public let configuration: Configuration

    /// Auth service for bearer token
    private let authService: AuthServiceProtocol?

    /// Current WebSocket URL
    private var currentURL: URL?

    /// WebSocket task
    private var webSocketTask: URLSessionWebSocketTask?

    /// URL session
    private var session: URLSession?

    /// Reconnection attempt counter
    private var reconnectAttempt = 0

    /// Whether we intentionally disconnected
    private var intentionalDisconnect = false

    /// Ping task
    private var pingTask: Task<Void, Never>?

    /// Receive task
    private var receiveTask: Task<Void, Never>?

    /// Message handlers
    private var messageHandlers: [(Message) -> Void] = []

    // MARK: - Initialization

    /// Initialize WebSocket manager
    /// - Parameters:
    ///   - configuration: Configuration options
    ///   - authService: Optional auth service for Bearer token
    public init(
        configuration: Configuration = .default,
        authService: AuthServiceProtocol? = nil
    ) {
        self.configuration = configuration
        self.authService = authService
        super.init()
    }

    deinit {
        pingTask?.cancel()
        receiveTask?.cancel()
        webSocketTask?.cancel(with: .goingAway, reason: nil)
    }

    // MARK: - Public Methods

    /// Connect to a WebSocket URL
    /// - Parameter url: The WebSocket URL to connect to
    public func connect(to url: URL) async {
        guard connectionState != .connecting && connectionState != .connected else { return }

        intentionalDisconnect = false
        currentURL = url
        reconnectAttempt = 0

        await performConnect(to: url)
    }

    /// Disconnect from the WebSocket
    /// - Parameters:
    ///   - code: Close code
    ///   - reason: Close reason
    public func disconnect(code: URLSessionWebSocketTask.CloseCode = .normalClosure, reason: String? = nil) {
        intentionalDisconnect = true

        pingTask?.cancel()
        pingTask = nil

        receiveTask?.cancel()
        receiveTask = nil

        let reasonData = reason?.data(using: .utf8)
        webSocketTask?.cancel(with: code, reason: reasonData)
        webSocketTask = nil

        connectionState = .disconnected
        isConnected = false

        delegate?.webSocketDidDisconnect(self, code: code, reason: reason)
    }

    /// Reconnect to the last URL
    public func reconnect() async {
        guard let url = currentURL else { return }
        intentionalDisconnect = false
        reconnectAttempt = 0
        await performConnect(to: url)
    }

    /// Send a text message
    /// - Parameter text: The text to send
    public func send(_ text: String) async throws {
        try await send(.text(text))
    }

    /// Send binary data
    /// - Parameter data: The data to send
    public func send(_ data: Data) async throws {
        try await send(.data(data))
    }

    /// Send a message
    /// - Parameter message: The message to send
    public func send(_ message: Message) async throws {
        guard let webSocketTask = webSocketTask, isConnected else {
            throw NetworkError.webSocketSendFailed("Not connected")
        }

        do {
            try await webSocketTask.send(message.urlSessionMessage)
        } catch {
            throw NetworkError.webSocketSendFailed(error.localizedDescription)
        }
    }

    /// Send a Codable object as JSON
    /// - Parameter object: The object to encode and send
    public func sendJSON<T: Encodable>(_ object: T) async throws {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let data = try encoder.encode(object)
        guard let jsonString = String(data: data, encoding: .utf8) else {
            throw NetworkError.encodingFailed("Cannot convert to UTF-8 string")
        }
        try await send(jsonString)
    }

    /// Add a message handler
    /// - Parameter handler: Closure called when a message is received
    public func onMessage(_ handler: @escaping (Message) -> Void) {
        messageHandlers.append(handler)
    }

    /// Create an AsyncThrowingStream of messages
    /// - Returns: Stream of incoming messages
    public func messages() -> AsyncThrowingStream<Message, Error> {
        AsyncThrowingStream { continuation in
            self.onMessage { message in
                continuation.yield(message)
            }

            // Handle disconnection
            continuation.onTermination = { [weak self] _ in
                self?.messageHandlers.removeAll()
            }
        }
    }

    // MARK: - Private Methods

    private func performConnect(to url: URL) async {
        connectionState = reconnectAttempt > 0 ? .reconnecting(attempt: reconnectAttempt) : .connecting

        // Create session configuration
        let sessionConfig = URLSessionConfiguration.default
        sessionConfig.waitsForConnectivity = true

        // Create session
        session = URLSession(configuration: sessionConfig, delegate: self, delegateQueue: nil)

        // Create request with auth
        var request = URLRequest(url: url)
        request.setValue("websocket", forHTTPHeaderField: "Upgrade")
        request.setValue("Upgrade", forHTTPHeaderField: "Connection")

        // Add auth token if available
        if let authService = authService {
            if let apiKey = await authService.apiKey {
                request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
            }
        }

        // Create WebSocket task
        webSocketTask = session?.webSocketTask(with: request)

        // Start receiving
        startReceiving()

        // Resume task
        webSocketTask?.resume()
    }

    private func startReceiving() {
        receiveTask?.cancel()
        receiveTask = Task { [weak self] in
            guard let self = self else { return }

            while !Task.isCancelled {
                do {
                    guard let task = await self.webSocketTask else { break }
                    let message = try await task.receive()

                    await MainActor.run {
                        self.handleReceivedMessage(message)
                    }
                } catch {
                    await MainActor.run {
                        self.handleReceiveError(error)
                    }
                    break
                }
            }
        }
    }

    private func handleReceivedMessage(_ message: URLSessionWebSocketTask.Message) {
        let wrappedMessage: Message

        switch message {
        case .string(let text):
            wrappedMessage = .text(text)
            delegate?.webSocket(self, didReceiveText: text)

        case .data(let data):
            wrappedMessage = .data(data)
            delegate?.webSocket(self, didReceiveData: data)

        @unknown default:
            return
        }

        // Notify handlers
        for handler in messageHandlers {
            handler(wrappedMessage)
        }
    }

    private func handleReceiveError(_ error: Error) {
        // Check if this is just a cancellation
        if (error as NSError).code == 57 || (error as NSError).code == -999 {
            // Socket closed or cancelled, not an error
            if !intentionalDisconnect {
                handleDisconnection()
            }
            return
        }

        delegate?.webSocket(self, didFailWithError: error)

        if !intentionalDisconnect {
            handleDisconnection()
        }
    }

    private func handleDisconnection() {
        isConnected = false
        webSocketTask = nil
        pingTask?.cancel()

        // Attempt reconnection if configured
        if configuration.autoReconnect && reconnectAttempt < configuration.maxReconnectAttempts {
            reconnectAttempt += 1
            connectionState = .reconnecting(attempt: reconnectAttempt)

            let delay = calculateReconnectDelay(attempt: reconnectAttempt)

            Task {
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))

                if !intentionalDisconnect, let url = currentURL {
                    await performConnect(to: url)
                }
            }
        } else {
            connectionState = .disconnected
            delegate?.webSocketDidDisconnect(self, code: nil, reason: "Connection lost")
        }
    }

    private func startPingTimer() {
        pingTask?.cancel()
        pingTask = Task { [weak self, configuration] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(configuration.pingInterval * 1_000_000_000))

                guard !Task.isCancelled else { break }

                await self?.sendPing()
            }
        }
    }

    private func sendPing() async {
        webSocketTask?.sendPing { [weak self] error in
            guard let self = self else { return }

            if let error = error {
                Task { @MainActor in
                    self.delegate?.webSocket(self, didFailWithError: error)
                    self.handleDisconnection()
                }
            }
        }
    }

    private func calculateReconnectDelay(attempt: Int) -> TimeInterval {
        let exponentialDelay = configuration.reconnectBaseDelay * pow(2.0, Double(attempt - 1))
        let jitter = Double.random(in: 0...(exponentialDelay * 0.25))
        return min(exponentialDelay + jitter, configuration.maxReconnectDelay)
    }
}

// MARK: - URLSessionWebSocketDelegate

extension WebSocketManager: URLSessionWebSocketDelegate {
    public nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        Task { @MainActor in
            self.connectionState = .connected
            self.isConnected = true
            self.reconnectAttempt = 0
            self.delegate?.webSocketDidConnect(self)
            self.startPingTimer()
        }
    }

    public nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        let reasonString = reason.flatMap { String(data: $0, encoding: .utf8) }

        Task { @MainActor in
            self.isConnected = false
            self.pingTask?.cancel()

            if !self.intentionalDisconnect {
                self.handleDisconnection()
            }

            self.delegate?.webSocketDidDisconnect(self, code: closeCode, reason: reasonString)
        }
    }
}

// MARK: - URLSessionDelegate

extension WebSocketManager: URLSessionDelegate {
    public nonisolated func urlSession(
        _ session: URLSession,
        didBecomeInvalidWithError error: Error?
    ) {
        Task { @MainActor in
            if let error = error {
                self.connectionState = .failed(error.localizedDescription)
                self.delegate?.webSocket(self, didFailWithError: error)
            }
            self.isConnected = false
        }
    }
}

// MARK: - Typed Message Support

extension WebSocketManager {
    /// WebSocket message types for vLLM Studio
    public enum VLLMMessage: Codable, Sendable {
        case gpuMetrics(GPUMetricsMessage)
        case modelStatus(ModelStatusMessage)
        case launchProgress(LaunchProgressMessage)
        case error(ErrorMessage)
        case ping
        case pong

        enum CodingKeys: String, CodingKey {
            case type
            case payload
        }

        public init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            let type = try container.decode(String.self, forKey: .type)

            switch type {
            case "gpu_metrics":
                let payload = try container.decode(GPUMetricsMessage.self, forKey: .payload)
                self = .gpuMetrics(payload)
            case "model_status":
                let payload = try container.decode(ModelStatusMessage.self, forKey: .payload)
                self = .modelStatus(payload)
            case "launch_progress":
                let payload = try container.decode(LaunchProgressMessage.self, forKey: .payload)
                self = .launchProgress(payload)
            case "error":
                let payload = try container.decode(ErrorMessage.self, forKey: .payload)
                self = .error(payload)
            case "ping":
                self = .ping
            case "pong":
                self = .pong
            default:
                throw DecodingError.dataCorruptedError(
                    forKey: .type,
                    in: container,
                    debugDescription: "Unknown message type: \(type)"
                )
            }
        }

        public func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)

            switch self {
            case .gpuMetrics(let payload):
                try container.encode("gpu_metrics", forKey: .type)
                try container.encode(payload, forKey: .payload)
            case .modelStatus(let payload):
                try container.encode("model_status", forKey: .type)
                try container.encode(payload, forKey: .payload)
            case .launchProgress(let payload):
                try container.encode("launch_progress", forKey: .type)
                try container.encode(payload, forKey: .payload)
            case .error(let payload):
                try container.encode("error", forKey: .type)
                try container.encode(payload, forKey: .payload)
            case .ping:
                try container.encode("ping", forKey: .type)
            case .pong:
                try container.encode("pong", forKey: .type)
            }
        }
    }

    /// GPU metrics update message
    public struct GPUMetricsMessage: Codable, Sendable {
        public let gpus: [GPUInfo]
        public let timestamp: Date
    }

    /// Model status change message
    public struct ModelStatusMessage: Codable, Sendable {
        public let modelName: String?
        public let status: String
        public let loaded: Bool

        enum CodingKeys: String, CodingKey {
            case modelName = "model_name"
            case status
            case loaded
        }
    }

    /// Launch progress update message
    public struct LaunchProgressMessage: Codable, Sendable {
        public let recipeId: String
        public let progress: Double
        public let stage: String
        public let message: String?

        enum CodingKeys: String, CodingKey {
            case recipeId = "recipe_id"
            case progress
            case stage
            case message
        }
    }

    /// Error message
    public struct ErrorMessage: Codable, Sendable {
        public let code: String
        public let message: String
    }

    /// Parse a text message as a VLLMMessage
    /// - Parameter text: The JSON text to parse
    /// - Returns: Parsed VLLMMessage or nil
    public func parseVLLMMessage(_ text: String) -> VLLMMessage? {
        guard let data = text.data(using: .utf8) else { return nil }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        return try? decoder.decode(VLLMMessage.self, from: data)
    }

    /// Create a typed message stream
    /// - Returns: AsyncThrowingStream of parsed VLLMMessage
    public func vllmMessages() -> AsyncThrowingStream<VLLMMessage, Error> {
        AsyncThrowingStream { continuation in
            self.onMessage { message in
                if case .text(let text) = message,
                   let vllmMessage = self.parseVLLMMessage(text) {
                    continuation.yield(vllmMessage)
                }
            }
        }
    }
}
