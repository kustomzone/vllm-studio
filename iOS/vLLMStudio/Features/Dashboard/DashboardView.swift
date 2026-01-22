import SwiftUI

/// Main dashboard screen showing system overview
struct DashboardView: View {
    @State private var viewModel = DashboardViewModel()
    @State private var showingSettings = false

    /// Callback for navigating to recipes
    var onNavigateToRecipes: (() -> Void)?

    /// Callback for navigating to logs
    var onNavigateToLogs: (() -> Void)?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: .spacing.xl) {
                    // System health overview
                    systemHealthSection

                    // GPU metrics grid
                    MetricsGrid(
                        metrics: viewModel.gpuMetrics,
                        previousMetrics: viewModel.previousGPUMetrics
                    )

                    // Quick launch section
                    QuickLaunchSection(
                        recipes: viewModel.pinnedRecipes,
                        onLaunch: { recipe in
                            Task {
                                if recipe.status == .running {
                                    await viewModel.stopRecipe(recipe)
                                } else {
                                    await viewModel.launchRecipe(recipe)
                                }
                            }
                        },
                        onViewAll: {
                            onNavigateToRecipes?()
                        }
                    )

                    // Recent logs preview
                    RecentLogsCard(
                        logs: viewModel.recentLogs,
                        onViewAll: {
                            onNavigateToLogs?()
                        }
                    )

                    // Last updated footer
                    lastUpdatedFooter
                }
                .padding(.spacing.lg)
            }
            .background(Color.theme.background)
            .refreshable {
                await viewModel.refresh()
            }
            .navigationTitle("Dashboard")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    connectionStatusButton
                }

                ToolbarItem(placement: .topBarTrailing) {
                    refreshButton
                }
            }
            .alert(
                "Error",
                isPresented: .init(
                    get: { viewModel.error != nil },
                    set: { if !$0 { viewModel.clearError() } }
                ),
                presenting: viewModel.error
            ) { _ in
                Button("OK") {
                    viewModel.clearError()
                }
            } message: { error in
                Text(error.localizedDescription)
            }
            .task {
                await viewModel.refresh()
                viewModel.connectWebSocket()
            }
            .onDisappear {
                viewModel.disconnect()
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - System Health Section

    private var systemHealthSection: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            HStack {
                Image(systemName: "heart.fill")
                    .font(.system(size: .iconSize.md))
                    .foregroundStyle(Color.theme.primary)

                Text("System Health")
                    .font(.theme.headline)
                    .foregroundStyle(Color.theme.foreground)

                Spacer()

                SystemHealthBadge(status: viewModel.systemHealth.status)
            }

            SystemMetricsOverview(
                systemHealth: viewModel.systemHealth,
                totalMemoryUsed: viewModel.totalMemoryUsed,
                totalMemoryAvailable: viewModel.totalMemoryAvailable
            )
        }
    }

    // MARK: - Connection Status Button

    private var connectionStatusButton: some View {
        Button {
            if viewModel.connectionStatus.isConnected {
                viewModel.disconnect()
            } else {
                viewModel.connectWebSocket()
            }
        } label: {
            HStack(spacing: .spacing.xs) {
                Circle()
                    .fill(connectionStatusColor)
                    .frame(width: 8, height: 8)

                Text(viewModel.connectionStatus.description)
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)
            }
            .padding(.horizontal, .spacing.sm)
            .padding(.vertical, .spacing.xs)
            .background(Color.theme.backgroundSecondary)
            .cornerRadius(.radius.full)
        }
    }

    private var connectionStatusColor: Color {
        switch viewModel.connectionStatus {
        case .connected:
            return Color.theme.success
        case .connecting:
            return Color.theme.warning
        case .disconnected:
            return Color.theme.mutedForeground
        case .error:
            return Color.theme.error
        }
    }

    // MARK: - Refresh Button

    private var refreshButton: some View {
        Button {
            Task {
                await viewModel.refresh()
            }
        } label: {
            if viewModel.isLoading {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: Color.theme.primary))
            } else {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: .iconSize.md))
                    .foregroundStyle(Color.theme.primary)
            }
        }
        .disabled(viewModel.isLoading)
    }

    // MARK: - Last Updated Footer

    private var lastUpdatedFooter: some View {
        Group {
            if let lastRefreshed = viewModel.lastRefreshed {
                HStack {
                    Spacer()
                    Text("Last updated: \(lastRefreshed, formatter: timeFormatter)")
                        .font(.theme.caption)
                        .foregroundStyle(Color.theme.mutedForeground)
                    Spacer()
                }
            }
        }
    }

    private var timeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter
    }
}

// MARK: - System Health Badge

/// Badge showing system health status
struct SystemHealthBadge: View {
    let status: SystemHealth.Status

    var body: some View {
        HStack(spacing: .spacing.xs) {
            Image(systemName: statusIcon)
                .font(.system(size: .iconSize.sm))

            Text(status.description)
                .font(.theme.caption)
                .fontWeight(.medium)
        }
        .foregroundStyle(statusColor)
        .padding(.horizontal, .spacing.md)
        .padding(.vertical, .spacing.sm)
        .background(statusColor.opacity(0.15))
        .cornerRadius(.radius.full)
    }

    private var statusIcon: String {
        switch status {
        case .healthy:
            return "checkmark.circle.fill"
        case .degraded:
            return "exclamationmark.triangle.fill"
        case .unhealthy:
            return "xmark.circle.fill"
        case .unknown:
            return "questionmark.circle.fill"
        }
    }

    private var statusColor: Color {
        switch status {
        case .healthy:
            return Color.theme.success
        case .degraded:
            return Color.theme.warning
        case .unhealthy:
            return Color.theme.error
        case .unknown:
            return Color.theme.mutedForeground
        }
    }
}

// MARK: - Loading Overlay

/// Overlay shown during initial loading
struct DashboardLoadingOverlay: View {
    var body: some View {
        VStack(spacing: .spacing.lg) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: Color.theme.primary))
                .scaleEffect(1.5)

            Text("Loading Dashboard...")
                .font(.theme.body)
                .foregroundStyle(Color.theme.mutedForeground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.theme.background)
    }
}

// MARK: - Empty State

/// Empty state when no data is available
struct DashboardEmptyState: View {
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: .spacing.xl) {
            Image(systemName: "server.rack")
                .font(.system(size: 60))
                .foregroundStyle(Color.theme.mutedForeground)

            VStack(spacing: .spacing.sm) {
                Text("No Server Connection")
                    .font(.theme.title2)
                    .foregroundStyle(Color.theme.foreground)

                Text("Connect to a vLLM server to see dashboard metrics")
                    .font(.theme.body)
                    .foregroundStyle(Color.theme.mutedForeground)
                    .multilineTextAlignment(.center)
            }

            Button(action: onRetry) {
                HStack(spacing: .spacing.sm) {
                    Image(systemName: "arrow.clockwise")
                    Text("Retry Connection")
                }
                .font(.theme.body)
                .fontWeight(.medium)
                .foregroundStyle(Color.theme.background)
                .padding(.horizontal, .spacing.xl)
                .padding(.vertical, .spacing.md)
                .background(Color.theme.primary)
                .cornerRadius(.radius.lg)
            }
        }
        .padding(.spacing.xxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.theme.background)
    }
}

// MARK: - Error State

/// Error state with retry option
struct DashboardErrorState: View {
    let error: DashboardError
    let onRetry: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: .spacing.xl) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 60))
                .foregroundStyle(Color.theme.error)

            VStack(spacing: .spacing.sm) {
                Text("Something Went Wrong")
                    .font(.theme.title2)
                    .foregroundStyle(Color.theme.foreground)

                Text(error.localizedDescription)
                    .font(.theme.body)
                    .foregroundStyle(Color.theme.mutedForeground)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: .spacing.md) {
                Button(action: onDismiss) {
                    Text("Dismiss")
                        .font(.theme.body)
                        .fontWeight(.medium)
                        .foregroundStyle(Color.theme.foreground)
                        .padding(.horizontal, .spacing.xl)
                        .padding(.vertical, .spacing.md)
                        .background(Color.theme.backgroundSecondary)
                        .cornerRadius(.radius.lg)
                        .overlay(
                            RoundedRectangle(cornerRadius: .radius.lg)
                                .stroke(Color.theme.border, lineWidth: 1)
                        )
                }

                Button(action: onRetry) {
                    HStack(spacing: .spacing.sm) {
                        Image(systemName: "arrow.clockwise")
                        Text("Retry")
                    }
                    .font(.theme.body)
                    .fontWeight(.medium)
                    .foregroundStyle(Color.theme.background)
                    .padding(.horizontal, .spacing.xl)
                    .padding(.vertical, .spacing.md)
                    .background(Color.theme.primary)
                    .cornerRadius(.radius.lg)
                }
            }
        }
        .padding(.spacing.xxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.theme.background)
    }
}

// MARK: - Preview

#Preview("Dashboard") {
    DashboardView()
}

#Preview("Dashboard - Loading") {
    DashboardLoadingOverlay()
}

#Preview("Dashboard - Empty") {
    DashboardEmptyState(onRetry: {})
}

#Preview("Dashboard - Error") {
    DashboardErrorState(
        error: .refreshFailed("Network connection failed"),
        onRetry: {},
        onDismiss: {}
    )
}
