//
//  LogsView.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import SwiftUI

/// Main logs screen with session list and log content viewer
struct LogsView: View {
    /// View model for logs
    @State private var viewModel = LogsViewModel()

    /// Horizontal size class for adaptive layout
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    /// Whether to show session sheet on iPhone
    @State private var showSessionSheet: Bool = false

    var body: some View {
        Group {
            if horizontalSizeClass == .regular {
                // iPad: Use NavigationSplitView
                iPadLayout
            } else {
                // iPhone: Use sheet for sessions
                iPhoneLayout
            }
        }
        .task {
            await viewModel.loadSessions()
        }
        .alert("Error", isPresented: $viewModel.showErrorAlert) {
            Button("OK", role: .cancel) {}
            Button("Retry") {
                Task {
                    await viewModel.refresh()
                }
            }
        } message: {
            if let error = viewModel.errorMessage {
                Text(error)
            }
        }
        .onDisappear {
            viewModel.stopAutoRefresh()
        }
    }

    // MARK: - iPad Layout

    private var iPadLayout: some View {
        NavigationSplitView(columnVisibility: .constant(.all)) {
            // Sidebar: Session list
            sidebarContent
                .navigationSplitViewColumnWidth(min: 280, ideal: 320, max: 400)
        } detail: {
            // Detail: Log content
            detailContent
        }
        .navigationSplitViewStyle(.balanced)
    }

    // MARK: - iPhone Layout

    private var iPhoneLayout: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Compact session selector
                if !viewModel.sessions.isEmpty {
                    compactSessionSelector
                }

                // Filter bar
                CompactLogFilterBar(
                    filterText: $viewModel.filterText,
                    levelFilter: $viewModel.levelFilter,
                    onClear: {
                        viewModel.clearFilter()
                    }
                )

                // Filter summary
                FilterSummary(
                    filterText: viewModel.filterText,
                    levelFilter: viewModel.levelFilter,
                    resultCount: viewModel.filteredEntries.count,
                    onClearSearch: {
                        viewModel.filterText = ""
                    },
                    onClearLevel: {
                        viewModel.levelFilter = .all
                    }
                )

                // Log content
                LogContentView(
                    entries: viewModel.filteredEntries,
                    isLoading: viewModel.isLoadingContent,
                    searchText: viewModel.filterText,
                    onRefresh: {
                        await viewModel.loadContent()
                    }
                )
            }
            .background(Color.theme.background)
            .navigationTitle("Logs")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                iPhoneToolbar
            }
            .sheet(isPresented: $showSessionSheet) {
                sessionSheetContent
            }
        }
    }

    // MARK: - Sidebar Content

    private var sidebarContent: some View {
        VStack(spacing: 0) {
            // Header
            LogSessionListHeader(
                sessionCount: viewModel.sessions.count,
                isRefreshing: viewModel.isLoadingSessions,
                onRefresh: {
                    Task {
                        await viewModel.loadSessions()
                    }
                }
            )

            Divider()
                .background(Color.theme.border)

            // Session list
            LogSessionList(
                groupedSessions: viewModel.groupedSessions,
                selectedSessionId: viewModel.selectedSessionId,
                isLoading: viewModel.isLoadingSessions,
                onSelect: { sessionId in
                    Task {
                        await viewModel.selectSession(sessionId)
                    }
                }
            )
        }
        .background(Color.theme.backgroundSecondary)
        .navigationTitle("Sessions")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Detail Content

    private var detailContent: some View {
        VStack(spacing: 0) {
            // Filter bar
            LogFilterBar(
                filterText: $viewModel.filterText,
                levelFilter: $viewModel.levelFilter,
                onClear: {
                    viewModel.clearFilter()
                }
            )

            // Filter summary
            FilterSummary(
                filterText: viewModel.filterText,
                levelFilter: viewModel.levelFilter,
                resultCount: viewModel.filteredEntries.count,
                onClearSearch: {
                    viewModel.filterText = ""
                },
                onClearLevel: {
                    viewModel.levelFilter = .all
                }
            )

            // Stats bar
            if viewModel.hasContent {
                LogStatsBar(stats: viewModel.logStats)
            }

            // Log content
            LogContentView(
                entries: viewModel.filteredEntries,
                isLoading: viewModel.isLoadingContent,
                searchText: viewModel.filterText,
                onRefresh: {
                    await viewModel.loadContent()
                }
            )
        }
        .background(Color.theme.background)
        .navigationTitle(viewModel.selectedSession?.name ?? "Logs")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            iPadToolbar
        }
    }

    // MARK: - Compact Session Selector

    private var compactSessionSelector: some View {
        Button {
            showSessionSheet = true
        } label: {
            HStack(spacing: .spacing.sm) {
                // Active indicator
                if viewModel.selectedSession?.isActive == true {
                    Circle()
                        .fill(Color.theme.success)
                        .frame(width: 8, height: 8)
                }

                // Session name
                Text(viewModel.selectedSession?.name ?? "Select Session")
                    .font(.theme.body)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.foreground)
                    .lineLimit(1)

                Spacer()

                // Size
                if let size = viewModel.selectedSession?.formattedSize {
                    Text(size)
                        .font(.theme.caption)
                        .foregroundColor(Color.theme.mutedForeground)
                }

                Image(systemName: "chevron.down")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color.theme.mutedForeground)
            }
            .padding(.horizontal, .spacing.lg)
            .padding(.vertical, .spacing.md)
            .background(Color.theme.backgroundSecondary)
        }
    }

    // MARK: - Session Sheet Content

    private var sessionSheetContent: some View {
        NavigationStack {
            VStack(spacing: 0) {
                LogSessionList(
                    groupedSessions: viewModel.groupedSessions,
                    selectedSessionId: viewModel.selectedSessionId,
                    isLoading: viewModel.isLoadingSessions,
                    onSelect: { sessionId in
                        Task {
                            await viewModel.selectSession(sessionId)
                            showSessionSheet = false
                        }
                    }
                )
            }
            .background(Color.theme.backgroundSecondary)
            .navigationTitle("Log Sessions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") {
                        showSessionSheet = false
                    }
                    .foregroundColor(Color.theme.primary)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    RefreshButton(isRefreshing: viewModel.isLoadingSessions, size: .small) {
                        Task {
                            await viewModel.loadSessions()
                        }
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - iPad Toolbar

    @ToolbarContentBuilder
    private var iPadToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            HStack(spacing: .spacing.md) {
                // Auto-refresh toggle
                autoRefreshToggle

                // Manual refresh
                ToolbarRefreshButton(isRefreshing: viewModel.isLoadingContent) {
                    Task {
                        await viewModel.loadContent()
                    }
                }

                // Share button
                shareButton
            }
        }
    }

    // MARK: - iPhone Toolbar

    @ToolbarContentBuilder
    private var iPhoneToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            HStack(spacing: .spacing.sm) {
                // Auto-refresh toggle
                autoRefreshToggle

                // Refresh button
                ToolbarRefreshButton(isRefreshing: viewModel.isLoadingContent) {
                    Task {
                        await viewModel.loadContent()
                    }
                }

                // Share button
                shareButton
            }
        }
    }

    // MARK: - Auto Refresh Toggle

    private var autoRefreshToggle: some View {
        Button {
            viewModel.toggleAutoRefresh()
        } label: {
            Image(systemName: viewModel.isAutoRefresh ? "play.circle.fill" : "play.circle")
                .font(.system(size: 18))
                .foregroundColor(viewModel.isAutoRefresh ? Color.theme.primary : Color.theme.foreground)
        }
        .help(viewModel.isAutoRefresh ? "Stop auto-refresh" : "Start auto-refresh (5s)")
    }

    // MARK: - Share Button

    private var shareButton: some View {
        ShareLink(
            item: viewModel.exportContent(),
            subject: Text("vLLM Server Logs"),
            message: Text("Logs from \(viewModel.selectedSession?.name ?? "session")")
        ) {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: 16))
                .foregroundColor(viewModel.hasContent ? Color.theme.foreground : Color.theme.mutedForeground)
        }
        .disabled(!viewModel.hasContent)
    }
}

// MARK: - Previews

#Preview("Logs View - iPad") {
    LogsView()
        .previewDevice("iPad Pro (11-inch) (4th generation)")
}

#Preview("Logs View - iPhone") {
    LogsView()
        .previewDevice("iPhone 15 Pro")
}

#Preview("Logs View with Data") {
    LogsViewPreview()
}

// MARK: - Preview Helper

private struct LogsViewPreview: View {
    @State private var viewModel = LogsViewModel.preview

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                LogSessionListHeader(
                    sessionCount: viewModel.sessions.count,
                    isRefreshing: false,
                    onRefresh: {}
                )

                Divider()
                    .background(Color.theme.border)

                LogSessionList(
                    groupedSessions: viewModel.groupedSessions,
                    selectedSessionId: viewModel.selectedSessionId,
                    isLoading: false,
                    onSelect: { id in
                        viewModel.selectedSessionId = id
                    }
                )
            }
            .background(Color.theme.backgroundSecondary)
            .navigationTitle("Sessions")
            .navigationBarTitleDisplayMode(.inline)
        } detail: {
            VStack(spacing: 0) {
                LogFilterBar(
                    filterText: $viewModel.filterText,
                    levelFilter: $viewModel.levelFilter,
                    onClear: {
                        viewModel.clearFilter()
                    }
                )

                LogStatsBar(stats: viewModel.logStats)

                LogContentView(
                    entries: viewModel.filteredEntries,
                    isLoading: false,
                    searchText: viewModel.filterText,
                    onRefresh: {}
                )
            }
            .background(Color.theme.background)
            .navigationTitle(viewModel.selectedSession?.name ?? "Logs")
            .navigationBarTitleDisplayMode(.inline)
        }
        .navigationSplitViewStyle(.balanced)
    }
}
