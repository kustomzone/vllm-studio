//
//  LogService.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation

/// Service for fetching and managing server logs.
@Observable
final class LogService {

    // MARK: - Singleton

    static let shared = LogService()

    // MARK: - Properties

    /// Available log sessions
    var sessions: [LogSession] = []

    /// Currently selected session
    var selectedSessionId: String?

    /// Log content for the selected session
    var logContent: String = ""

    /// Whether logs are loading
    var isLoading: Bool = false

    /// Whether auto-refresh is active
    var isAutoRefreshing: Bool = false

    /// Error message
    var errorMessage: String?

    /// Current filter query
    var filterQuery: String = ""

    /// Active log level filter
    var logLevelFilter: LogLevel?

    // MARK: - Private Properties

    private var refreshTask: Task<Void, Never>?

    // MARK: - Computed Properties

    /// The currently selected session
    var selectedSession: LogSession? {
        sessions.first { $0.id == selectedSessionId }
    }

    /// Filtered log content
    var filteredContent: String {
        guard !filterQuery.isEmpty || logLevelFilter != nil else {
            return logContent
        }

        return logContent
            .components(separatedBy: "\n")
            .filter { line in
                var matches = true

                // Text filter
                if !filterQuery.isEmpty {
                    matches = matches && line.localizedCaseInsensitiveContains(filterQuery)
                }

                // Log level filter
                if let level = logLevelFilter {
                    matches = matches && line.contains(level.rawValue.uppercased())
                }

                return matches
            }
            .joined(separator: "\n")
    }

    // MARK: - Initialization

    private init() {}

    // MARK: - Session Management

    /// Fetches all log sessions
    @MainActor
    func fetchSessions() async throws {
        isLoading = true
        defer { isLoading = false }

        do {
            let response: LogSessionsResponse = try await APIClient.shared.request(.logSessions)
            sessions = response.sessions.sorted { $0.startTime > $1.startTime }
            errorMessage = nil

            // Auto-select the first session if none selected
            if selectedSessionId == nil, let first = sessions.first {
                selectedSessionId = first.id
                try await fetchLogContent(sessionId: first.id)
            }
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    /// Fetches log content for a specific session
    /// - Parameter sessionId: The session ID
    @MainActor
    func fetchLogContent(sessionId: String) async throws {
        isLoading = true
        defer { isLoading = false }

        do {
            let response: LogContentResponse = try await APIClient.shared.request(
                .logContent(sessionId: sessionId)
            )
            logContent = response.content
            selectedSessionId = sessionId
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    /// Selects a session and fetches its content
    /// - Parameter sessionId: The session ID to select
    @MainActor
    func selectSession(_ sessionId: String) async throws {
        selectedSessionId = sessionId
        try await fetchLogContent(sessionId: sessionId)
    }

    // MARK: - Auto Refresh

    /// Starts auto-refreshing logs
    /// - Parameter interval: Refresh interval in seconds
    func startAutoRefresh(interval: TimeInterval = 5.0) {
        stopAutoRefresh()
        isAutoRefreshing = true

        refreshTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self = self,
                      let sessionId = self.selectedSessionId else { continue }

                do {
                    try await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
                    try await self.fetchLogContent(sessionId: sessionId)
                } catch {
                    // Ignore cancellation errors
                    if !Task.isCancelled {
                        print("Auto-refresh error: \(error)")
                    }
                }
            }
        }
    }

    /// Stops auto-refreshing logs
    func stopAutoRefresh() {
        refreshTask?.cancel()
        refreshTask = nil
        isAutoRefreshing = false
    }

    // MARK: - Filtering

    /// Sets the filter query
    /// - Parameter query: The search query
    func setFilter(_ query: String) {
        filterQuery = query
    }

    /// Sets the log level filter
    /// - Parameter level: The log level to filter by
    func setLogLevelFilter(_ level: LogLevel?) {
        logLevelFilter = level
    }

    /// Clears all filters
    func clearFilters() {
        filterQuery = ""
        logLevelFilter = nil
    }

    // MARK: - Export

    /// Exports the current log content
    /// - Returns: The log content as data
    func exportLogs() -> Data? {
        filteredContent.data(using: .utf8)
    }

    /// Generates a shareable text for the logs
    /// - Returns: Formatted log text
    func shareableText() -> String {
        var text = "vLLM Studio Logs\n"
        text += "================\n\n"

        if let session = selectedSession {
            text += "Session: \(session.name)\n"
            text += "Started: \(session.formattedStartTime)\n\n"
        }

        text += filteredContent

        return text
    }
}

// MARK: - Response Types

struct LogSessionsResponse: Decodable {
    let sessions: [LogSession]
}

struct LogContentResponse: Decodable {
    let content: String
}

// MARK: - Log Session

struct LogSession: Identifiable, Codable {
    let id: String
    let name: String
    let startTime: Date
    let endTime: Date?
    let logCount: Int?
    let status: LogSessionStatus?

    enum LogSessionStatus: String, Codable {
        case active
        case completed
        case error
    }

    var isActive: Bool {
        status == .active || endTime == nil
    }

    var formattedStartTime: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: startTime)
    }

    var duration: String? {
        guard let end = endTime else { return nil }

        let interval = end.timeIntervalSince(startTime)
        let hours = Int(interval) / 3600
        let minutes = (Int(interval) % 3600) / 60
        let seconds = Int(interval) % 60

        if hours > 0 {
            return "\(hours)h \(minutes)m \(seconds)s"
        } else if minutes > 0 {
            return "\(minutes)m \(seconds)s"
        } else {
            return "\(seconds)s"
        }
    }
}

// MARK: - Log Level

enum LogLevel: String, CaseIterable, Identifiable {
    case debug = "DEBUG"
    case info = "INFO"
    case warning = "WARNING"
    case error = "ERROR"
    case critical = "CRITICAL"

    var id: String { rawValue }

    var color: String {
        switch self {
        case .debug: return "mutedForeground"
        case .info: return "foreground"
        case .warning: return "warning"
        case .error: return "error"
        case .critical: return "error"
        }
    }

    var icon: String {
        switch self {
        case .debug: return "ant"
        case .info: return "info.circle"
        case .warning: return "exclamationmark.triangle"
        case .error: return "xmark.circle"
        case .critical: return "exclamationmark.octagon"
        }
    }
}
