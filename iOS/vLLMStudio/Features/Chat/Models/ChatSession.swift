import Foundation
import SwiftData

/// Represents a chat conversation session
@Model
final class ChatSession {
    @Attribute(.unique) var id: UUID
    var title: String
    var modelId: String?
    var systemPrompt: String?
    var parentId: UUID?
    var createdAt: Date
    var updatedAt: Date

    @Relationship(deleteRule: .cascade, inverse: \Message.session)
    var messages: [Message]?

    init(
        id: UUID = UUID(),
        title: String = "New Chat",
        modelId: String? = nil,
        systemPrompt: String? = nil,
        parentId: UUID? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        messages: [Message]? = nil
    ) {
        self.id = id
        self.title = title
        self.modelId = modelId
        self.systemPrompt = systemPrompt
        self.parentId = parentId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.messages = messages
    }
}

// MARK: - API Response Model

/// Chat session data from API
struct ChatSessionResponse: Codable, Identifiable {
    let id: String
    let title: String
    let model: String?
    let parentId: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, model
        case parentId = "parent_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    /// Convert API response to local ChatSession
    func toLocalSession() -> ChatSession {
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        return ChatSession(
            id: UUID(uuidString: id) ?? UUID(),
            title: title,
            modelId: model,
            parentId: parentId.flatMap { UUID(uuidString: $0) },
            createdAt: dateFormatter.date(from: createdAt) ?? Date(),
            updatedAt: dateFormatter.date(from: updatedAt) ?? Date()
        )
    }
}

// MARK: - Session Detail with Messages

struct ChatSessionDetail: Codable {
    let id: String
    let title: String
    let model: String?
    let parentId: String?
    let createdAt: String
    let updatedAt: String
    let messages: [MessageResponse]?

    enum CodingKeys: String, CodingKey {
        case id, title, model, messages
        case parentId = "parent_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Preview Helpers

extension ChatSession {
    static var preview: ChatSession {
        ChatSession(
            title: "Sample Chat",
            modelId: "Qwen/Qwen2.5-72B-Instruct",
            createdAt: Date().addingTimeInterval(-3600),
            updatedAt: Date()
        )
    }

    static var previewList: [ChatSession] {
        [
            ChatSession(title: "Code Review Discussion", modelId: "Qwen/Qwen2.5-72B-Instruct"),
            ChatSession(title: "API Design Help", modelId: "DeepSeek-R1"),
            ChatSession(title: "Bug Investigation", modelId: "Llama-3.3-70B")
        ]
    }
}
