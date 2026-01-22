//
//  UsageView.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import SwiftUI

/// Main usage analytics screen displaying metrics, charts, and model performance data
struct UsageView: View {

    // MARK: - State

    @State private var viewModel = UsageViewModel()

    // MARK: - Body

    var body: some View {
        NavigationStack {
            content
                .background(Color.theme.background)
                .navigationTitle("Usage Analytics")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        ToolbarRefreshButton(isRefreshing: viewModel.isLoading) {
                            Task {
                                await viewModel.refresh()
                            }
                        }
                    }
                }
        }
        .task {
            await viewModel.loadAllData()
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && !viewModel.hasLoadedOnce {
            LoadingView(message: "Loading usage data...")
        } else if let error = viewModel.errorMessage, !viewModel.hasLoadedOnce {
            ErrorView(
                title: "Failed to Load Usage Data",
                message: error,
                retryAction: {
                    Task {
                        await viewModel.loadAllData()
                    }
                }
            )
        } else {
            ScrollView {
                VStack(spacing: .spacing.xl) {
                    // Date Range Selector
                    dateRangeSelector
                        .padding(.horizontal, .spacing.lg)

                    // Metrics Overview Cards
                    MetricsOverview(
                        stats: viewModel.stats,
                        peakUsage: viewModel.peakUsage
                    )
                    .padding(.horizontal, .spacing.lg)

                    // Usage Chart
                    if !viewModel.dailyUsage.isEmpty {
                        UsageChart(
                            dailyUsage: viewModel.dailyUsage,
                            selectedDateRange: viewModel.selectedDateRange
                        )
                        .padding(.horizontal, .spacing.lg)
                    }

                    // Model Performance Table
                    if !viewModel.modelPerformance.isEmpty {
                        ModelPerformanceTable(
                            models: viewModel.sortedModelPerformance,
                            sortOption: viewModel.sortOption,
                            sortDirection: viewModel.sortDirection,
                            expandedModelIds: viewModel.expandedModelIds,
                            onSort: { option in
                                viewModel.toggleSort(by: option)
                            },
                            onToggleExpand: { modelId in
                                viewModel.toggleModelExpanded(modelId)
                            }
                        )
                        .padding(.horizontal, .spacing.lg)
                    }

                    // Empty state if no data
                    if !viewModel.hasData && viewModel.hasLoadedOnce {
                        emptyState
                            .padding(.horizontal, .spacing.lg)
                    }

                    Spacer(minLength: .spacing.xxl)
                }
                .padding(.top, .spacing.lg)
            }
            .refreshable {
                await viewModel.refresh()
            }
        }
    }

    // MARK: - Date Range Selector

    private var dateRangeSelector: some View {
        VStack(alignment: .leading, spacing: .spacing.sm) {
            Text("Time Period")
                .font(.theme.caption)
                .foregroundColor(Color.theme.mutedForeground)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: .spacing.sm) {
                    ForEach(DateRange.allCases) { range in
                        dateRangeButton(range)
                    }
                }
            }
        }
    }

    private func dateRangeButton(_ range: DateRange) -> some View {
        Button {
            Task {
                await viewModel.setDateRange(range)
            }
        } label: {
            Text(range.rawValue)
                .font(.theme.caption)
                .fontWeight(viewModel.selectedDateRange == range ? .semibold : .regular)
                .foregroundColor(
                    viewModel.selectedDateRange == range
                    ? Color.theme.foreground
                    : Color.theme.mutedForeground
                )
                .padding(.horizontal, .spacing.md)
                .padding(.vertical, .spacing.sm)
                .background(
                    viewModel.selectedDateRange == range
                    ? Color.theme.primary.opacity(0.2)
                    : Color.theme.backgroundSecondary
                )
                .cornerRadius(.radius.md)
                .overlay(
                    RoundedRectangle(cornerRadius: .radius.md)
                        .stroke(
                            viewModel.selectedDateRange == range
                            ? Color.theme.primary
                            : Color.clear,
                            lineWidth: 1
                        )
                )
        }
        .disabled(viewModel.isLoading)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: .spacing.lg) {
            Image(systemName: "chart.bar.xaxis")
                .font(.system(size: 48))
                .foregroundColor(Color.theme.mutedForeground)

            VStack(spacing: .spacing.sm) {
                Text("No Usage Data")
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)

                Text("Usage data will appear here once you start making API requests.")
                    .font(.theme.body)
                    .foregroundColor(Color.theme.mutedForeground)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, .spacing.xxl)
        .padding(.horizontal, .spacing.lg)
        .background(Color.theme.card)
        .cornerRadius(.radius.lg)
    }
}

// MARK: - Preview

#Preview {
    UsageView()
        .preferredColorScheme(.dark)
}

#Preview("With Mock Data") {
    let viewModel = UsageViewModel()
    viewModel.loadMockData()

    return NavigationStack {
        ScrollView {
            VStack(spacing: .spacing.xl) {
                // Metrics Overview
                MetricsOverview(
                    stats: viewModel.stats,
                    peakUsage: viewModel.peakUsage
                )
                .padding(.horizontal, .spacing.lg)

                // Usage Chart
                UsageChart(
                    dailyUsage: viewModel.dailyUsage,
                    selectedDateRange: viewModel.selectedDateRange
                )
                .padding(.horizontal, .spacing.lg)

                // Model Performance Table
                ModelPerformanceTable(
                    models: viewModel.sortedModelPerformance,
                    sortOption: viewModel.sortOption,
                    sortDirection: viewModel.sortDirection,
                    expandedModelIds: viewModel.expandedModelIds,
                    onSort: { _ in },
                    onToggleExpand: { _ in }
                )
                .padding(.horizontal, .spacing.lg)
            }
            .padding(.vertical, .spacing.lg)
        }
        .background(Color.theme.background)
        .navigationTitle("Usage Analytics")
    }
    .preferredColorScheme(.dark)
}
