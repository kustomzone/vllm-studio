//
//  vLLMStudioApp.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import SwiftUI
import SwiftData

/// Main entry point for the vLLM Studio iOS application.
/// Configures the app environment, data persistence, and global state.
@main
struct vLLMStudioApp: App {

    // MARK: - State Objects

    /// Global application state shared across all views
    @State private var appState = AppState()

    /// Chat view model for managing chat sessions and messages
    @State private var chatViewModel = ChatViewModel()

    // MARK: - SwiftData Configuration

    /// SwiftData model container for local persistence
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            ChatSessionModel.self,
            MessageModel.self,
        ])
        let modelConfiguration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false,
            allowsSave: true
        )

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    // MARK: - Body

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
                .environment(chatViewModel)
                .preferredColorScheme(.dark)
                .tint(Color.theme.primary)
        }
        .modelContainer(sharedModelContainer)
    }
}

// MARK: - App State

/// Observable global application state
@Observable
final class AppState {

    // MARK: - Authentication

    /// The API key for authenticating with the vLLM server
    var apiKey: String? {
        didSet {
            if let key = apiKey {
                KeychainManager.shared.saveAPIKey(key)
            } else {
                KeychainManager.shared.deleteAPIKey()
            }
        }
    }

    /// Whether the user is authenticated (has a valid API key)
    var isAuthenticated: Bool { apiKey != nil && !apiKey!.isEmpty }

    // MARK: - Connection State

    /// Current server connection status
    var serverStatus: ServerStatus = .disconnected

    /// GPU metrics from the server
    var gpuMetrics: [GPUMetric] = []

    /// Active model information
    var activeModel: ActiveModel?

    /// Whether a model is currently being loaded
    var isModelLoading: Bool = false

    /// Model loading progress (0.0 to 1.0)
    var modelLoadingProgress: Double = 0.0

    // MARK: - Navigation

    /// Currently selected tab in the main navigation
    var selectedTab: Tab = .dashboard

    /// Whether the chat sidebar is visible (iPad)
    var chatSidebarVisible: Bool = true

    /// Server base URL
    var serverURL: String {
        get { UserDefaultsManager.shared.serverURL }
        set { UserDefaultsManager.shared.serverURL = newValue }
    }

    // MARK: - Initialization

    init() {
        // Load API key from Keychain
        self.apiKey = KeychainManager.shared.getAPIKey()
    }

    // MARK: - Methods

    /// Updates the server status
    func updateServerStatus(_ status: ServerStatus) {
        self.serverStatus = status
    }

    /// Updates GPU metrics
    func updateGPUMetrics(_ metrics: [GPUMetric]) {
        self.gpuMetrics = metrics
    }

    /// Clears all authentication data
    func logout() {
        apiKey = nil
        serverStatus = .disconnected
        gpuMetrics = []
        activeModel = nil
    }
}

// MARK: - Supporting Types

/// Tab options for main navigation
enum Tab: String, CaseIterable, Identifiable {
    case dashboard = "Dashboard"
    case chat = "Chat"
    case recipes = "Recipes"
    case logs = "Logs"
    case usage = "Usage"
    case configs = "Configs"
    case discover = "Discover"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .dashboard: return "gauge.with.dots.needle.bottom.50percent"
        case .chat: return "bubble.left.and.bubble.right"
        case .recipes: return "doc.text"
        case .logs: return "doc.plaintext"
        case .usage: return "chart.bar"
        case .configs: return "gearshape"
        case .discover: return "magnifyingglass"
        }
    }
}

/// Server connection status
enum ServerStatus: String {
    case connected = "Connected"
    case disconnected = "Disconnected"
    case connecting = "Connecting"
    case error = "Error"

    var color: Color {
        switch self {
        case .connected: return Color.theme.success
        case .disconnected: return Color.theme.mutedForeground
        case .connecting: return Color.theme.warning
        case .error: return Color.theme.error
        }
    }
}

/// GPU metric data
struct GPUMetric: Identifiable, Codable {
    let id: Int
    let name: String
    let memoryUsed: Int64
    let memoryTotal: Int64
    let utilization: Double
    let temperature: Double

    var memoryUsedGB: Double {
        Double(memoryUsed) / 1_073_741_824
    }

    var memoryTotalGB: Double {
        Double(memoryTotal) / 1_073_741_824
    }

    var memoryUsagePercent: Double {
        guard memoryTotal > 0 else { return 0 }
        return Double(memoryUsed) / Double(memoryTotal) * 100
    }
}

/// Active model information
struct ActiveModel: Codable {
    let modelId: String
    let modelName: String
    let recipeId: String?
    let loadedAt: Date
    let contextLength: Int
    let tensorParallel: Int
}

// MARK: - SwiftData Models

/// SwiftData model for persisting chat sessions
@Model
final class ChatSessionModel {
    @Attribute(.unique) var id: UUID
    var title: String
    var createdAt: Date
    var updatedAt: Date
    var modelId: String
    var systemPrompt: String?
    @Relationship(deleteRule: .cascade, inverse: \MessageModel.session)
    var messages: [MessageModel] = []

    init(id: UUID = UUID(), title: String, modelId: String, systemPrompt: String? = nil) {
        self.id = id
        self.title = title
        self.createdAt = Date()
        self.updatedAt = Date()
        self.modelId = modelId
        self.systemPrompt = systemPrompt
    }
}

/// SwiftData model for persisting messages
@Model
final class MessageModel {
    @Attribute(.unique) var id: UUID
    var role: String
    var content: String
    var createdAt: Date
    var tokenCount: Int?
    var session: ChatSessionModel?

    init(id: UUID = UUID(), role: String, content: String, tokenCount: Int? = nil) {
        self.id = id
        self.role = role
        self.content = content
        self.createdAt = Date()
        self.tokenCount = tokenCount
    }
}
