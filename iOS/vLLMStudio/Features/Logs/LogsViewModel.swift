//
//  LogsViewModel.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation
import SwiftUI

/// View model for the Logs feature
@Observable
final class LogsViewModel {

    // MARK: - Published State

    /// List of available log sessions
    var sessions: [LogSession] = []

    /// Currently selected session ID
    var selectedSessionId: String?

    /// Raw log content for the selected session
    var logContent: String = ""

    /// Parsed log entries for the selected session
    var logEntries: [LogEntry] = []

    /// Current search/filter text
    var filterText: String = ""

    /// Current log level filter
    var levelFilter: LogFilter = .all

    /// Whether auto-refresh is enabled
    var isAutoRefresh: Bool = false

    /// Whether sessions are currently loading
    var isLoadingSessions: Bool = false

    /// Whether log content is currently loading
    var isLoadingContent: Bool = false

    /// Error message if any operation fails
    var errorMessage: String?

    /// Whether to show error alert
    var showErrorAlert: Bool = false

    // MARK: - Private Properties

    /// Timer for auto-refresh
    private var autoRefreshTimer: Timer?

    /// Auto-refresh interval in seconds
    private let autoRefreshInterval: TimeInterval = 5.0

    /// API client for network requests
    private let apiClient: APIClient

    // MARK: - Computed Properties

    /// Sessions grouped by date
    var groupedSessions: [(date: Date, sessions: [LogSession])] {
        LogSession.groupByDate(sessions)
    }

    /// Currently selected session
    var selectedSession: LogSession? {
        guard let id = selectedSessionId else { return nil }
        return sessions.first { $0.id == id }
    }

    /// Filtered log entries based on search text and level filter
    var filteredEntries: [LogEntry] {
        var entries = logEntries

        // Apply level filter
        if levelFilter != .all {
            let includedLevels = levelFilter.includedLevels
            entries = entries.filter { entry in
                guard let level = entry.level else {
                    // Include entries without a level only in "All" filter
                    return false
                }
                return includedLevels.contains(level)
            }
        }

        // Apply text filter
        if !filterText.isEmpty {
            let searchText = filterText.lowercased()
            entries = entries.filter { entry in
                entry.message.lowercased().contains(searchText) ||
                entry.rawLine.lowercased().contains(searchText) ||
                (entry.source?.lowercased().contains(searchText) ?? false)
            }
        }

        return entries
    }

    /// Filtered log content as string (for sharing)
    var filteredLogContent: String {
        filteredEntries.map { $0.rawLine }.joined(separator: "\n")
    }

    /// Statistics about current log content
    var logStats: LogStats {
        LogStats(
            totalLines: logEntries.count,
            filteredLines: filteredEntries.count,
            errorCount: logEntries.filter { $0.level == .error || $0.level == .critical }.count,
            warningCount: logEntries.filter { $0.level == .warning }.count
        )
    }

    /// Whether there's content to display
    var hasContent: Bool {
        !logContent.isEmpty
    }

    /// Whether the view is in a loading state
    var isLoading: Bool {
        isLoadingSessions || isLoadingContent
    }

    // MARK: - Initialization

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    deinit {
        stopAutoRefresh()
    }

    // MARK: - Public Methods

    /// Loads all available log sessions
    @MainActor
    func loadSessions() async {
        isLoadingSessions = true
        errorMessage = nil

        do {
            let response: LogSessionsResponse = try await apiClient.request(.logSessions)
            sessions = response.sessions.sorted { $0.createdAt > $1.createdAt }

            // Auto-select first session if none selected
            if selectedSessionId == nil, let firstSession = sessions.first {
                await selectSession(firstSession.id)
            }
        } catch {
            handleError(error, context: "loading sessions")
        }

        isLoadingSessions = false
    }

    /// Selects a session and loads its content
    @MainActor
    func selectSession(_ sessionId: String) async {
        selectedSessionId = sessionId
        logContent = ""
        logEntries = []

        await loadContent()
    }

    /// Loads content for the currently selected session
    @MainActor
    func loadContent() async {
        guard let sessionId = selectedSessionId else { return }

        isLoadingContent = true
        errorMessage = nil

        do {
            let response: LogContentResponse = try await apiClient.request(.logContent(sessionId: sessionId))
            logContent = response.content
            parseLogContent()
        } catch {
            handleError(error, context: "loading log content")
        }

        isLoadingContent = false
    }

    /// Refreshes both sessions and content
    @MainActor
    func refresh() async {
        await loadSessions()
        if selectedSessionId != nil {
            await loadContent()
        }
    }

    /// Toggles auto-refresh on/off
    @MainActor
    func toggleAutoRefresh() {
        isAutoRefresh.toggle()

        if isAutoRefresh {
            startAutoRefresh()
        } else {
            stopAutoRefresh()
        }
    }

    /// Starts auto-refresh timer
    @MainActor
    func startAutoRefresh() {
        stopAutoRefresh()

        autoRefreshTimer = Timer.scheduledTimer(withTimeInterval: autoRefreshInterval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                await self?.loadContent()
            }
        }
    }

    /// Stops auto-refresh timer
    func stopAutoRefresh() {
        autoRefreshTimer?.invalidate()
        autoRefreshTimer = nil
    }

    /// Clears the current filter
    @MainActor
    func clearFilter() {
        filterText = ""
        levelFilter = .all
    }

    /// Sets the level filter
    @MainActor
    func setLevelFilter(_ filter: LogFilter) {
        levelFilter = filter
    }

    /// Exports log content for sharing
    func exportContent() -> String {
        if filterText.isEmpty && levelFilter == .all {
            return logContent
        }
        return filteredLogContent
    }

    // MARK: - Private Methods

    /// Parses raw log content into structured entries
    private func parseLogContent() {
        let lines = logContent.components(separatedBy: .newlines)
        logEntries = lines.enumerated().compactMap { index, line in
            guard !line.isEmpty else { return nil }
            return LogEntry.parse(line: line, lineNumber: index + 1)
        }
    }

    /// Handles errors from API calls
    @MainActor
    private func handleError(_ error: Error, context: String) {
        let message: String
        if let networkError = error as? NetworkError {
            message = networkError.userMessage
        } else {
            message = error.localizedDescription
        }

        errorMessage = "Error \(context): \(message)"
        showErrorAlert = true
    }
}

// MARK: - Log Stats

/// Statistics about the current log content
struct LogStats {
    let totalLines: Int
    let filteredLines: Int
    let errorCount: Int
    let warningCount: Int

    var hasErrors: Bool { errorCount > 0 }
    var hasWarnings: Bool { warningCount > 0 }

    var summary: String {
        var parts: [String] = []
        parts.append("\(totalLines) lines")
        if errorCount > 0 {
            parts.append("\(errorCount) errors")
        }
        if warningCount > 0 {
            parts.append("\(warningCount) warnings")
        }
        return parts.joined(separator: " | ")
    }
}

// MARK: - NetworkError Extension

extension NetworkError {
    /// User-friendly error message
    var userMessage: String {
        switch self {
        case .invalidURL:
            return "Invalid server URL"
        case .missingAPIKey:
            return "API key not configured"
        case .invalidResponse:
            return "Invalid server response"
        case .emptyResponse:
            return "Empty response from server"
        case .unauthorized:
            return "Invalid API key"
        case .forbidden:
            return "Access denied"
        case .notFound:
            return "Resource not found"
        case .serverError:
            return "Server error"
        case .timeout:
            return "Request timed out"
        case .offline:
            return "No internet connection"
        case .cancelled:
            return "Request cancelled"
        case .decodingError:
            return "Failed to parse response"
        case .custom(let message):
            return message
        case .unknown:
            return "Unknown error occurred"
        }
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension LogsViewModel {
    /// Creates a view model with preview data
    static var preview: LogsViewModel {
        let viewModel = LogsViewModel()
        viewModel.sessions = LogSession.previewList
        viewModel.selectedSessionId = LogSession.previewList.first?.id
        viewModel.logEntries = LogEntry.previewList
        viewModel.logContent = LogEntry.previewList.map { $0.rawLine }.joined(separator: "\n")
        return viewModel
    }

    /// Creates a view model in loading state
    static var loading: LogsViewModel {
        let viewModel = LogsViewModel()
        viewModel.isLoadingSessions = true
        return viewModel
    }

    /// Creates a view model with empty state
    static var empty: LogsViewModel {
        LogsViewModel()
    }

    /// Creates a view model with error state
    static var error: LogsViewModel {
        let viewModel = LogsViewModel()
        viewModel.errorMessage = "Failed to connect to server"
        viewModel.showErrorAlert = true
        return viewModel
    }
}
#endif
