//
//  ChatService.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation

/// Service for managing chat operations including sessions, messages, and streaming.
@Observable
final class ChatService {

    // MARK: - Singleton

    static let shared = ChatService()

    // MARK: - Properties

    /// All chat sessions
    var sessions: [ChatSession] = []

    /// Currently selected session ID
    var currentSessionId: UUID?

    /// Whether a message is currently streaming
    var isStreaming: Bool = false

    /// Current streaming message content
    var streamingContent: String = ""

    /// Loading state
    var isLoading: Bool = false

    /// Error message
    var errorMessage: String?

    // MARK: - Computed Properties

    /// The currently selected session
    var currentSession: ChatSession? {
        sessions.first { $0.id == currentSessionId }
    }

    // MARK: - Initialization

    private init() {}

    // MARK: - Session Management

    /// Fetches all chat sessions from the server
    @MainActor
    func fetchSessions() async throws {
        isLoading = true
        defer { isLoading = false }

        do {
            let response: ChatSessionsResponse = try await APIClient.shared.request(.chatSessions)
            sessions = response.sessions
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    /// Creates a new chat session
    /// - Parameters:
    ///   - title: The session title
    ///   - modelId: The model to use
    ///   - systemPrompt: Optional system prompt
    /// - Returns: The created session
    @MainActor
    func createSession(
        title: String,
        modelId: String,
        systemPrompt: String? = nil
    ) async throws -> ChatSession {
        let request = CreateSessionRequest(
            title: title,
            modelId: modelId,
            systemPrompt: systemPrompt
        )

        let session: ChatSession = try await APIClient.shared.request(
            .createChatSession,
            body: request
        )

        sessions.insert(session, at: 0)
        currentSessionId = session.id
        return session
    }

    /// Deletes a chat session
    /// - Parameter sessionId: The session ID to delete
    @MainActor
    func deleteSession(sessionId: UUID) async throws {
        try await APIClient.shared.requestNoContent(
            .deleteChatSession(id: sessionId.uuidString)
        )

        sessions.removeAll { $0.id == sessionId }

        if currentSessionId == sessionId {
            currentSessionId = sessions.first?.id
        }
    }

    /// Updates a session's title
    /// - Parameters:
    ///   - sessionId: The session ID
    ///   - title: The new title
    @MainActor
    func updateSessionTitle(sessionId: UUID, title: String) async throws {
        let request = UpdateSessionRequest(title: title)

        let updated: ChatSession = try await APIClient.shared.request(
            .updateChatSession(id: sessionId.uuidString),
            body: request
        )

        if let index = sessions.firstIndex(where: { $0.id == sessionId }) {
            sessions[index] = updated
        }
    }

    /// Forks a session at a specific message index
    /// - Parameters:
    ///   - sessionId: The session to fork
    ///   - messageIndex: The message index to fork at
    /// - Returns: The new forked session
    @MainActor
    func forkSession(sessionId: UUID, at messageIndex: Int) async throws -> ChatSession {
        let forked: ChatSession = try await APIClient.shared.request(
            .forkSession(sessionId: sessionId.uuidString, messageIndex: messageIndex)
        )

        sessions.insert(forked, at: 0)
        currentSessionId = forked.id
        return forked
    }

    // MARK: - Message Sending

    /// Sends a message and streams the response
    /// - Parameters:
    ///   - content: The message content
    ///   - sessionId: The session ID
    ///   - onChunk: Callback for each streamed chunk
    @MainActor
    func sendMessage(
        content: String,
        sessionId: UUID,
        onChunk: ((String) -> Void)? = nil
    ) async throws {
        guard !isStreaming else { return }

        isStreaming = true
        streamingContent = ""
        defer { isStreaming = false }

        let request = ChatCompletionRequest(
            model: currentSession?.modelId ?? "default",
            messages: [
                ChatCompletionMessage(role: "user", content: content)
            ],
            stream: true
        )

        do {
            let stream = try await APIClient.shared.stream(
                .chatCompletions,
                body: request
            )

            for try await event in stream {
                if let chunk = parseStreamChunk(event.data) {
                    streamingContent += chunk
                    onChunk?(chunk)
                }
            }

            // After streaming completes, the message should be saved
            // This would typically be handled by the server

        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    /// Sends a message without streaming
    /// - Parameters:
    ///   - content: The message content
    ///   - sessionId: The session ID
    /// - Returns: The assistant's response
    @MainActor
    func sendMessageSync(
        content: String,
        sessionId: UUID
    ) async throws -> Message {
        let request = ChatCompletionRequest(
            model: currentSession?.modelId ?? "default",
            messages: [
                ChatCompletionMessage(role: "user", content: content)
            ],
            stream: false
        )

        let response: ChatCompletionResponse = try await APIClient.shared.request(
            .chatCompletions,
            body: request
        )

        guard let choice = response.choices.first else {
            throw NetworkError.emptyResponse
        }

        return Message(
            id: UUID(),
            role: .assistant,
            content: choice.message.content,
            createdAt: Date()
        )
    }

    // MARK: - Message Parsing

    /// Parses a streaming chunk from the server
    private func parseStreamChunk(_ data: String) -> String? {
        guard data != "[DONE]" else { return nil }

        guard let jsonData = data.data(using: .utf8) else { return nil }

        do {
            let chunk = try JSONDecoder().decode(StreamChunk.self, from: jsonData)
            return chunk.choices.first?.delta.content
        } catch {
            return nil
        }
    }

    // MARK: - Cancellation

    /// Cancels the current streaming operation
    func cancelStreaming() {
        isStreaming = false
        // Additional cancellation logic would go here
    }
}

// MARK: - Request/Response Types

struct ChatSessionsResponse: Decodable {
    let sessions: [ChatSession]
}

struct CreateSessionRequest: Encodable {
    let title: String
    let modelId: String
    let systemPrompt: String?
}

struct UpdateSessionRequest: Encodable {
    let title: String
}

struct ChatCompletionRequest: Encodable {
    let model: String
    let messages: [ChatCompletionMessage]
    let stream: Bool
    let temperature: Double?
    let maxTokens: Int?

    init(
        model: String,
        messages: [ChatCompletionMessage],
        stream: Bool = false,
        temperature: Double? = nil,
        maxTokens: Int? = nil
    ) {
        self.model = model
        self.messages = messages
        self.stream = stream
        self.temperature = temperature
        self.maxTokens = maxTokens
    }
}

struct ChatCompletionMessage: Codable {
    let role: String
    let content: String
}

struct ChatCompletionResponse: Decodable {
    let id: String
    let choices: [ChatChoice]
    let usage: TokenUsage?
}

struct ChatChoice: Decodable {
    let index: Int
    let message: ChatCompletionMessage
    let finishReason: String?
}

struct TokenUsage: Decodable {
    let promptTokens: Int
    let completionTokens: Int
    let totalTokens: Int
}

struct StreamChunk: Decodable {
    let choices: [StreamChoice]
}

struct StreamChoice: Decodable {
    let delta: StreamDelta
}

struct StreamDelta: Decodable {
    let content: String?
}

// MARK: - Chat Session

struct ChatSession: Identifiable, Codable {
    let id: UUID
    var title: String
    let modelId: String
    var systemPrompt: String?
    let createdAt: Date
    var updatedAt: Date
    var messages: [Message]

    init(
        id: UUID = UUID(),
        title: String,
        modelId: String,
        systemPrompt: String? = nil,
        messages: [Message] = []
    ) {
        self.id = id
        self.title = title
        self.modelId = modelId
        self.systemPrompt = systemPrompt
        self.createdAt = Date()
        self.updatedAt = Date()
        self.messages = messages
    }
}

// MARK: - Message

struct Message: Identifiable, Codable {
    let id: UUID
    let role: MessageRole
    var content: String
    let createdAt: Date
    var tokenCount: Int?
    var artifacts: [Artifact]?
    var toolCalls: [ToolCall]?
    var thinkingContent: String?

    init(
        id: UUID = UUID(),
        role: MessageRole,
        content: String,
        createdAt: Date = Date(),
        tokenCount: Int? = nil,
        artifacts: [Artifact]? = nil,
        toolCalls: [ToolCall]? = nil,
        thinkingContent: String? = nil
    ) {
        self.id = id
        self.role = role
        self.content = content
        self.createdAt = createdAt
        self.tokenCount = tokenCount
        self.artifacts = artifacts
        self.toolCalls = toolCalls
        self.thinkingContent = thinkingContent
    }
}

enum MessageRole: String, Codable {
    case user
    case assistant
    case system
    case tool
}

struct Artifact: Identifiable, Codable {
    let id: UUID
    let type: ArtifactType
    let title: String?
    let content: String
    let language: String?

    enum ArtifactType: String, Codable {
        case code
        case html
        case markdown
        case svg
        case mermaid
    }
}

struct ToolCall: Identifiable, Codable {
    let id: UUID
    let name: String
    let arguments: String
    var result: String?
    var status: ToolCallStatus

    enum ToolCallStatus: String, Codable {
        case pending
        case running
        case completed
        case failed
    }
}
