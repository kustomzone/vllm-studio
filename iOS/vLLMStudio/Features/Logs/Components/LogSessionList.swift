//
//  LogSessionList.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import SwiftUI

/// A list view showing log sessions grouped by date
struct LogSessionList: View {
    /// Sessions grouped by date
    let groupedSessions: [(date: Date, sessions: [LogSession])]

    /// Currently selected session ID
    let selectedSessionId: String?

    /// Whether sessions are loading
    let isLoading: Bool

    /// Action when a session is selected
    let onSelect: (String) -> Void

    var body: some View {
        Group {
            if isLoading && groupedSessions.isEmpty {
                LoadingView(message: "Loading sessions...")
            } else if groupedSessions.isEmpty {
                EmptyStateView.noLogs
            } else {
                sessionsList
            }
        }
    }

    // MARK: - Sessions List

    private var sessionsList: some View {
        List {
            ForEach(groupedSessions, id: \.date) { group in
                Section {
                    ForEach(group.sessions) { session in
                        LogSessionRow(
                            session: session,
                            isSelected: session.id == selectedSessionId
                        )
                        .contentShape(Rectangle())
                        .onTapGesture {
                            onSelect(session.id)
                        }
                        .listRowBackground(
                            session.id == selectedSessionId
                                ? Color.theme.primary.opacity(0.15)
                                : Color.theme.backgroundSecondary
                        )
                        .listRowSeparatorTint(Color.theme.border)
                    }
                } header: {
                    Text(LogSession.dateGroupHeader(for: group.date))
                        .font(.theme.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(Color.theme.mutedForeground)
                        .textCase(nil)
                }
            }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .background(Color.theme.backgroundSecondary)
    }
}

// MARK: - Log Session Row

/// A row displaying a single log session
struct LogSessionRow: View {
    let session: LogSession
    let isSelected: Bool

    var body: some View {
        HStack(spacing: .spacing.md) {
            // Status indicator
            statusIndicator

            // Session info
            VStack(alignment: .leading, spacing: .spacing.xs) {
                // Session name
                Text(session.name)
                    .font(.theme.body)
                    .fontWeight(isSelected ? .semibold : .regular)
                    .foregroundColor(Color.theme.foreground)
                    .lineLimit(1)

                // Timestamp and size
                HStack(spacing: .spacing.sm) {
                    Text(session.relativeTime)
                        .font(.theme.caption)
                        .foregroundColor(Color.theme.mutedForeground)

                    Text("·")
                        .font(.theme.caption)
                        .foregroundColor(Color.theme.mutedForeground)

                    Text(session.formattedSize)
                        .font(.theme.caption)
                        .foregroundColor(Color.theme.mutedForeground)
                }
            }

            Spacer()

            // Selection indicator
            if isSelected {
                Image(systemName: "checkmark")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color.theme.primary)
            }
        }
        .padding(.vertical, .spacing.sm)
    }

    // MARK: - Status Indicator

    @ViewBuilder
    private var statusIndicator: some View {
        if session.isActive {
            // Active session - pulsing dot
            Circle()
                .fill(Color.theme.success)
                .frame(width: 8, height: 8)
                .overlay(
                    Circle()
                        .stroke(Color.theme.success.opacity(0.3), lineWidth: 2)
                        .scaleEffect(1.5)
                )
        } else {
            // Inactive session - static dot
            Circle()
                .fill(Color.theme.mutedForeground.opacity(0.5))
                .frame(width: 8, height: 8)
        }
    }
}

// MARK: - Compact Session List

/// A more compact session list for smaller screens
struct CompactLogSessionList: View {
    let sessions: [LogSession]
    let selectedSessionId: String?
    let onSelect: (String) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: .spacing.sm) {
                ForEach(sessions) { session in
                    CompactSessionChip(
                        session: session,
                        isSelected: session.id == selectedSessionId
                    )
                    .onTapGesture {
                        onSelect(session.id)
                    }
                }
            }
            .padding(.horizontal, .spacing.lg)
        }
    }
}

// MARK: - Compact Session Chip

/// A chip-style button for compact session selection
struct CompactSessionChip: View {
    let session: LogSession
    let isSelected: Bool

    var body: some View {
        HStack(spacing: .spacing.sm) {
            // Active indicator
            if session.isActive {
                Circle()
                    .fill(Color.theme.success)
                    .frame(width: 6, height: 6)
            }

            // Session name (truncated)
            Text(truncatedName)
                .font(.theme.caption)
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundColor(isSelected ? Color.theme.primary : Color.theme.foreground)

            // Size
            Text(session.formattedSize)
                .font(.theme.caption2)
                .foregroundColor(Color.theme.mutedForeground)
        }
        .padding(.horizontal, .spacing.md)
        .padding(.vertical, .spacing.sm)
        .background(
            isSelected
                ? Color.theme.primary.opacity(0.15)
                : Color.theme.backgroundTertiary
        )
        .cornerRadius(.radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: .radius.md)
                .stroke(
                    isSelected ? Color.theme.primary.opacity(0.5) : Color.clear,
                    lineWidth: 1
                )
        )
    }

    private var truncatedName: String {
        let name = session.name
        if name.count > 20 {
            return String(name.prefix(17)) + "..."
        }
        return name
    }
}

// MARK: - Session List Header

/// Header for the session list section
struct LogSessionListHeader: View {
    let sessionCount: Int
    let isRefreshing: Bool
    let onRefresh: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: .spacing.xxs) {
                Text("Sessions")
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)

                Text("\(sessionCount) log \(sessionCount == 1 ? "file" : "files")")
                    .font(.theme.caption)
                    .foregroundColor(Color.theme.mutedForeground)
            }

            Spacer()

            RefreshButton(isRefreshing: isRefreshing, size: .small) {
                onRefresh()
            }
        }
        .padding(.horizontal, .spacing.lg)
        .padding(.vertical, .spacing.md)
        .background(Color.theme.backgroundSecondary)
    }
}

// MARK: - Previews

#Preview("Session List") {
    LogSessionList(
        groupedSessions: LogSession.groupByDate(LogSession.previewList),
        selectedSessionId: "session-1",
        isLoading: false,
        onSelect: { _ in }
    )
    .frame(width: 320)
    .background(Color.theme.background)
}

#Preview("Session Row - Selected") {
    LogSessionRow(
        session: LogSession.preview,
        isSelected: true
    )
    .padding()
    .background(Color.theme.primary.opacity(0.15))
}

#Preview("Session Row - Unselected") {
    LogSessionRow(
        session: LogSession.preview,
        isSelected: false
    )
    .padding()
    .background(Color.theme.backgroundSecondary)
}

#Preview("Compact Session List") {
    CompactLogSessionList(
        sessions: LogSession.previewList,
        selectedSessionId: "session-1",
        onSelect: { _ in }
    )
    .padding(.vertical)
    .background(Color.theme.background)
}

#Preview("Empty State") {
    LogSessionList(
        groupedSessions: [],
        selectedSessionId: nil,
        isLoading: false,
        onSelect: { _ in }
    )
    .frame(width: 320)
    .background(Color.theme.background)
}

#Preview("Loading State") {
    LogSessionList(
        groupedSessions: [],
        selectedSessionId: nil,
        isLoading: true,
        onSelect: { _ in }
    )
    .frame(width: 320)
    .background(Color.theme.background)
}
