//
//  LogEntry.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation

// MARK: - Log Session

/// Represents a log session from the vLLM server
struct LogSession: Identifiable, Codable, Equatable, Hashable {
    /// Unique identifier for the session
    let id: String

    /// Display name of the session
    let name: String

    /// When the session was created
    let createdAt: Date

    /// Size of the log file in bytes
    let size: Int64

    /// Optional end time for completed sessions
    let endedAt: Date?

    /// Whether the session is currently active
    let isActive: Bool

    // MARK: - Computed Properties

    /// Formatted file size string
    var formattedSize: String {
        ByteCountFormatter.string(fromByteCount: size, countStyle: .file)
    }

    /// Formatted creation date
    var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: createdAt)
    }

    /// Relative time string (e.g., "2 hours ago")
    var relativeTime: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: createdAt, relativeTo: Date())
    }

    /// Duration string if session has ended
    var durationString: String? {
        guard let endedAt = endedAt else { return nil }
        let duration = endedAt.timeIntervalSince(createdAt)
        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = [.hour, .minute, .second]
        formatter.unitsStyle = .abbreviated
        return formatter.string(from: duration)
    }

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case createdAt = "created_at"
        case size
        case endedAt = "ended_at"
        case isActive = "is_active"
    }
}

// MARK: - Log Level

/// Log severity levels
enum LogLevel: String, Codable, CaseIterable, Identifiable {
    case debug = "DEBUG"
    case info = "INFO"
    case warning = "WARNING"
    case error = "ERROR"
    case critical = "CRITICAL"

    var id: String { rawValue }

    /// Display name for the log level
    var displayName: String {
        switch self {
        case .debug: return "Debug"
        case .info: return "Info"
        case .warning: return "Warning"
        case .error: return "Error"
        case .critical: return "Critical"
        }
    }

    /// Short display name
    var shortName: String {
        switch self {
        case .debug: return "DBG"
        case .info: return "INF"
        case .warning: return "WRN"
        case .error: return "ERR"
        case .critical: return "CRT"
        }
    }

    /// Sort priority (higher = more severe)
    var severity: Int {
        switch self {
        case .debug: return 0
        case .info: return 1
        case .warning: return 2
        case .error: return 3
        case .critical: return 4
        }
    }

    /// System image name for the level
    var iconName: String {
        switch self {
        case .debug: return "ant"
        case .info: return "info.circle"
        case .warning: return "exclamationmark.triangle"
        case .error: return "xmark.circle"
        case .critical: return "exclamationmark.octagon"
        }
    }
}

// MARK: - Log Entry

/// Represents a single log entry
struct LogEntry: Identifiable, Equatable {
    /// Unique identifier
    let id: UUID

    /// Line number in the log file
    let lineNumber: Int

    /// Timestamp of the log entry
    let timestamp: Date?

    /// Log level
    let level: LogLevel?

    /// Source component/module
    let source: String?

    /// The log message
    let message: String

    /// Raw log line
    let rawLine: String

    // MARK: - Initialization

    init(
        id: UUID = UUID(),
        lineNumber: Int,
        timestamp: Date? = nil,
        level: LogLevel? = nil,
        source: String? = nil,
        message: String,
        rawLine: String
    ) {
        self.id = id
        self.lineNumber = lineNumber
        self.timestamp = timestamp
        self.level = level
        self.source = source
        self.message = message
        self.rawLine = rawLine
    }

    /// Formatted timestamp string
    var formattedTimestamp: String? {
        guard let timestamp = timestamp else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss.SSS"
        return formatter.string(from: timestamp)
    }
}

// MARK: - Log Filter

/// Filter options for log viewing
enum LogFilter: String, CaseIterable, Identifiable {
    case all = "All"
    case error = "Error"
    case warning = "Warning"
    case info = "Info"
    case debug = "Debug"

    var id: String { rawValue }

    /// Corresponding log levels for the filter
    var includedLevels: [LogLevel] {
        switch self {
        case .all:
            return LogLevel.allCases
        case .error:
            return [.error, .critical]
        case .warning:
            return [.warning]
        case .info:
            return [.info]
        case .debug:
            return [.debug]
        }
    }

    /// System image name for the filter
    var iconName: String {
        switch self {
        case .all: return "list.bullet"
        case .error: return "xmark.circle"
        case .warning: return "exclamationmark.triangle"
        case .info: return "info.circle"
        case .debug: return "ant"
        }
    }
}

// MARK: - Log Content Response

/// API response for log content
struct LogContentResponse: Codable {
    /// The raw log content
    let content: String

    /// Total number of lines
    let lineCount: Int

    /// Whether there are more lines available
    let hasMore: Bool

    /// Offset for pagination
    let offset: Int?

    enum CodingKeys: String, CodingKey {
        case content
        case lineCount = "line_count"
        case hasMore = "has_more"
        case offset
    }
}

// MARK: - Log Sessions Response

/// API response for log sessions list
struct LogSessionsResponse: Codable {
    /// List of log sessions
    let sessions: [LogSession]

    /// Total count of sessions
    let total: Int
}

// MARK: - Date Grouping

extension LogSession {
    /// Groups log sessions by date
    static func groupByDate(_ sessions: [LogSession]) -> [(date: Date, sessions: [LogSession])] {
        let calendar = Calendar.current

        let grouped = Dictionary(grouping: sessions) { session -> Date in
            calendar.startOfDay(for: session.createdAt)
        }

        return grouped
            .sorted { $0.key > $1.key }
            .map { (date: $0.key, sessions: $0.value.sorted { $0.createdAt > $1.createdAt }) }
    }

    /// Header text for date group
    static func dateGroupHeader(for date: Date) -> String {
        let calendar = Calendar.current

        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            formatter.timeStyle = .none
            return formatter.string(from: date)
        }
    }
}

// MARK: - Log Parsing

extension LogEntry {
    /// Parses a raw log line into a LogEntry
    static func parse(line: String, lineNumber: Int) -> LogEntry {
        // Common log format patterns
        // Example: "2026-01-22 10:30:45.123 [INFO] [vllm.engine] Message here"
        // Example: "INFO:     Message here"
        // Example: "[2026-01-22 10:30:45] ERROR - Message"

        var timestamp: Date?
        var level: LogLevel?
        var source: String?
        var message = line

        // Try to parse timestamp
        let timestampPatterns = [
            "\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{3}",
            "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}",
            "\\[\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\]"
        ]

        for pattern in timestampPatterns {
            if let range = line.range(of: pattern, options: .regularExpression) {
                let timestampStr = String(line[range]).trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
                timestamp = parseTimestamp(timestampStr)
                break
            }
        }

        // Try to parse log level
        for logLevel in LogLevel.allCases {
            let levelPatterns = [
                "\\[\(logLevel.rawValue)\\]",
                "\(logLevel.rawValue):",
                "\(logLevel.rawValue) -",
                "\\[\(logLevel.rawValue.lowercased())\\]",
                "\(logLevel.rawValue.lowercased()):"
            ]

            for pattern in levelPatterns {
                if line.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil {
                    level = logLevel
                    break
                }
            }
            if level != nil { break }
        }

        // Try to parse source/module
        if let sourceRange = line.range(of: "\\[\\w+\\.\\w+\\]", options: .regularExpression) {
            source = String(line[sourceRange]).trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
        }

        return LogEntry(
            lineNumber: lineNumber,
            timestamp: timestamp,
            level: level,
            source: source,
            message: message,
            rawLine: line
        )
    }

    /// Parses a timestamp string into a Date
    private static func parseTimestamp(_ string: String) -> Date? {
        let formatters: [DateFormatter] = [
            {
                let f = DateFormatter()
                f.dateFormat = "yyyy-MM-dd HH:mm:ss.SSS"
                return f
            }(),
            {
                let f = DateFormatter()
                f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
                return f
            }(),
            {
                let f = DateFormatter()
                f.dateFormat = "yyyy-MM-dd HH:mm:ss"
                return f
            }()
        ]

        for formatter in formatters {
            if let date = formatter.date(from: string) {
                return date
            }
        }

        return nil
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension LogSession {
    static let preview = LogSession(
        id: "session-1",
        name: "vllm-server-2026-01-22",
        createdAt: Date(),
        size: 1_234_567,
        endedAt: nil,
        isActive: true
    )

    static let previewList: [LogSession] = [
        LogSession(
            id: "session-1",
            name: "vllm-server-2026-01-22",
            createdAt: Date(),
            size: 1_234_567,
            endedAt: nil,
            isActive: true
        ),
        LogSession(
            id: "session-2",
            name: "vllm-server-2026-01-21",
            createdAt: Date().addingTimeInterval(-86400),
            size: 2_345_678,
            endedAt: Date().addingTimeInterval(-82800),
            isActive: false
        ),
        LogSession(
            id: "session-3",
            name: "vllm-server-2026-01-20",
            createdAt: Date().addingTimeInterval(-172800),
            size: 987_654,
            endedAt: Date().addingTimeInterval(-169200),
            isActive: false
        )
    ]
}

extension LogEntry {
    static let previewList: [LogEntry] = [
        LogEntry(
            lineNumber: 1,
            timestamp: Date(),
            level: .info,
            source: "vllm.engine",
            message: "Starting vLLM engine...",
            rawLine: "2026-01-22 10:30:45.123 [INFO] [vllm.engine] Starting vLLM engine..."
        ),
        LogEntry(
            lineNumber: 2,
            timestamp: Date().addingTimeInterval(1),
            level: .info,
            source: "vllm.config",
            message: "Model: meta-llama/Llama-3.1-70B-Instruct",
            rawLine: "2026-01-22 10:30:46.456 [INFO] [vllm.config] Model: meta-llama/Llama-3.1-70B-Instruct"
        ),
        LogEntry(
            lineNumber: 3,
            timestamp: Date().addingTimeInterval(2),
            level: .warning,
            source: "vllm.memory",
            message: "GPU memory usage is high: 95%",
            rawLine: "2026-01-22 10:30:47.789 [WARNING] [vllm.memory] GPU memory usage is high: 95%"
        ),
        LogEntry(
            lineNumber: 4,
            timestamp: Date().addingTimeInterval(3),
            level: .error,
            source: "vllm.worker",
            message: "Worker timeout exceeded",
            rawLine: "2026-01-22 10:30:48.012 [ERROR] [vllm.worker] Worker timeout exceeded"
        ),
        LogEntry(
            lineNumber: 5,
            timestamp: Date().addingTimeInterval(4),
            level: .debug,
            source: "vllm.scheduler",
            message: "Scheduling batch of 4 requests",
            rawLine: "2026-01-22 10:30:49.345 [DEBUG] [vllm.scheduler] Scheduling batch of 4 requests"
        )
    ]
}
#endif
