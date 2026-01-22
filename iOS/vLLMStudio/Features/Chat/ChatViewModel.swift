import Foundation
import SwiftUI
import Observation

/// MCP Server configuration
struct MCPServer: Identifiable, Codable, Hashable {
    let id: String
    var name: String
    var command: String
    var args: [String]
    var env: [String: String]
    var enabled: Bool
    var icon: String?

    init(
        id: String = UUID().uuidString,
        name: String,
        command: String,
        args: [String] = [],
        env: [String: String] = [:],
        enabled: Bool = true,
        icon: String? = nil
    ) {
        self.id = id
        self.name = name
        self.command = command
        self.args = args
        self.env = env
        self.enabled = enabled
        self.icon = icon
    }
}

/// MCP Tool definition
struct MCPTool: Identifiable, Codable, Hashable {
    var id: String { "\(server):\(name)" }
    let server: String
    let name: String
    let description: String?
    let inputSchema: [String: AnyCodable]?

    init(
        server: String,
        name: String,
        description: String? = nil,
        inputSchema: [String: AnyCodable]? = nil
    ) {
        self.server = server
        self.name = name
        self.description = description
        self.inputSchema = inputSchema
    }
}

/// Type-erased Codable wrapper for dynamic JSON
struct AnyCodable: Codable, Hashable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            value = NSNull()
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            try container.encodeNil()
        }
    }

    func hash(into hasher: inout Hasher) {
        // Simple hash based on string representation
        hasher.combine(String(describing: value))
    }

    static func == (lhs: AnyCodable, rhs: AnyCodable) -> Bool {
        String(describing: lhs.value) == String(describing: rhs.value)
    }
}

/// Session token usage tracking
struct SessionUsage {
    var promptTokens: Int = 0
    var completionTokens: Int = 0
    var totalTokens: Int = 0
    var estimatedCostUSD: Double?
}

/// Chat view model with @Observable pattern
@Observable
final class ChatViewModel {
    // MARK: - Session State

    var sessions: [ChatSessionResponse] = []
    var currentSessionId: String?
    var currentSessionTitle: String = "New Chat"
    var sessionsLoading: Bool = false
    var sessionsAvailable: Bool = true

    // MARK: - Message State

    var messages: [Message] = []
    var inputText: String = ""
    var isStreaming: Bool = false
    var error: String?

    // MARK: - Streaming State

    var streamingStartTime: Date?
    var elapsedSeconds: Int = 0
    var currentStreamingContent: String = ""
    var currentThinkingContent: String = ""

    // MARK: - Model State

    var runningModel: String?
    var selectedModel: String = ""
    var availableModels: [ModelInfo] = []

    // MARK: - UI State

    var sidebarVisible: Bool = true
    var toolPanelOpen: Bool = false
    var activePanel: ActivePanel = .tools
    var showSettings: Bool = false
    var showMCPSettings: Bool = false
    var showUsageDetails: Bool = false
    var showExport: Bool = false
    var userScrolledUp: Bool = false

    // MARK: - MCP State

    var mcpEnabled: Bool = false
    var artifactsEnabled: Bool = false
    var mcpServers: [MCPServer] = []
    var mcpTools: [MCPTool] = []
    var selectedMCPServers: Set<String> = []
    var executingTools: Set<String> = []

    // MARK: - Settings

    var systemPrompt: String = ""
    var sessionUsage: SessionUsage?

    // MARK: - Attachments

    var attachedImages: [AttachedImage] = []

    enum ActivePanel {
        case tools
        case artifacts
    }

    struct ModelInfo: Identifiable {
        let id: String
        let root: String?
        let maxModelLen: Int?
    }

    struct AttachedImage: Identifiable {
        let id = UUID()
        let data: Data
        let thumbnail: UIImage?
    }

    // MARK: - Computed Properties

    var currentSession: ChatSessionResponse? {
        sessions.first { $0.id == currentSessionId }
    }

    var hasMessages: Bool {
        !messages.isEmpty
    }

    var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isStreaming
    }

    var enabledMCPServers: [MCPServer] {
        mcpServers.filter { $0.enabled }
    }

    var displayModel: String {
        if let model = runningModel {
            return model.components(separatedBy: "/").last ?? model
        }
        return selectedModel.components(separatedBy: "/").last ?? "No Model"
    }

    // MARK: - Initialization

    init() {
        loadPersistedState()
    }

    // MARK: - Persistence

    private func loadPersistedState() {
        // Load persisted settings from UserDefaults
        let defaults = UserDefaults.standard

        mcpEnabled = defaults.bool(forKey: "chat.mcpEnabled")
        artifactsEnabled = defaults.bool(forKey: "chat.artifactsEnabled")
        systemPrompt = defaults.string(forKey: "chat.systemPrompt") ?? ""
        selectedModel = defaults.string(forKey: "chat.selectedModel") ?? ""
        sidebarVisible = defaults.object(forKey: "chat.sidebarVisible") as? Bool ?? true

        // Load MCP servers
        if let data = defaults.data(forKey: "chat.mcpServers"),
           let servers = try? JSONDecoder().decode([MCPServer].self, from: data) {
            mcpServers = servers
        }

        // Load selected MCP servers
        if let servers = defaults.stringArray(forKey: "chat.selectedMCPServers") {
            selectedMCPServers = Set(servers)
        }
    }

    private func persistState() {
        let defaults = UserDefaults.standard

        defaults.set(mcpEnabled, forKey: "chat.mcpEnabled")
        defaults.set(artifactsEnabled, forKey: "chat.artifactsEnabled")
        defaults.set(systemPrompt, forKey: "chat.systemPrompt")
        defaults.set(selectedModel, forKey: "chat.selectedModel")
        defaults.set(sidebarVisible, forKey: "chat.sidebarVisible")

        // Save MCP servers
        if let data = try? JSONEncoder().encode(mcpServers) {
            defaults.set(data, forKey: "chat.mcpServers")
        }

        // Save selected MCP servers
        defaults.set(Array(selectedMCPServers), forKey: "chat.selectedMCPServers")
    }

    // MARK: - Session Management

    @MainActor
    func loadSessions() async {
        sessionsLoading = true
        defer { sessionsLoading = false }

        do {
            // TODO: Replace with actual API call
            // let response = try await APIClient.shared.request(.chatSessions)
            // sessions = response

            // Mock data for now
            try await Task.sleep(nanoseconds: 500_000_000)
            sessions = [
                ChatSessionResponse(
                    id: UUID().uuidString,
                    title: "Code Review Discussion",
                    model: "Qwen/Qwen2.5-72B-Instruct",
                    parentId: nil,
                    createdAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-3600)),
                    updatedAt: ISO8601DateFormatter().string(from: Date())
                )
            ]
            sessionsAvailable = true
        } catch {
            self.error = "Failed to load sessions: \(error.localizedDescription)"
            sessionsAvailable = false
        }
    }

    @MainActor
    func selectSession(_ sessionId: String?) async {
        guard sessionId != currentSessionId else { return }

        currentSessionId = sessionId
        messages = []

        guard let sessionId = sessionId else {
            currentSessionTitle = "New Chat"
            return
        }

        // Load session messages
        do {
            // TODO: Replace with actual API call
            // let detail = try await APIClient.shared.request(.chatSession(id: sessionId))
            // messages = detail.messages?.map { $0.toLocalMessage() } ?? []
            // currentSessionTitle = detail.title

            // Mock for now
            try await Task.sleep(nanoseconds: 300_000_000)
            if let session = sessions.first(where: { $0.id == sessionId }) {
                currentSessionTitle = session.title
            }
        } catch {
            self.error = "Failed to load session: \(error.localizedDescription)"
        }
    }

    @MainActor
    func createSession(title: String? = nil) async -> String? {
        do {
            // TODO: Replace with actual API call
            // let response = try await APIClient.shared.request(.createSession)

            let newId = UUID().uuidString
            let newSession = ChatSessionResponse(
                id: newId,
                title: title ?? "New Chat",
                model: selectedModel,
                parentId: nil,
                createdAt: ISO8601DateFormatter().string(from: Date()),
                updatedAt: ISO8601DateFormatter().string(from: Date())
            )

            sessions.insert(newSession, at: 0)
            await selectSession(newId)

            return newId
        } catch {
            self.error = "Failed to create session: \(error.localizedDescription)"
            return nil
        }
    }

    @MainActor
    func deleteSession(_ sessionId: String) async {
        do {
            // TODO: Replace with actual API call
            // try await APIClient.shared.request(.deleteSession(id: sessionId))

            sessions.removeAll { $0.id == sessionId }

            if currentSessionId == sessionId {
                currentSessionId = nil
                currentSessionTitle = "New Chat"
                messages = []
            }
        } catch {
            self.error = "Failed to delete session: \(error.localizedDescription)"
        }
    }

    @MainActor
    func forkSession(atMessageIndex index: Int) async -> String? {
        guard let currentId = currentSessionId, index < messages.count else { return nil }

        do {
            // TODO: Replace with actual API call
            // let response = try await APIClient.shared.request(.forkSession(id: currentId, messageIndex: index))

            let newId = UUID().uuidString
            let forkedMessages = Array(messages.prefix(index + 1))

            let newSession = ChatSessionResponse(
                id: newId,
                title: "Fork of \(currentSessionTitle)",
                model: selectedModel,
                parentId: currentId,
                createdAt: ISO8601DateFormatter().string(from: Date()),
                updatedAt: ISO8601DateFormatter().string(from: Date())
            )

            sessions.insert(newSession, at: 0)
            currentSessionId = newId
            currentSessionTitle = newSession.title
            messages = forkedMessages

            return newId
        } catch {
            self.error = "Failed to fork session: \(error.localizedDescription)"
            return nil
        }
    }

    @MainActor
    func renameSession(_ sessionId: String, to newTitle: String) async {
        guard let index = sessions.firstIndex(where: { $0.id == sessionId }) else { return }

        do {
            // TODO: Replace with actual API call

            // Update local state
            let oldSession = sessions[index]
            sessions[index] = ChatSessionResponse(
                id: oldSession.id,
                title: newTitle,
                model: oldSession.model,
                parentId: oldSession.parentId,
                createdAt: oldSession.createdAt,
                updatedAt: ISO8601DateFormatter().string(from: Date())
            )

            if currentSessionId == sessionId {
                currentSessionTitle = newTitle
            }
        } catch {
            self.error = "Failed to rename session: \(error.localizedDescription)"
        }
    }

    // MARK: - Message Sending

    @MainActor
    func sendMessage() async {
        let content = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty, !isStreaming else { return }

        // Create session if needed
        if currentSessionId == nil {
            guard await createSession() != nil else { return }
        }

        // Create user message
        let userMessage = Message(
            role: .user,
            content: content,
            images: attachedImages.isEmpty ? nil : attachedImages.map { $0.data.base64EncodedString() }
        )

        messages.append(userMessage)
        inputText = ""
        attachedImages = []

        // Create assistant message for streaming
        let assistantMessage = Message(
            role: .assistant,
            content: "",
            isStreaming: true,
            modelName: displayModel
        )
        messages.append(assistantMessage)

        isStreaming = true
        streamingStartTime = Date()
        currentStreamingContent = ""
        currentThinkingContent = ""
        error = nil

        // Start elapsed time tracking
        startElapsedTimer()

        do {
            // TODO: Replace with actual streaming API call
            // for try await chunk in APIClient.shared.stream(.createMessage(sessionId: currentSessionId!)) {
            //     await handleStreamChunk(chunk)
            // }

            // Mock streaming for now
            let mockResponse = """
            I'll help you with that! Let me explain how this works.

            ## Overview

            This is a streaming response that demonstrates the chat functionality.

            ```swift
            // Example code
            func greet(name: String) -> String {
                return "Hello, \\(name)!"
            }
            ```

            The code above shows a simple greeting function in Swift.
            """

            for char in mockResponse {
                try await Task.sleep(nanoseconds: 20_000_000) // 20ms per character
                currentStreamingContent += String(char)
                updateStreamingMessage()
            }

            // Finalize message
            finalizeStreamingMessage()
        } catch {
            self.error = "Failed to send message: \(error.localizedDescription)"
            // Remove the incomplete assistant message
            if let lastMessage = messages.last, lastMessage.isStreaming {
                messages.removeLast()
            }
        }

        isStreaming = false
        streamingStartTime = nil
    }

    private func startElapsedTimer() {
        Task { @MainActor in
            while isStreaming {
                if let start = streamingStartTime {
                    elapsedSeconds = Int(Date().timeIntervalSince(start))
                }
                try? await Task.sleep(nanoseconds: 1_000_000_000)
            }
        }
    }

    @MainActor
    private func updateStreamingMessage() {
        guard let lastIndex = messages.indices.last,
              messages[lastIndex].role == .assistant else { return }

        messages[lastIndex].content = currentStreamingContent
        messages[lastIndex].thinkingContent = currentThinkingContent.isEmpty ? nil : currentThinkingContent
    }

    @MainActor
    private func finalizeStreamingMessage() {
        guard let lastIndex = messages.indices.last,
              messages[lastIndex].role == .assistant else { return }

        messages[lastIndex].isStreaming = false

        // Extract artifacts if enabled
        if artifactsEnabled {
            let artifacts = Artifact.extractFromContent(messages[lastIndex].content)
            if !artifacts.isEmpty {
                messages[lastIndex].artifacts = artifacts
            }
        }
    }

    @MainActor
    func stopStreaming() {
        isStreaming = false
        finalizeStreamingMessage()
    }

    @MainActor
    func regenerateLastMessage() async {
        guard let lastAssistantIndex = messages.lastIndex(where: { $0.role == .assistant }) else { return }

        // Remove the last assistant message
        messages.remove(at: lastAssistantIndex)

        // Re-send using the last user message
        if let lastUserMessage = messages.last(where: { $0.role == .user }) {
            inputText = lastUserMessage.content
            await sendMessage()
        }
    }

    // MARK: - MCP Tools

    @MainActor
    func loadMCPTools() async {
        guard mcpEnabled else {
            mcpTools = []
            return
        }

        do {
            // TODO: Replace with actual API call
            // for server in enabledMCPServers {
            //     let tools = try await APIClient.shared.request(.mcpTools(serverId: server.id))
            //     mcpTools.append(contentsOf: tools)
            // }

            // Mock for now
            mcpTools = [
                MCPTool(server: "web-tools", name: "web_search", description: "Search the web"),
                MCPTool(server: "web-tools", name: "fetch_url", description: "Fetch URL content"),
                MCPTool(server: "file-tools", name: "read_file", description: "Read a file"),
                MCPTool(server: "file-tools", name: "write_file", description: "Write to a file")
            ]
        } catch {
            self.error = "Failed to load MCP tools: \(error.localizedDescription)"
        }
    }

    func toggleMCPServer(_ serverId: String) {
        if selectedMCPServers.contains(serverId) {
            selectedMCPServers.remove(serverId)
        } else {
            selectedMCPServers.insert(serverId)
        }
        persistState()
    }

    // MARK: - Attachments

    func addImage(_ image: UIImage) {
        guard let data = image.jpegData(compressionQuality: 0.8) else { return }
        let thumbnail = image.preparingThumbnail(of: CGSize(width: 100, height: 100))
        attachedImages.append(AttachedImage(data: data, thumbnail: thumbnail))
    }

    func removeImage(at index: Int) {
        guard attachedImages.indices.contains(index) else { return }
        attachedImages.remove(at: index)
    }

    func clearAttachments() {
        attachedImages.removeAll()
    }

    // MARK: - Settings

    func updateSystemPrompt(_ prompt: String) {
        systemPrompt = prompt
        persistState()
    }

    func updateMCPEnabled(_ enabled: Bool) {
        mcpEnabled = enabled
        persistState()

        if enabled {
            Task {
                await loadMCPTools()
            }
        } else {
            mcpTools = []
        }
    }

    func updateArtifactsEnabled(_ enabled: Bool) {
        artifactsEnabled = enabled
        persistState()
    }

    // MARK: - Export

    func exportSession() -> String {
        var export = "# \(currentSessionTitle)\n\n"

        for message in messages {
            let role = message.role == .user ? "**You:**" : "**Assistant:**"
            export += "\(role)\n\n\(message.content)\n\n---\n\n"
        }

        return export
    }
}

// MARK: - Preview Helpers

extension ChatViewModel {
    static var preview: ChatViewModel {
        let vm = ChatViewModel()
        vm.sessions = [
            ChatSessionResponse(
                id: "1",
                title: "Code Review",
                model: "Qwen/Qwen2.5-72B-Instruct",
                parentId: nil,
                createdAt: ISO8601DateFormatter().string(from: Date()),
                updatedAt: ISO8601DateFormatter().string(from: Date())
            ),
            ChatSessionResponse(
                id: "2",
                title: "API Design",
                model: "DeepSeek-R1",
                parentId: nil,
                createdAt: ISO8601DateFormatter().string(from: Date()),
                updatedAt: ISO8601DateFormatter().string(from: Date())
            )
        ]
        vm.currentSessionId = "1"
        vm.currentSessionTitle = "Code Review"
        vm.messages = [Message.previewUser, Message.previewAssistant]
        vm.runningModel = "Qwen/Qwen2.5-72B-Instruct"
        return vm
    }
}
