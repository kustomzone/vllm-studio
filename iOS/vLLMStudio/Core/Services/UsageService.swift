//
//  UsageService.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation

/// Service for fetching usage statistics and analytics data.
@Observable
final class UsageService {

    // MARK: - Singleton

    static let shared = UsageService()

    // MARK: - Properties

    /// Overall usage statistics
    var stats: UsageStats?

    /// Daily usage data for charts
    var dailyUsage: [DailyUsage] = []

    /// Per-model usage breakdown
    var modelUsage: [ModelUsageEntry] = []

    /// Peak metrics
    var peakMetrics: PeakMetrics?

    /// Whether data is loading
    var isLoading: Bool = false

    /// Error message
    var errorMessage: String?

    /// Selected time range
    var selectedTimeRange: TimeRange = .week

    // MARK: - Initialization

    private init() {}

    // MARK: - Data Fetching

    /// Fetches all usage data
    @MainActor
    func fetchAllData() async throws {
        isLoading = true
        defer { isLoading = false }

        do {
            async let statsTask: UsageStats = APIClient.shared.request(.usageStats)
            async let peakTask: PeakMetrics = APIClient.shared.request(.peakMetrics)

            let (fetchedStats, fetchedPeak) = try await (statsTask, peakTask)

            stats = fetchedStats
            peakMetrics = fetchedPeak
            dailyUsage = fetchedStats.dailyUsage ?? []
            modelUsage = fetchedStats.modelBreakdown ?? []
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    /// Fetches usage for a specific date range
    /// - Parameters:
    ///   - from: Start date
    ///   - to: End date
    @MainActor
    func fetchUsage(from: Date, to: Date) async throws {
        isLoading = true
        defer { isLoading = false }

        do {
            let response: UsageRangeResponse = try await APIClient.shared.request(
                .usageByDateRange(from: from, to: to)
            )
            dailyUsage = response.dailyUsage
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    /// Updates the selected time range and fetches data
    /// - Parameter range: The new time range
    @MainActor
    func setTimeRange(_ range: TimeRange) async throws {
        selectedTimeRange = range
        let (from, to) = range.dateRange
        try await fetchUsage(from: from, to: to)
    }

    // MARK: - Computed Metrics

    /// Total requests in the current period
    var totalRequests: Int {
        stats?.totalRequests ?? dailyUsage.reduce(0) { $0 + $1.requestCount }
    }

    /// Total tokens in the current period
    var totalTokens: Int {
        stats?.totalTokens ?? dailyUsage.reduce(0) { $0 + $1.totalTokens }
    }

    /// Total prompt tokens
    var totalPromptTokens: Int {
        stats?.promptTokens ?? dailyUsage.reduce(0) { $0 + $1.promptTokens }
    }

    /// Total completion tokens
    var totalCompletionTokens: Int {
        stats?.completionTokens ?? dailyUsage.reduce(0) { $0 + $1.completionTokens }
    }

    /// Average tokens per request
    var avgTokensPerRequest: Double {
        guard totalRequests > 0 else { return 0 }
        return Double(totalTokens) / Double(totalRequests)
    }

    /// Estimated cost (if available)
    var estimatedCost: Double? {
        stats?.estimatedCost
    }
}

// MARK: - Time Range

enum TimeRange: String, CaseIterable, Identifiable {
    case today = "Today"
    case week = "7 Days"
    case month = "30 Days"
    case quarter = "90 Days"
    case year = "Year"
    case all = "All Time"

    var id: String { rawValue }

    var dateRange: (from: Date, to: Date) {
        let now = Date()
        let calendar = Calendar.current

        switch self {
        case .today:
            let start = calendar.startOfDay(for: now)
            return (start, now)
        case .week:
            let start = calendar.date(byAdding: .day, value: -7, to: now) ?? now
            return (start, now)
        case .month:
            let start = calendar.date(byAdding: .day, value: -30, to: now) ?? now
            return (start, now)
        case .quarter:
            let start = calendar.date(byAdding: .day, value: -90, to: now) ?? now
            return (start, now)
        case .year:
            let start = calendar.date(byAdding: .year, value: -1, to: now) ?? now
            return (start, now)
        case .all:
            let start = calendar.date(byAdding: .year, value: -10, to: now) ?? now
            return (start, now)
        }
    }
}

// MARK: - Response Types

struct UsageStats: Decodable {
    let totalRequests: Int
    let totalTokens: Int
    let promptTokens: Int
    let completionTokens: Int
    let estimatedCost: Double?
    let dailyUsage: [DailyUsage]?
    let modelBreakdown: [ModelUsageEntry]?
}

struct UsageRangeResponse: Decodable {
    let dailyUsage: [DailyUsage]
}

struct DailyUsage: Identifiable, Decodable {
    let date: Date
    let requestCount: Int
    let promptTokens: Int
    let completionTokens: Int
    let totalTokens: Int
    let uniqueModels: Int?
    let avgLatency: Double?
    let errorCount: Int?

    var id: Date { date }

    var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    var shortDate: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }
}

struct ModelUsageEntry: Identifiable, Decodable {
    let modelId: String
    let modelName: String?
    let requestCount: Int
    let tokenCount: Int
    let avgLatency: Double?
    let percentage: Double?

    var id: String { modelId }

    var displayName: String {
        modelName ?? modelId
    }
}

struct PeakMetrics: Decodable {
    let peakRequestsPerMinute: Int?
    let peakTokensPerMinute: Int?
    let peakConcurrentRequests: Int?
    let peakGpuUtilization: Double?
    let peakMemoryUsage: Double?
    let recordedAt: Date?
}
