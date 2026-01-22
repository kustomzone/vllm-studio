import Foundation
import SwiftUI

// MARK: - Discover View Model

@Observable
final class DiscoverViewModel {
    // MARK: - Properties

    /// All available models
    private(set) var models: [DiscoverModel] = []

    /// Search text for filtering
    var searchText: String = ""

    /// Selected task type filter
    var selectedTaskType: TaskType?

    /// Selected provider filter
    var selectedProvider: Provider?

    /// Selected model size filter
    var selectedSize: ModelSize?

    /// Current sort order
    var sortOrder: SortOrder = .popularity

    /// Loading state
    private(set) var isLoading: Bool = false

    /// Error message if any
    private(set) var errorMessage: String?

    /// Whether an error alert should be shown
    var showError: Bool = false

    // MARK: - Computed Properties

    /// Filtered and sorted models based on current filters
    var filteredModels: [DiscoverModel] {
        var result = models

        // Apply search filter
        if !searchText.isEmpty {
            let searchLower = searchText.lowercased()
            result = result.filter { model in
                model.name.lowercased().contains(searchLower) ||
                model.description.lowercased().contains(searchLower) ||
                model.provider.displayName.lowercased().contains(searchLower)
            }
        }

        // Apply task type filter
        if let taskType = selectedTaskType {
            result = result.filter { $0.taskTypes.contains(taskType) }
        }

        // Apply provider filter
        if let provider = selectedProvider {
            result = result.filter { $0.provider == provider }
        }

        // Apply size filter
        if let size = selectedSize {
            result = result.filter { $0.size == size }
        }

        // Apply sorting
        switch sortOrder {
        case .popularity:
            result.sort { $0.likes > $1.likes }
        case .downloads:
            result.sort { $0.downloads > $1.downloads }
        case .newest:
            result.sort { $0.updatedAt > $1.updatedAt }
        case .name:
            result.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        case .size:
            result.sort { sizeOrder($0.size) < sizeOrder($1.size) }
        }

        return result
    }

    /// Whether any filters are active
    var hasActiveFilters: Bool {
        !searchText.isEmpty || selectedTaskType != nil || selectedProvider != nil || selectedSize != nil
    }

    /// Number of active filters
    var activeFilterCount: Int {
        var count = 0
        if selectedTaskType != nil { count += 1 }
        if selectedProvider != nil { count += 1 }
        if selectedSize != nil { count += 1 }
        return count
    }

    /// Empty state message
    var emptyStateMessage: String {
        if hasActiveFilters {
            return "No models match your filters. Try adjusting your search criteria."
        }
        return "No models available. Pull to refresh."
    }

    // MARK: - Initialization

    init() {
        // Load sample data initially
        loadSampleData()
    }

    // MARK: - Public Methods

    /// Load models from API
    func loadModels() async {
        guard !isLoading else { return }

        isLoading = true
        errorMessage = nil

        do {
            // Simulate API call
            try await Task.sleep(nanoseconds: 1_000_000_000)

            // In real implementation, this would call the API
            // let response: [DiscoverModel] = try await apiClient.request(.discoverModels)

            await MainActor.run {
                // For now, use sample data
                self.models = DiscoverModel.sampleModels
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.errorMessage = error.localizedDescription
                self.showError = true
                self.isLoading = false
            }
        }
    }

    /// Search models with the current search text
    func search() {
        // The filtering is done via computed property
        // This method can be used for analytics or debouncing
    }

    /// Clear all filters
    func clearFilters() {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            searchText = ""
            selectedTaskType = nil
            selectedProvider = nil
            selectedSize = nil
        }
    }

    /// Set sort order
    func setSortOrder(_ order: SortOrder) {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            sortOrder = order
        }
    }

    /// Add model to recipes
    func addToRecipes(_ model: DiscoverModel) async {
        // In real implementation, this would call the API to create a recipe
        // try await apiClient.request(.createRecipe(from: model))

        // For now, just simulate success
        do {
            try await Task.sleep(nanoseconds: 500_000_000)
            // Show success notification
        } catch {
            await MainActor.run {
                self.errorMessage = "Failed to add model to recipes"
                self.showError = true
            }
        }
    }

    /// Refresh models
    func refresh() async {
        await loadModels()
    }

    // MARK: - Private Methods

    private func loadSampleData() {
        models = DiscoverModel.sampleModels
    }

    private func sizeOrder(_ size: ModelSize) -> Int {
        switch size {
        case .tiny: return 0
        case .small: return 1
        case .medium: return 2
        case .large: return 3
        case .xlarge: return 4
        }
    }
}

// MARK: - Provider Extension for Grouping

extension DiscoverViewModel {
    /// Group models by provider
    var modelsByProvider: [Provider: [DiscoverModel]] {
        Dictionary(grouping: filteredModels, by: { $0.provider })
    }

    /// Group models by task type
    var modelsByTaskType: [TaskType: [DiscoverModel]] {
        var result: [TaskType: [DiscoverModel]] = [:]
        for model in filteredModels {
            for taskType in model.taskTypes {
                result[taskType, default: []].append(model)
            }
        }
        return result
    }

    /// Get popular models (top 5 by downloads)
    var popularModels: [DiscoverModel] {
        Array(models.sorted { $0.downloads > $1.downloads }.prefix(5))
    }

    /// Get recently updated models (top 5)
    var recentlyUpdatedModels: [DiscoverModel] {
        Array(models.sorted { $0.updatedAt > $1.updatedAt }.prefix(5))
    }
}

// MARK: - Filter Statistics

extension DiscoverViewModel {
    /// Statistics for current filter results
    struct FilterStatistics {
        let totalCount: Int
        let taskTypeCounts: [TaskType: Int]
        let providerCounts: [Provider: Int]
        let sizeCounts: [ModelSize: Int]
    }

    /// Get statistics for the filtered results
    var filterStatistics: FilterStatistics {
        var taskTypeCounts: [TaskType: Int] = [:]
        var providerCounts: [Provider: Int] = [:]
        var sizeCounts: [ModelSize: Int] = [:]

        for model in filteredModels {
            for taskType in model.taskTypes {
                taskTypeCounts[taskType, default: 0] += 1
            }
            providerCounts[model.provider, default: 0] += 1
            sizeCounts[model.size, default: 0] += 1
        }

        return FilterStatistics(
            totalCount: filteredModels.count,
            taskTypeCounts: taskTypeCounts,
            providerCounts: providerCounts,
            sizeCounts: sizeCounts
        )
    }
}
