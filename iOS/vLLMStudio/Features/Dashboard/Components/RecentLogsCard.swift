import SwiftUI

/// Card showing recent log entries preview
struct RecentLogsCard: View {
    let logs: [LogEntry]
    let onViewAll: () -> Void
    let maxEntries: Int

    init(logs: [LogEntry], maxEntries: Int = 5, onViewAll: @escaping () -> Void) {
        self.logs = logs
        self.maxEntries = maxEntries
        self.onViewAll = onViewAll
    }

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Section header
            HStack {
                Image(systemName: "doc.text")
                    .font(.system(size: .iconSize.md))
                    .foregroundStyle(Color.theme.primary)

                Text("Recent Logs")
                    .font(.theme.headline)
                    .foregroundStyle(Color.theme.foreground)

                Spacer()

                Button(action: onViewAll) {
                    HStack(spacing: .spacing.xs) {
                        Text("View All")
                            .font(.theme.caption)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .foregroundStyle(Color.theme.primary)
                }
            }

            // Log entries
            VStack(spacing: 0) {
                if logs.isEmpty {
                    emptyState
                } else {
                    ForEach(Array(logs.prefix(maxEntries).enumerated()), id: \.element.id) { index, log in
                        LogEntryRow(log: log)

                        if index < min(logs.count, maxEntries) - 1 {
                            Divider()
                                .background(Color.theme.border)
                        }
                    }
                }
            }
            .background(Color.theme.card)
            .cornerRadius(.radius.lg)
            .overlay(
                RoundedRectangle(cornerRadius: .radius.lg)
                    .stroke(Color.theme.border, lineWidth: 1)
            )
        }
    }

    private var emptyState: some View {
        HStack(spacing: .spacing.md) {
            Image(systemName: "text.document")
                .font(.system(size: 24))
                .foregroundStyle(Color.theme.mutedForeground)

            VStack(alignment: .leading, spacing: .spacing.xs) {
                Text("No Recent Logs")
                    .font(.theme.body)
                    .foregroundStyle(Color.theme.foreground)

                Text("Logs will appear when the server is active")
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)
            }

            Spacer()
        }
        .padding(.spacing.lg)
    }
}

// MARK: - Log Entry Row

/// Single log entry row
struct LogEntryRow: View {
    let log: LogEntry

    var body: some View {
        HStack(alignment: .top, spacing: .spacing.md) {
            // Log level indicator
            LogLevelBadge(level: log.level)

            // Content
            VStack(alignment: .leading, spacing: .spacing.xs) {
                HStack {
                    Text(log.formattedTime)
                        .font(.theme.caption)
                        .fontDesign(.monospaced)
                        .foregroundStyle(Color.theme.mutedForeground)

                    if let source = log.source {
                        Text("[\(source)]")
                            .font(.theme.caption)
                            .foregroundStyle(Color.theme.mutedForeground)
                    }
                }

                Text(log.truncatedMessage)
                    .font(.theme.code)
                    .foregroundStyle(Color.theme.foreground)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }

            Spacer()
        }
        .padding(.spacing.md)
        .contentShape(Rectangle())
    }
}

// MARK: - Log Level Badge

/// Badge showing log level with appropriate color
struct LogLevelBadge: View {
    let level: LogEntry.LogLevel

    var body: some View {
        Text(level.description)
            .font(.theme.caption2)
            .fontWeight(.bold)
            .fontDesign(.monospaced)
            .foregroundStyle(levelColor)
            .padding(.horizontal, .spacing.sm)
            .padding(.vertical, .spacing.xxs)
            .background(levelColor.opacity(0.15))
            .cornerRadius(.radius.sm)
    }

    private var levelColor: Color {
        switch level {
        case .debug:
            return Color.theme.mutedForeground
        case .info:
            return Color.theme.info
        case .warning:
            return Color.theme.warning
        case .error:
            return Color.theme.error
        case .critical:
            return Color.theme.error
        }
    }
}

// MARK: - Expandable Log Entry

/// Expandable log entry for detailed view
struct ExpandableLogEntry: View {
    let log: LogEntry
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.sm) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(alignment: .top, spacing: .spacing.md) {
                    LogLevelBadge(level: log.level)

                    VStack(alignment: .leading, spacing: .spacing.xs) {
                        HStack {
                            Text(log.formattedTime)
                                .font(.theme.caption)
                                .fontDesign(.monospaced)
                                .foregroundStyle(Color.theme.mutedForeground)

                            if let source = log.source {
                                Text("[\(source)]")
                                    .font(.theme.caption)
                                    .foregroundStyle(Color.theme.mutedForeground)
                            }
                        }

                        Text(isExpanded ? log.message : log.truncatedMessage)
                            .font(.theme.code)
                            .foregroundStyle(Color.theme.foreground)
                            .lineLimit(isExpanded ? nil : 2)
                            .multilineTextAlignment(.leading)
                            .animation(.easeInOut(duration: 0.2), value: isExpanded)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.theme.mutedForeground)
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                }
                .padding(.spacing.md)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Log Stream View

/// Real-time log stream with auto-scroll
struct LogStreamView: View {
    let logs: [LogEntry]
    let isStreaming: Bool

    @State private var autoScroll = true

    var body: some View {
        VStack(spacing: 0) {
            // Stream indicator
            if isStreaming {
                HStack(spacing: .spacing.sm) {
                    Circle()
                        .fill(Color.theme.success)
                        .frame(width: 8, height: 8)
                        .overlay(
                            Circle()
                                .stroke(Color.theme.success.opacity(0.5), lineWidth: 2)
                                .scaleEffect(1.5)
                        )

                    Text("Live")
                        .font(.theme.caption)
                        .foregroundStyle(Color.theme.success)

                    Spacer()

                    Toggle("Auto-scroll", isOn: $autoScroll)
                        .toggleStyle(SwitchToggleStyle(tint: Color.theme.primary))
                        .font(.theme.caption)
                        .foregroundStyle(Color.theme.mutedForeground)
                }
                .padding(.spacing.md)
                .background(Color.theme.backgroundSecondary)
            }

            // Log entries
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(logs) { log in
                            ExpandableLogEntry(log: log)
                                .id(log.id)

                            Divider()
                                .background(Color.theme.border)
                        }
                    }
                }
                .onChange(of: logs.count) { _, _ in
                    if autoScroll, let lastLog = logs.last {
                        withAnimation {
                            proxy.scrollTo(lastLog.id, anchor: .bottom)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        VStack(spacing: 24) {
            RecentLogsCard(
                logs: [
                    LogEntry(
                        id: "1",
                        timestamp: Date(),
                        level: .info,
                        message: "Model loaded successfully: meta-llama/Llama-3.1-70B",
                        source: "ModelLoader",
                        sessionId: nil
                    ),
                    LogEntry(
                        id: "2",
                        timestamp: Date().addingTimeInterval(-60),
                        level: .warning,
                        message: "High memory usage detected on GPU 0: 95% utilized",
                        source: "GPUMonitor",
                        sessionId: nil
                    ),
                    LogEntry(
                        id: "3",
                        timestamp: Date().addingTimeInterval(-120),
                        level: .error,
                        message: "Failed to connect to MCP server: Connection refused. Please check if the server is running and the port is correct.",
                        source: "MCPClient",
                        sessionId: nil
                    ),
                    LogEntry(
                        id: "4",
                        timestamp: Date().addingTimeInterval(-180),
                        level: .debug,
                        message: "Request completed in 245ms",
                        source: "API",
                        sessionId: "session-123"
                    ),
                    LogEntry(
                        id: "5",
                        timestamp: Date().addingTimeInterval(-240),
                        level: .info,
                        message: "Server started on port 8080",
                        source: "Server",
                        sessionId: nil
                    )
                ],
                onViewAll: {}
            )

            RecentLogsCard(
                logs: [],
                onViewAll: {}
            )
        }
        .padding()
    }
    .background(Color.theme.background)
}
