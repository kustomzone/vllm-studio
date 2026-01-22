//
//  UserDefaultsManager.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation
import SwiftUI

/// Manages non-sensitive user preferences and app settings using UserDefaults.
/// Provides type-safe access to stored values with default fallbacks.
final class UserDefaultsManager {

    // MARK: - Singleton

    /// Shared instance of the UserDefaults manager
    static let shared = UserDefaultsManager()

    // MARK: - Properties

    private let defaults: UserDefaults

    // MARK: - Keys

    private enum Keys {
        static let serverURL = "serverURL"
        static let defaultServerURL = "http://localhost:8080"

        static let pinnedRecipeIds = "pinnedRecipeIds"
        static let recentModelIds = "recentModelIds"

        static let chatFontSize = "chatFontSize"
        static let showThinkingBlocks = "showThinkingBlocks"
        static let enableSyntaxHighlighting = "enableSyntaxHighlighting"
        static let enableMarkdownRendering = "enableMarkdownRendering"

        static let autoRefreshDashboard = "autoRefreshDashboard"
        static let dashboardRefreshInterval = "dashboardRefreshInterval"

        static let logsAutoRefresh = "logsAutoRefresh"
        static let logsRefreshInterval = "logsRefreshInterval"

        static let lastSelectedTab = "lastSelectedTab"
        static let chatSidebarVisible = "chatSidebarVisible"

        static let hasCompletedOnboarding = "hasCompletedOnboarding"
        static let appLaunchCount = "appLaunchCount"

        static let lastChatSessionId = "lastChatSessionId"
        static let defaultSystemPrompt = "defaultSystemPrompt"

        static let preferredColorScheme = "preferredColorScheme"
        static let hapticFeedbackEnabled = "hapticFeedbackEnabled"
    }

    // MARK: - Initialization

    private init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        registerDefaults()
    }

    /// Registers default values for all settings
    private func registerDefaults() {
        defaults.register(defaults: [
            Keys.serverURL: Keys.defaultServerURL,
            Keys.pinnedRecipeIds: [String](),
            Keys.recentModelIds: [String](),
            Keys.chatFontSize: 14.0,
            Keys.showThinkingBlocks: true,
            Keys.enableSyntaxHighlighting: true,
            Keys.enableMarkdownRendering: true,
            Keys.autoRefreshDashboard: true,
            Keys.dashboardRefreshInterval: 5.0,
            Keys.logsAutoRefresh: false,
            Keys.logsRefreshInterval: 10.0,
            Keys.chatSidebarVisible: true,
            Keys.hasCompletedOnboarding: false,
            Keys.appLaunchCount: 0,
            Keys.hapticFeedbackEnabled: true
        ])
    }

    // MARK: - Server Configuration

    /// The server URL for API requests
    var serverURL: String {
        get { defaults.string(forKey: Keys.serverURL) ?? Keys.defaultServerURL }
        set { defaults.set(newValue, forKey: Keys.serverURL) }
    }

    /// Resets the server URL to the default value
    func resetServerURL() {
        serverURL = Keys.defaultServerURL
    }

    // MARK: - Recipe Management

    /// IDs of pinned recipes
    var pinnedRecipeIds: [String] {
        get { defaults.stringArray(forKey: Keys.pinnedRecipeIds) ?? [] }
        set { defaults.set(newValue, forKey: Keys.pinnedRecipeIds) }
    }

    /// Adds a recipe to the pinned list
    func pinRecipe(id: String) {
        var pinned = pinnedRecipeIds
        if !pinned.contains(id) {
            pinned.append(id)
            pinnedRecipeIds = pinned
        }
    }

    /// Removes a recipe from the pinned list
    func unpinRecipe(id: String) {
        var pinned = pinnedRecipeIds
        pinned.removeAll { $0 == id }
        pinnedRecipeIds = pinned
    }

    /// Checks if a recipe is pinned
    func isRecipePinned(id: String) -> Bool {
        pinnedRecipeIds.contains(id)
    }

    /// IDs of recently used models
    var recentModelIds: [String] {
        get { defaults.stringArray(forKey: Keys.recentModelIds) ?? [] }
        set { defaults.set(newValue, forKey: Keys.recentModelIds) }
    }

    /// Adds a model to the recent list (maintains max 10 items)
    func addRecentModel(id: String) {
        var recent = recentModelIds
        recent.removeAll { $0 == id }
        recent.insert(id, at: 0)
        if recent.count > 10 {
            recent = Array(recent.prefix(10))
        }
        recentModelIds = recent
    }

    // MARK: - Chat Settings

    /// Font size for chat messages
    var chatFontSize: Double {
        get { defaults.double(forKey: Keys.chatFontSize) }
        set { defaults.set(newValue, forKey: Keys.chatFontSize) }
    }

    /// Whether to show thinking/reasoning blocks in chat
    var showThinkingBlocks: Bool {
        get { defaults.bool(forKey: Keys.showThinkingBlocks) }
        set { defaults.set(newValue, forKey: Keys.showThinkingBlocks) }
    }

    /// Whether syntax highlighting is enabled for code blocks
    var enableSyntaxHighlighting: Bool {
        get { defaults.bool(forKey: Keys.enableSyntaxHighlighting) }
        set { defaults.set(newValue, forKey: Keys.enableSyntaxHighlighting) }
    }

    /// Whether markdown rendering is enabled
    var enableMarkdownRendering: Bool {
        get { defaults.bool(forKey: Keys.enableMarkdownRendering) }
        set { defaults.set(newValue, forKey: Keys.enableMarkdownRendering) }
    }

    /// Last used chat session ID
    var lastChatSessionId: String? {
        get { defaults.string(forKey: Keys.lastChatSessionId) }
        set { defaults.set(newValue, forKey: Keys.lastChatSessionId) }
    }

    /// Default system prompt for new chat sessions
    var defaultSystemPrompt: String? {
        get { defaults.string(forKey: Keys.defaultSystemPrompt) }
        set { defaults.set(newValue, forKey: Keys.defaultSystemPrompt) }
    }

    // MARK: - Dashboard Settings

    /// Whether the dashboard auto-refreshes
    var autoRefreshDashboard: Bool {
        get { defaults.bool(forKey: Keys.autoRefreshDashboard) }
        set { defaults.set(newValue, forKey: Keys.autoRefreshDashboard) }
    }

    /// Dashboard refresh interval in seconds
    var dashboardRefreshInterval: TimeInterval {
        get { defaults.double(forKey: Keys.dashboardRefreshInterval) }
        set { defaults.set(newValue, forKey: Keys.dashboardRefreshInterval) }
    }

    // MARK: - Logs Settings

    /// Whether logs auto-refresh
    var logsAutoRefresh: Bool {
        get { defaults.bool(forKey: Keys.logsAutoRefresh) }
        set { defaults.set(newValue, forKey: Keys.logsAutoRefresh) }
    }

    /// Logs refresh interval in seconds
    var logsRefreshInterval: TimeInterval {
        get { defaults.double(forKey: Keys.logsRefreshInterval) }
        set { defaults.set(newValue, forKey: Keys.logsRefreshInterval) }
    }

    // MARK: - Navigation State

    /// Last selected tab
    var lastSelectedTab: String? {
        get { defaults.string(forKey: Keys.lastSelectedTab) }
        set { defaults.set(newValue, forKey: Keys.lastSelectedTab) }
    }

    /// Whether the chat sidebar is visible
    var chatSidebarVisible: Bool {
        get { defaults.bool(forKey: Keys.chatSidebarVisible) }
        set { defaults.set(newValue, forKey: Keys.chatSidebarVisible) }
    }

    // MARK: - Onboarding & App State

    /// Whether the user has completed onboarding
    var hasCompletedOnboarding: Bool {
        get { defaults.bool(forKey: Keys.hasCompletedOnboarding) }
        set { defaults.set(newValue, forKey: Keys.hasCompletedOnboarding) }
    }

    /// Number of times the app has been launched
    var appLaunchCount: Int {
        get { defaults.integer(forKey: Keys.appLaunchCount) }
        set { defaults.set(newValue, forKey: Keys.appLaunchCount) }
    }

    /// Increments the app launch count
    func incrementLaunchCount() {
        appLaunchCount += 1
    }

    // MARK: - Appearance

    /// Preferred color scheme (nil = system, "light", "dark")
    var preferredColorScheme: String? {
        get { defaults.string(forKey: Keys.preferredColorScheme) }
        set { defaults.set(newValue, forKey: Keys.preferredColorScheme) }
    }

    /// Returns the ColorScheme based on preference
    var colorScheme: ColorScheme? {
        guard let scheme = preferredColorScheme else { return nil }
        switch scheme {
        case "light": return .light
        case "dark": return .dark
        default: return nil
        }
    }

    /// Whether haptic feedback is enabled
    var hapticFeedbackEnabled: Bool {
        get { defaults.bool(forKey: Keys.hapticFeedbackEnabled) }
        set { defaults.set(newValue, forKey: Keys.hapticFeedbackEnabled) }
    }

    // MARK: - Utility Methods

    /// Resets all settings to defaults
    func resetAllSettings() {
        let domain = Bundle.main.bundleIdentifier!
        defaults.removePersistentDomain(forName: domain)
        defaults.synchronize()
        registerDefaults()
    }

    /// Synchronizes UserDefaults
    func synchronize() {
        defaults.synchronize()
    }
}

// MARK: - Property Wrapper

/// Property wrapper for easy UserDefaults access
@propertyWrapper
struct UserDefault<Value> {
    let key: String
    let defaultValue: Value
    let container: UserDefaults

    init(key: String, defaultValue: Value, container: UserDefaults = .standard) {
        self.key = key
        self.defaultValue = defaultValue
        self.container = container
    }

    var wrappedValue: Value {
        get {
            container.object(forKey: key) as? Value ?? defaultValue
        }
        set {
            container.set(newValue, forKey: key)
        }
    }
}
