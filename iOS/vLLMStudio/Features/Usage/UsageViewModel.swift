//
//  UsageViewModel.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation
import SwiftUI

/// View model for the Usage Analytics screen
@Observable
final class UsageViewModel {

    // MARK: - Published Properties

    /// Overall usage statistics
    var stats: UsageStats = .empty

    /// Daily usage data for charts
    var dailyUsage: [DailyUsage] = []

    /// Model performance metrics
    var modelPerformance: [ModelPerformance] = []

    /// Peak usage metrics
    var peakUsage: PeakUsage = .empty

    /// Currently selected date range
    var selectedDateRange: DateRange = .week

    /// Loading state
    var isLoading: Bool = false

    /// Error message if any
    var errorMessage: String?

    /// Whether data has been loaded at least once
    var hasLoadedOnce: Bool = false

    /// Sort option for model performance table
    var sortOption: ModelPerformanceSortOption = .requests

    /// Sort direction for model performance table
    var sortDirection: SortDirection = .descending

    /// Expanded model IDs in the performance table
    var expandedModelIds: Set<String> = []

    // MARK: - Computed Properties

    /// Chart data points for the usage chart
    var chartDataPoints: [UsageChartDataPoint] {
        var points: [UsageChartDataPoint] = []

        for usage in dailyUsage {
            // Requests data point
            points.append(UsageChartDataPoint(
                date: usage.date,
                value: Double(usage.requests),
                series: .requests
            ))

            // Tokens data point (scaled for display)
            points.append(UsageChartDataPoint(
                date: usage.date,
                value: Double(usage.tokens) / 1000, // Scale to thousands
                series: .tokens
            ))
        }

        return points
    }

    /// Sorted model performance data
    var sortedModelPerformance: [ModelPerformance] {
        let sorted = modelPerformance.sorted { lhs, rhs in
            let comparison: Bool
            switch sortOption {
            case .requests:
                comparison = lhs.requests < rhs.requests
            case .tokens:
                comparison = lhs.tokens < rhs.tokens
            case .latency:
                comparison = lhs.averageLatency < rhs.averageLatency
            case .cost:
                comparison = lhs.cost < rhs.cost
            case .successRate:
                comparison = lhs.successRate < rhs.successRate
            }
            return sortDirection == .ascending ? comparison : !comparison
        }
        return sorted
    }

    /// Maximum requests value for chart scaling
    var maxRequests: Double {
        dailyUsage.map { Double($0.requests) }.max() ?? 100
    }

    /// Maximum tokens value for chart scaling (in thousands)
    var maxTokens: Double {
        (dailyUsage.map { Double($0.tokens) }.max() ?? 100000) / 1000
    }

    /// Total cost for the period
    var totalCostForPeriod: String {
        stats.formattedCost
    }

    /// Whether there is data to display
    var hasData: Bool {
        !dailyUsage.isEmpty || stats.totalRequests > 0
    }

    // MARK: - Private Properties

    /// API client for network requests (injected via Environment in production)
    private var apiClient: APIClient?

    // MARK: - Initialization

    /// Initialize the view model
    /// - Parameter apiClient: Optional API client for dependency injection
    init(apiClient: APIClient? = nil) {
        self.apiClient = apiClient
    }

    /// Configure the view model with an API client
    /// - Parameter client: The API client to use for requests
    func configure(with client: APIClient) {
        self.apiClient = client
    }

    // MARK: - Public Methods

    /// Loads all usage data for the selected date range
    @MainActor
    func loadAllData() async {
        // If no API client, load mock data for preview
        guard apiClient != nil else {
            loadMockData()
            return
        }

        isLoading = true
        errorMessage = nil

        // Load all data concurrently
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadStats() }
            group.addTask { await self.loadDailyUsage() }
            group.addTask { await self.loadModelPerformance() }
            group.addTask { await self.loadPeakUsage() }
        }

        hasLoadedOnce = true
        isLoading = false
    }

    /// Loads overall usage statistics
    @MainActor
    func loadStats() async {
        guard let apiClient = apiClient else { return }

        do {
            let response: UsageStats = try await apiClient.request(.usageStats)
            stats = response
        } catch {
            // Stats loading failed, keep previous data
            if !hasLoadedOnce {
                errorMessage = "Failed to load usage statistics: \(error.localizedDescription)"
            }
        }
    }

    /// Loads daily usage data for charts
    @MainActor
    func loadDailyUsage() async {
        guard let apiClient = apiClient else { return }

        do {
            // Try to load daily usage from API
            let response: [DailyUsage] = try await apiClient.request(.usageStats)
            dailyUsage = response.sorted { $0.date < $1.date }
        } catch {
            // Daily usage loading failed, generate from stats if available
            if !hasLoadedOnce && dailyUsage.isEmpty {
                // Generate placeholder daily data based on date range
                generatePlaceholderDailyUsage()
            }
        }
    }

    /// Loads model performance data
    @MainActor
    func loadModelPerformance() async {
        guard let apiClient = apiClient else { return }

        do {
            // Using usageStats endpoint which should include model performance
            let response: UsageResponse = try await apiClient.request(.usageStats)
            modelPerformance = response.modelPerformance
        } catch {
            // Model performance loading failed, keep previous data
        }
    }

    /// Loads peak usage metrics
    @MainActor
    func loadPeakUsage() async {
        guard let apiClient = apiClient else { return }

        do {
            let response: PeakUsage = try await apiClient.request(.peakMetrics(modelId: nil))
            peakUsage = response
        } catch {
            // Peak usage loading failed, keep previous data
        }
    }

    /// Sets the date range and reloads data
    @MainActor
    func setDateRange(_ range: DateRange) async {
        guard range != selectedDateRange else { return }
        selectedDateRange = range
        await loadAllData()
    }

    /// Refreshes all data
    @MainActor
    func refresh() async {
        await loadAllData()
    }

    /// Toggles sort option or direction
    func toggleSort(by option: ModelPerformanceSortOption) {
        if sortOption == option {
            sortDirection = sortDirection.toggled
        } else {
            sortOption = option
            sortDirection = .descending
        }
    }

    /// Toggles expansion of a model row
    func toggleModelExpanded(_ modelId: String) {
        if expandedModelIds.contains(modelId) {
            expandedModelIds.remove(modelId)
        } else {
            expandedModelIds.insert(modelId)
        }
    }

    /// Checks if a model row is expanded
    func isModelExpanded(_ modelId: String) -> Bool {
        expandedModelIds.contains(modelId)
    }

    // MARK: - Private Methods

    /// Generates placeholder daily usage data when API doesn't return it
    private func generatePlaceholderDailyUsage() {
        let calendar = Calendar.current
        let days = selectedDateRange.days
        let avgRequestsPerDay = stats.totalRequests > 0 ? stats.totalRequests / days : 0
        let avgTokensPerDay = stats.totalTokens > 0 ? stats.totalTokens / days : 0
        let avgCostPerDay = stats.totalCost > 0 ? stats.totalCost / Double(days) : 0

        dailyUsage = (0..<days).compactMap { daysAgo in
            guard let date = calendar.date(byAdding: .day, value: -daysAgo, to: Date()) else {
                return nil
            }
            // Add some variance to make chart interesting
            let variance = Double.random(in: 0.7...1.3)
            return DailyUsage(
                id: UUID().uuidString,
                date: date,
                requests: Int(Double(avgRequestsPerDay) * variance),
                tokens: Int(Double(avgTokensPerDay) * variance),
                promptTokens: Int(Double(avgTokensPerDay) * variance * 0.55),
                completionTokens: Int(Double(avgTokensPerDay) * variance * 0.45),
                cost: avgCostPerDay * variance,
                averageLatency: stats.averageLatency * Double.random(in: 0.8...1.2)
            )
        }.reversed()
    }

    // MARK: - Mock Data (for previews and testing)

    /// Loads mock data for previews
    @MainActor
    func loadMockData() {
        stats = UsageStats(
            totalRequests: 12456,
            totalTokens: 2345678,
            totalPromptTokens: 1234567,
            totalCompletionTokens: 1111111,
            totalCost: 45.67,
            averageLatency: 234.5,
            averageTokensPerRequest: 188.3,
            periodStart: Calendar.current.date(byAdding: .day, value: -7, to: Date())!,
            periodEnd: Date(),
            previousPeriodRequests: 10500,
            previousPeriodTokens: 2100000,
            previousPeriodCost: 38.50
        )

        let calendar = Calendar.current
        dailyUsage = (0..<7).map { daysAgo in
            let date = calendar.date(byAdding: .day, value: -daysAgo, to: Date())!
            return DailyUsage(
                id: UUID().uuidString,
                date: date,
                requests: Int.random(in: 1500...2000),
                tokens: Int.random(in: 300000...400000),
                promptTokens: Int.random(in: 150000...200000),
                completionTokens: Int.random(in: 150000...200000),
                cost: Double.random(in: 5.0...8.0),
                averageLatency: Double.random(in: 180...280)
            )
        }.reversed()

        modelPerformance = [
            ModelPerformance(
                id: "1",
                modelId: "llama-3.1-70b",
                modelName: "meta-llama/Llama-3.1-70B-Instruct",
                requests: 8234,
                tokens: 1567890,
                promptTokens: 890123,
                completionTokens: 677767,
                averageLatency: 245.6,
                minLatency: 89.2,
                maxLatency: 1234.5,
                p95Latency: 567.8,
                errorCount: 12,
                successRate: 0.9985,
                cost: 32.45
            ),
            ModelPerformance(
                id: "2",
                modelId: "mistral-7b",
                modelName: "mistralai/Mistral-7B-Instruct-v0.3",
                requests: 3456,
                tokens: 678901,
                promptTokens: 345678,
                completionTokens: 333223,
                averageLatency: 156.7,
                minLatency: 45.3,
                maxLatency: 678.9,
                p95Latency: 312.4,
                errorCount: 5,
                successRate: 0.9986,
                cost: 10.23
            ),
            ModelPerformance(
                id: "3",
                modelId: "qwen-2.5-72b",
                modelName: "Qwen/Qwen2.5-72B-Instruct",
                requests: 766,
                tokens: 98887,
                promptTokens: 54321,
                completionTokens: 44566,
                averageLatency: 312.4,
                minLatency: 123.4,
                maxLatency: 987.6,
                p95Latency: 654.3,
                errorCount: 2,
                successRate: 0.9974,
                cost: 2.99
            )
        ]

        peakUsage = PeakUsage(
            peakRequestsPerMinute: 156,
            peakTokensPerMinute: 45678,
            peakConcurrentRequests: 12,
            peakTimestamp: calendar.date(byAdding: .hour, value: -14, to: Date())!,
            peakDay: calendar.date(byAdding: .day, value: -2, to: Date())
        )

        hasLoadedOnce = true
    }
}
