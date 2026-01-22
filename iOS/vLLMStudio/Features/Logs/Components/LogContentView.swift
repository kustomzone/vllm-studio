//
//  LogContentView.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import SwiftUI

/// Displays log content with line numbers and syntax highlighting
struct LogContentView: View {
    /// Log entries to display
    let entries: [LogEntry]

    /// Whether content is loading
    let isLoading: Bool

    /// Search text for highlighting
    let searchText: String

    /// Refresh action
    let onRefresh: () async -> Void

    /// State for scroll position
    @State private var scrollProxy: ScrollViewProxy?
    @State private var isAtBottom: Bool = true
    @State private var showScrollToBottom: Bool = false

    var body: some View {
        Group {
            if isLoading && entries.isEmpty {
                LoadingView(message: "Loading logs...")
            } else if entries.isEmpty {
                emptyState
            } else {
                logContentList
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: .spacing.lg) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 48))
                .foregroundColor(Color.theme.mutedForeground)

            Text("No Log Entries")
                .font(.theme.headline)
                .foregroundColor(Color.theme.foreground)

            Text("Select a session to view its logs")
                .font(.theme.body)
                .foregroundColor(Color.theme.mutedForeground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.theme.background)
    }

    // MARK: - Log Content List

    private var logContentList: some View {
        ZStack(alignment: .bottomTrailing) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(entries) { entry in
                            LogLineView(
                                entry: entry,
                                searchText: searchText
                            )
                            .id(entry.id)
                        }
                    }
                    .padding(.vertical, .spacing.sm)

                    // Bottom anchor for scroll tracking
                    Color.clear
                        .frame(height: 1)
                        .id("bottom")
                        .onAppear {
                            isAtBottom = true
                            showScrollToBottom = false
                        }
                        .onDisappear {
                            isAtBottom = false
                            showScrollToBottom = true
                        }
                }
                .scrollContentBackground(.hidden)
                .background(Color.theme.background)
                .refreshable {
                    await onRefresh()
                }
                .onAppear {
                    scrollProxy = proxy
                }
            }

            // Scroll to bottom button
            if showScrollToBottom {
                scrollToBottomButton
                    .padding(.spacing.lg)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: showScrollToBottom)
    }

    // MARK: - Scroll to Bottom Button

    private var scrollToBottomButton: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.3)) {
                scrollProxy?.scrollTo("bottom", anchor: .bottom)
            }
        } label: {
            HStack(spacing: .spacing.sm) {
                Image(systemName: "arrow.down")
                    .font(.system(size: 12, weight: .semibold))

                Text("Bottom")
                    .font(.theme.caption)
                    .fontWeight(.medium)
            }
            .foregroundColor(Color.theme.foreground)
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .background(Color.theme.card)
            .cornerRadius(.radius.full)
            .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
        }
    }

    /// Scrolls to the bottom of the log
    func scrollToBottom() {
        withAnimation {
            scrollProxy?.scrollTo("bottom", anchor: .bottom)
        }
    }

    /// Scrolls to the top of the log
    func scrollToTop() {
        withAnimation {
            if let firstEntry = entries.first {
                scrollProxy?.scrollTo(firstEntry.id, anchor: .top)
            }
        }
    }
}

// MARK: - Log Line View

/// Displays a single log line with line number and level highlighting
struct LogLineView: View {
    let entry: LogEntry
    let searchText: String

    /// Width for line numbers column
    private let lineNumberWidth: CGFloat = 50

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            // Line number
            Text("\(entry.lineNumber)")
                .font(.theme.code)
                .foregroundColor(Color.theme.mutedForeground.opacity(0.6))
                .frame(width: lineNumberWidth, alignment: .trailing)
                .padding(.trailing, .spacing.md)

            // Separator
            Rectangle()
                .fill(Color.theme.border)
                .frame(width: 1)
                .padding(.trailing, .spacing.md)

            // Log content
            logContent
        }
        .padding(.horizontal, .spacing.sm)
        .padding(.vertical, .spacing.xxs)
        .background(backgroundColor)
    }

    // MARK: - Log Content

    private var logContent: some View {
        HStack(alignment: .top, spacing: .spacing.sm) {
            // Level badge (if available)
            if let level = entry.level {
                LogLevelBadge(level: level)
            }

            // Timestamp (if available)
            if let timestamp = entry.formattedTimestamp {
                Text(timestamp)
                    .font(.theme.code)
                    .foregroundColor(Color.theme.mutedForeground)
            }

            // Message with search highlighting
            highlightedMessage
                .font(.theme.code)
                .foregroundColor(Color.theme.foreground)
                .textSelection(.enabled)

            Spacer(minLength: 0)
        }
    }

    // MARK: - Highlighted Message

    @ViewBuilder
    private var highlightedMessage: some View {
        if searchText.isEmpty {
            Text(entry.message)
        } else {
            HighlightedText(
                text: entry.message,
                highlight: searchText,
                highlightColor: Color.theme.warning.opacity(0.4)
            )
        }
    }

    // MARK: - Background Color

    private var backgroundColor: Color {
        guard let level = entry.level else {
            return Color.clear
        }

        switch level {
        case .error, .critical:
            return Color.theme.error.opacity(0.08)
        case .warning:
            return Color.theme.warning.opacity(0.06)
        default:
            return Color.clear
        }
    }
}

// MARK: - Log Level Badge

/// A compact badge showing the log level
struct LogLevelBadge: View {
    let level: LogLevel

    var body: some View {
        Text(level.shortName)
            .font(.system(size: 10, weight: .bold, design: .monospaced))
            .foregroundColor(foregroundColor)
            .padding(.horizontal, 4)
            .padding(.vertical, 2)
            .background(backgroundColor)
            .cornerRadius(3)
    }

    private var foregroundColor: Color {
        switch level {
        case .debug:
            return Color.theme.mutedForeground
        case .info:
            return Color.theme.info
        case .warning:
            return Color.theme.warning
        case .error, .critical:
            return Color.theme.error
        }
    }

    private var backgroundColor: Color {
        foregroundColor.opacity(0.15)
    }
}

// MARK: - Highlighted Text

/// Text view with search term highlighting
struct HighlightedText: View {
    let text: String
    let highlight: String
    let highlightColor: Color

    var body: some View {
        if highlight.isEmpty {
            Text(text)
        } else {
            Text(attributedString)
        }
    }

    private var attributedString: AttributedString {
        var result = AttributedString(text)
        let searchLower = highlight.lowercased()
        let textLower = text.lowercased()

        var searchStart = textLower.startIndex
        while let range = textLower.range(of: searchLower, range: searchStart..<textLower.endIndex) {
            if let attrRange = Range(range, in: result) {
                result[attrRange].backgroundColor = highlightColor
                result[attrRange].foregroundColor = Color.theme.foreground
            }
            searchStart = range.upperBound
        }

        return result
    }
}

// MARK: - Log Stats Bar

/// A bar showing statistics about the current log content
struct LogStatsBar: View {
    let stats: LogStats

    var body: some View {
        HStack(spacing: .spacing.lg) {
            // Total lines
            StatItem(
                icon: "list.number",
                label: "Lines",
                value: "\(stats.totalLines)"
            )

            if stats.filteredLines != stats.totalLines {
                StatItem(
                    icon: "line.3.horizontal.decrease.circle",
                    label: "Filtered",
                    value: "\(stats.filteredLines)"
                )
            }

            if stats.hasErrors {
                StatItem(
                    icon: "xmark.circle",
                    label: "Errors",
                    value: "\(stats.errorCount)",
                    color: Color.theme.error
                )
            }

            if stats.hasWarnings {
                StatItem(
                    icon: "exclamationmark.triangle",
                    label: "Warnings",
                    value: "\(stats.warningCount)",
                    color: Color.theme.warning
                )
            }

            Spacer()
        }
        .padding(.horizontal, .spacing.lg)
        .padding(.vertical, .spacing.sm)
        .background(Color.theme.backgroundSecondary)
    }
}

// MARK: - Stat Item

private struct StatItem: View {
    let icon: String
    let label: String
    let value: String
    var color: Color = Color.theme.mutedForeground

    var body: some View {
        HStack(spacing: .spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundColor(color)

            Text(value)
                .font(.theme.caption)
                .fontWeight(.medium)
                .foregroundColor(color)

            Text(label)
                .font(.theme.caption)
                .foregroundColor(Color.theme.mutedForeground)
        }
    }
}

// MARK: - Previews

#Preview("Log Content") {
    LogContentView(
        entries: LogEntry.previewList,
        isLoading: false,
        searchText: "",
        onRefresh: {}
    )
    .background(Color.theme.background)
}

#Preview("Log Content with Search") {
    LogContentView(
        entries: LogEntry.previewList,
        isLoading: false,
        searchText: "vllm",
        onRefresh: {}
    )
    .background(Color.theme.background)
}

#Preview("Log Line - Info") {
    LogLineView(
        entry: LogEntry.previewList[0],
        searchText: ""
    )
    .background(Color.theme.background)
}

#Preview("Log Line - Error") {
    LogLineView(
        entry: LogEntry.previewList[3],
        searchText: ""
    )
    .background(Color.theme.background)
}

#Preview("Log Level Badges") {
    HStack(spacing: 8) {
        LogLevelBadge(level: .debug)
        LogLevelBadge(level: .info)
        LogLevelBadge(level: .warning)
        LogLevelBadge(level: .error)
        LogLevelBadge(level: .critical)
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("Log Stats Bar") {
    LogStatsBar(stats: LogStats(
        totalLines: 1234,
        filteredLines: 567,
        errorCount: 12,
        warningCount: 45
    ))
}

#Preview("Empty State") {
    LogContentView(
        entries: [],
        isLoading: false,
        searchText: "",
        onRefresh: {}
    )
    .background(Color.theme.background)
}

#Preview("Loading State") {
    LogContentView(
        entries: [],
        isLoading: true,
        searchText: "",
        onRefresh: {}
    )
    .background(Color.theme.background)
}
