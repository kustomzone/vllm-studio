//
//  Constants.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation
import SwiftUI

/// Application-wide constants
enum Constants {

    // MARK: - App Info

    enum App {
        static let name = "vLLM Studio"
        static let bundleId = "com.vllmstudio.app"
        static let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        static let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }

    // MARK: - API Configuration

    enum API {
        static let defaultBaseURL = "http://localhost:8080"
        static let defaultTimeout: TimeInterval = 30
        static let longTimeout: TimeInterval = 300
        static let maxRetries = 3
        static let retryDelay: TimeInterval = 1.0
    }

    // MARK: - WebSocket Configuration

    enum WebSocket {
        static let reconnectInterval: TimeInterval = 5.0
        static let maxReconnectAttempts = 10
        static let pingInterval: TimeInterval = 30.0
    }

    // MARK: - Polling Intervals

    enum Polling {
        static let dashboard: TimeInterval = 5.0
        static let gpuMetrics: TimeInterval = 2.0
        static let logs: TimeInterval = 10.0
        static let modelStatus: TimeInterval = 3.0
    }

    // MARK: - UI Configuration

    enum UI {
        // Animation durations
        static let animationDuration: Double = 0.3
        static let fastAnimationDuration: Double = 0.15
        static let slowAnimationDuration: Double = 0.5

        // Corner radii
        static let cornerRadiusSmall: CGFloat = 6
        static let cornerRadius: CGFloat = 12
        static let cornerRadiusLarge: CGFloat = 16
        static let cornerRadiusXL: CGFloat = 24

        // Spacing
        static let spacingXS: CGFloat = 4
        static let spacingS: CGFloat = 8
        static let spacing: CGFloat = 12
        static let spacingM: CGFloat = 16
        static let spacingL: CGFloat = 24
        static let spacingXL: CGFloat = 32

        // Icon sizes
        static let iconSizeSmall: CGFloat = 16
        static let iconSize: CGFloat = 20
        static let iconSizeLarge: CGFloat = 24
        static let iconSizeXL: CGFloat = 32

        // Card
        static let cardPadding: CGFloat = 16
        static let cardSpacing: CGFloat = 12

        // Message
        static let maxMessageWidth: CGFloat = 700
        static let minInputHeight: CGFloat = 44
        static let maxInputHeight: CGFloat = 200

        // Sidebar
        static let sidebarWidth: CGFloat = 280
        static let sidebarMinWidth: CGFloat = 200
        static let sidebarMaxWidth: CGFloat = 400
    }

    // MARK: - Chat Configuration

    enum Chat {
        static let maxMessageLength = 100_000
        static let maxSessionTitleLength = 100
        static let defaultSystemPrompt = "You are a helpful assistant."
        static let streamingBufferDelay: TimeInterval = 0.05
        static let maxAttachmentSize = 10 * 1024 * 1024 // 10MB
        static let supportedImageTypes = ["png", "jpg", "jpeg", "gif", "webp"]
        static let supportedDocumentTypes = ["pdf", "txt", "md"]
    }

    // MARK: - Recipe Configuration

    enum Recipe {
        static let defaultGPUUtilization = 0.9
        static let defaultTensorParallel = 1
        static let defaultMaxSeqs = 256
        static let defaultBlockSize = 16
        static let maxNameLength = 50
        static let maxDescriptionLength = 500
    }

    // MARK: - Log Configuration

    enum Log {
        static let maxDisplayLines = 10_000
        static let defaultRefreshInterval: TimeInterval = 10.0
        static let maxExportSize = 50 * 1024 * 1024 // 50MB
    }

    // MARK: - Cache Configuration

    enum Cache {
        static let maxMemoryCacheMB = 100
        static let maxDiskCacheMB = 500
        static let defaultExpiration: TimeInterval = 3600 // 1 hour
    }

    // MARK: - Feature Flags

    enum Features {
        static let enableVoiceInput = true
        static let enableArtifacts = true
        static let enableMCP = true
        static let enableCodeHighlighting = true
        static let enableMarkdownRendering = true
        static let enableExport = true
    }

    // MARK: - Keyboard Shortcuts

    enum Shortcuts {
        static let newChat = "N"
        static let search = "K"
        static let settings = ","
        static let send = "Return"
    }

    // MARK: - Accessibility

    enum Accessibility {
        static let minimumTapTarget: CGFloat = 44
        static let defaultFontSize: CGFloat = 14
        static let minimumFontSize: CGFloat = 12
        static let maximumFontSize: CGFloat = 24
    }

    // MARK: - Regex Patterns

    enum Patterns {
        static let codeBlock = "```([\\w]*)?\\n([\\s\\S]*?)```"
        static let inlineCode = "`([^`]+)`"
        static let thinkingBlock = "<thinking>([\\s\\S]*?)</thinking>"
        static let artifactBlock = "<artifact[^>]*>([\\s\\S]*?)</artifact>"
        static let url = "https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+"
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let serverStatusChanged = Notification.Name("serverStatusChanged")
    static let modelLoaded = Notification.Name("modelLoaded")
    static let modelEvicted = Notification.Name("modelEvicted")
    static let chatSessionCreated = Notification.Name("chatSessionCreated")
    static let chatSessionDeleted = Notification.Name("chatSessionDeleted")
    static let apiKeyChanged = Notification.Name("apiKeyChanged")
    static let themeChanged = Notification.Name("themeChanged")
}

// MARK: - User Info Keys

enum UserInfoKey {
    static let sessionId = "sessionId"
    static let modelId = "modelId"
    static let recipeId = "recipeId"
    static let error = "error"
    static let status = "status"
}

// MARK: - Error Messages

enum ErrorMessage {
    static let networkUnavailable = "Unable to connect. Please check your network connection."
    static let serverUnavailable = "Server is not responding. Please check the server URL in settings."
    static let unauthorized = "Invalid API key. Please update your API key in settings."
    static let modelNotLoaded = "No model is currently loaded. Please launch a model first."
    static let sessionNotFound = "Chat session not found."
    static let unexpectedError = "An unexpected error occurred. Please try again."
}
