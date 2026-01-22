import Foundation
import SwiftData

/// Message role in a conversation
enum MessageRole: String, Codable {
    case user
    case assistant
    case system
}

/// Represents a single message in a chat session
@Model
final class Message {
    @Attribute(.unique) var id: UUID
    var role: MessageRole
    var content: String
    var images: [String]?
    var isStreaming: Bool
    var modelName: String?
    var createdAt: Date

    // Token counts
    var promptTokens: Int?
    var completionTokens: Int?
    var totalTokens: Int?
    var estimatedCostUSD: Double?

    // Thinking/reasoning content
    var thinkingContent: String?

    // Tool calls stored as JSON
    var toolCallsData: Data?

    // Artifacts stored as JSON
    var artifactsData: Data?

    // Session relationship
    var session: ChatSession?

    init(
        id: UUID = UUID(),
        role: MessageRole,
        content: String,
        images: [String]? = nil,
        isStreaming: Bool = false,
        modelName: String? = nil,
        createdAt: Date = Date(),
        promptTokens: Int? = nil,
        completionTokens: Int? = nil,
        totalTokens: Int? = nil,
        estimatedCostUSD: Double? = nil,
        thinkingContent: String? = nil,
        toolCalls: [ToolCall]? = nil,
        artifacts: [Artifact]? = nil,
        session: ChatSession? = nil
    ) {
        self.id = id
        self.role = role
        self.content = content
        self.images = images
        self.isStreaming = isStreaming
        self.modelName = modelName
        self.createdAt = createdAt
        self.promptTokens = promptTokens
        self.completionTokens = completionTokens
        self.totalTokens = totalTokens
        self.estimatedCostUSD = estimatedCostUSD
        self.thinkingContent = thinkingContent
        self.session = session

        // Encode tool calls
        if let toolCalls = toolCalls {
            self.toolCallsData = try? JSONEncoder().encode(toolCalls)
        }

        // Encode artifacts
        if let artifacts = artifacts {
            self.artifactsData = try? JSONEncoder().encode(artifacts)
        }
    }

    // MARK: - Computed Properties

    var toolCalls: [ToolCall]? {
        get {
            guard let data = toolCallsData else { return nil }
            return try? JSONDecoder().decode([ToolCall].self, from: data)
        }
        set {
            toolCallsData = newValue.flatMap { try? JSONEncoder().encode($0) }
        }
    }

    var artifacts: [Artifact]? {
        get {
            guard let data = artifactsData else { return nil }
            return try? JSONDecoder().decode([Artifact].self, from: data)
        }
        set {
            artifactsData = newValue.flatMap { try? JSONEncoder().encode($0) }
        }
    }

    var hasThinking: Bool {
        thinkingContent != nil && !thinkingContent!.isEmpty
    }

    var hasToolCalls: Bool {
        toolCalls != nil && !toolCalls!.isEmpty
    }

    var hasArtifacts: Bool {
        artifacts != nil && !artifacts!.isEmpty
    }
}

// MARK: - Tool Call Model

struct ToolCall: Codable, Identifiable {
    let id: String
    let type: String
    let function: ToolFunction
    let server: String?
    var result: ToolResult?
    var state: ToolCallState

    init(
        id: String,
        type: String = "function",
        function: ToolFunction,
        server: String? = nil,
        result: ToolResult? = nil,
        state: ToolCallState = .pending
    ) {
        self.id = id
        self.type = type
        self.function = function
        self.server = server
        self.result = result
        self.state = state
    }
}

struct ToolFunction: Codable {
    let name: String
    let arguments: String

    var parsedArguments: [String: Any]? {
        guard let data = arguments.data(using: .utf8) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
}

struct ToolResult: Codable {
    let content: String
    let isError: Bool

    init(content: String, isError: Bool = false) {
        self.content = content
        self.isError = isError
    }
}

enum ToolCallState: String, Codable {
    case pending
    case calling
    case inputStreaming = "input-streaming"
    case complete
    case error
}

// MARK: - API Response Model

struct MessageResponse: Codable, Identifiable {
    let id: String
    let role: String
    let content: String
    let model: String?
    let toolCalls: [ToolCallResponse]?
    let promptTokens: Int?
    let completionTokens: Int?
    let totalTokens: Int?
    let requestPromptTokens: Int?
    let requestToolsTokens: Int?
    let requestTotalInputTokens: Int?
    let requestCompletionTokens: Int?
    let estimatedCostUsd: Double?

    enum CodingKeys: String, CodingKey {
        case id, role, content, model
        case toolCalls = "tool_calls"
        case promptTokens = "prompt_tokens"
        case completionTokens = "completion_tokens"
        case totalTokens = "total_tokens"
        case requestPromptTokens = "request_prompt_tokens"
        case requestToolsTokens = "request_tools_tokens"
        case requestTotalInputTokens = "request_total_input_tokens"
        case requestCompletionTokens = "request_completion_tokens"
        case estimatedCostUsd = "estimated_cost_usd"
    }

    func toLocalMessage() -> Message {
        let messageRole: MessageRole = switch role {
        case "user": .user
        case "assistant": .assistant
        case "system": .system
        default: .assistant
        }

        let localToolCalls = toolCalls?.map { response in
            ToolCall(
                id: response.id,
                type: response.type,
                function: ToolFunction(
                    name: response.function.name,
                    arguments: response.function.arguments
                ),
                server: response.server,
                result: response.result.map { ToolResult(content: $0.content ?? "", isError: $0.isError ?? false) },
                state: .complete
            )
        }

        return Message(
            id: UUID(uuidString: id) ?? UUID(),
            role: messageRole,
            content: content,
            modelName: model,
            promptTokens: promptTokens,
            completionTokens: completionTokens,
            totalTokens: totalTokens,
            estimatedCostUSD: estimatedCostUsd,
            toolCalls: localToolCalls
        )
    }
}

struct ToolCallResponse: Codable {
    let id: String
    let type: String
    let function: ToolFunctionResponse
    let server: String?
    let result: ToolResultResponse?
}

struct ToolFunctionResponse: Codable {
    let name: String
    let arguments: String
}

struct ToolResultResponse: Codable {
    let content: String?
    let isError: Bool?

    enum CodingKeys: String, CodingKey {
        case content
        case isError = "is_error"
    }
}

// MARK: - Preview Helpers

extension Message {
    static var previewUser: Message {
        Message(
            role: .user,
            content: "Can you help me understand how async/await works in Swift?"
        )
    }

    static var previewAssistant: Message {
        Message(
            role: .assistant,
            content: """
            # Understanding async/await in Swift

            Swift's async/await is a modern concurrency model introduced in Swift 5.5. Here's how it works:

            ## Basic Syntax

            ```swift
            func fetchData() async throws -> Data {
                let url = URL(string: "https://api.example.com/data")!
                let (data, _) = try await URLSession.shared.data(from: url)
                return data
            }
            ```

            ## Key Concepts

            1. **async** - Marks a function as asynchronous
            2. **await** - Suspends execution until the async operation completes
            3. **Task** - Creates a new concurrent execution context

            The compiler ensures thread-safety and prevents data races through structured concurrency.
            """,
            modelName: "Qwen2.5-72B-Instruct",
            totalTokens: 256,
            thinkingContent: "The user wants to understand async/await. I should explain the basic syntax, key concepts, and provide a practical example."
        )
    }

    static var previewWithToolCall: Message {
        Message(
            role: .assistant,
            content: "I'll search for that information.",
            modelName: "Qwen2.5-72B-Instruct",
            toolCalls: [
                ToolCall(
                    id: "call_1",
                    function: ToolFunction(
                        name: "web_search",
                        arguments: "{\"query\": \"Swift concurrency best practices 2024\"}"
                    ),
                    server: "web-tools",
                    result: ToolResult(content: "Found 5 relevant articles..."),
                    state: .complete
                )
            ]
        )
    }
}
