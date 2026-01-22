import Foundation
import SwiftUI

// MARK: - Recipes View Model

@Observable
final class RecipesViewModel {
    // MARK: - Properties

    /// All recipes from the server
    var recipes: [Recipe] = []

    /// IDs of pinned recipes (persisted in UserDefaults)
    var pinnedRecipeIds: Set<String> = []

    /// Current search text
    var searchText: String = ""

    /// Current sort order
    var sortOrder: RecipeSortOrder = .nameAsc

    /// Loading state
    var isLoading: Bool = false

    /// Error message if any
    var errorMessage: String?

    /// Currently running recipe ID
    var runningRecipeId: String?

    /// Launch progress (0.0 - 1.0)
    var launchProgress: Double = 0

    /// Launch status message
    var launchStatusMessage: String?

    /// Whether the model is currently launching
    var isLaunching: Bool = false

    // MARK: - Private Properties

    private let pinnedRecipeIdsKey = "pinnedRecipeIds"

    // MARK: - Initialization

    init() {
        loadPinnedRecipeIds()
    }

    // MARK: - Computed Properties

    /// Filtered and sorted recipes based on search text and sort order
    var filteredRecipes: [Recipe] {
        var result = recipes

        // Apply search filter
        if !searchText.isEmpty {
            let searchLower = searchText.lowercased()
            result = result.filter { recipe in
                recipe.name.lowercased().contains(searchLower) ||
                recipe.modelPath.lowercased().contains(searchLower) ||
                recipe.modelDisplayName.lowercased().contains(searchLower)
            }
        }

        // Apply sorting
        result = result.sorted { lhs, rhs in
            // Pinned items always come first
            let lhsPinned = pinnedRecipeIds.contains(lhs.id)
            let rhsPinned = pinnedRecipeIds.contains(rhs.id)

            if lhsPinned != rhsPinned {
                return lhsPinned
            }

            // Then apply selected sort order
            switch sortOrder {
            case .nameAsc:
                return lhs.name.localizedCompare(rhs.name) == .orderedAscending
            case .nameDesc:
                return lhs.name.localizedCompare(rhs.name) == .orderedDescending
            case .recentlyUsed:
                // TODO: Track last used time
                return lhs.name.localizedCompare(rhs.name) == .orderedAscending
            case .modelPath:
                return lhs.modelPath.localizedCompare(rhs.modelPath) == .orderedAscending
            }
        }

        return result
    }

    /// Number of pinned recipes
    var pinnedCount: Int {
        pinnedRecipeIds.count
    }

    /// Number of running recipes
    var runningCount: Int {
        recipes.filter { $0.status == .running }.count
    }

    /// Check if a recipe is pinned
    func isPinned(_ recipe: Recipe) -> Bool {
        pinnedRecipeIds.contains(recipe.id)
    }

    /// Get the currently running recipe
    var currentlyRunningRecipe: Recipe? {
        recipes.first { $0.status == .running }
    }

    // MARK: - CRUD Operations

    /// Fetch all recipes from the server
    @MainActor
    func fetchRecipes() async {
        isLoading = true
        errorMessage = nil

        do {
            // TODO: Replace with actual API call
            // let fetchedRecipes = try await apiClient.request(.recipes)
            // For now, use sample data
            try await Task.sleep(nanoseconds: 500_000_000) // Simulate network delay
            recipes = Recipe.samples
        } catch {
            errorMessage = "Failed to fetch recipes: \(error.localizedDescription)"
        }

        isLoading = false
    }

    /// Create a new recipe
    @MainActor
    func createRecipe(_ recipe: Recipe) async throws {
        // TODO: Replace with actual API call
        // let createdRecipe = try await apiClient.request(.createRecipe, body: recipe)
        try await Task.sleep(nanoseconds: 300_000_000) // Simulate network delay
        recipes.append(recipe)
    }

    /// Update an existing recipe
    @MainActor
    func updateRecipe(_ recipe: Recipe) async throws {
        // TODO: Replace with actual API call
        // let updatedRecipe = try await apiClient.request(.updateRecipe(id: recipe.id), body: recipe)
        try await Task.sleep(nanoseconds: 300_000_000) // Simulate network delay
        if let index = recipes.firstIndex(where: { $0.id == recipe.id }) {
            recipes[index] = recipe
        }
    }

    /// Delete a recipe
    @MainActor
    func deleteRecipe(_ recipe: Recipe) async throws {
        // TODO: Replace with actual API call
        // try await apiClient.request(.deleteRecipe(id: recipe.id))
        try await Task.sleep(nanoseconds: 300_000_000) // Simulate network delay
        recipes.removeAll { $0.id == recipe.id }
        pinnedRecipeIds.remove(recipe.id)
        savePinnedRecipeIds()
    }

    /// Delete recipe by ID
    @MainActor
    func deleteRecipe(id: String) async throws {
        if let recipe = recipes.first(where: { $0.id == id }) {
            try await deleteRecipe(recipe)
        }
    }

    // MARK: - Pin Operations

    /// Toggle pin status for a recipe
    func togglePin(_ recipe: Recipe) {
        if pinnedRecipeIds.contains(recipe.id) {
            pinnedRecipeIds.remove(recipe.id)
        } else {
            pinnedRecipeIds.insert(recipe.id)
        }
        savePinnedRecipeIds()
    }

    /// Pin a recipe
    func pin(_ recipe: Recipe) {
        pinnedRecipeIds.insert(recipe.id)
        savePinnedRecipeIds()
    }

    /// Unpin a recipe
    func unpin(_ recipe: Recipe) {
        pinnedRecipeIds.remove(recipe.id)
        savePinnedRecipeIds()
    }

    // MARK: - Launch Operations

    /// Launch a recipe (start the model server)
    @MainActor
    func launch(_ recipe: Recipe) async throws {
        isLaunching = true
        launchProgress = 0
        launchStatusMessage = "Starting \(recipe.name)..."
        errorMessage = nil

        do {
            // Simulate launch progress
            // TODO: Replace with actual WebSocket progress updates
            for progress in stride(from: 0.0, through: 1.0, by: 0.1) {
                try await Task.sleep(nanoseconds: 200_000_000)
                launchProgress = progress
                launchStatusMessage = progress < 0.5 ? "Loading model weights..." : "Initializing inference engine..."
            }

            // Update recipe status
            if let index = recipes.firstIndex(where: { $0.id == recipe.id }) {
                recipes[index].status = .running
            }
            runningRecipeId = recipe.id
            launchStatusMessage = "Model ready!"

            // Brief delay to show success message
            try await Task.sleep(nanoseconds: 500_000_000)
        } catch {
            errorMessage = "Failed to launch recipe: \(error.localizedDescription)"
            throw error
        }

        isLaunching = false
        launchStatusMessage = nil
    }

    /// Stop the currently running model
    @MainActor
    func stop() async throws {
        guard let runningId = runningRecipeId else { return }

        isLaunching = true
        launchStatusMessage = "Stopping model..."

        do {
            // TODO: Replace with actual API call
            // try await apiClient.request(.evict)
            try await Task.sleep(nanoseconds: 500_000_000) // Simulate stop delay

            // Update recipe status
            if let index = recipes.firstIndex(where: { $0.id == runningId }) {
                recipes[index].status = .stopped
            }
            runningRecipeId = nil
        } catch {
            errorMessage = "Failed to stop model: \(error.localizedDescription)"
            throw error
        }

        isLaunching = false
        launchStatusMessage = nil
    }

    /// Stop a specific recipe
    @MainActor
    func stop(_ recipe: Recipe) async throws {
        if recipe.status == .running {
            try await stop()
        }
    }

    // MARK: - Persistence

    private func loadPinnedRecipeIds() {
        if let savedIds = UserDefaults.standard.array(forKey: pinnedRecipeIdsKey) as? [String] {
            pinnedRecipeIds = Set(savedIds)
        }
    }

    private func savePinnedRecipeIds() {
        UserDefaults.standard.set(Array(pinnedRecipeIds), forKey: pinnedRecipeIdsKey)
    }

    // MARK: - Search & Filter

    /// Clear search text
    func clearSearch() {
        searchText = ""
    }

    /// Set sort order
    func setSortOrder(_ order: RecipeSortOrder) {
        sortOrder = order
    }

    // MARK: - Refresh

    /// Pull to refresh
    @MainActor
    func refresh() async {
        await fetchRecipes()
    }

    // MARK: - Helpers

    /// Get recipe by ID
    func recipe(withId id: String) -> Recipe? {
        recipes.first { $0.id == id }
    }

    /// Check if a recipe can be launched
    func canLaunch(_ recipe: Recipe) -> Bool {
        !isLaunching && recipe.status != .running && runningRecipeId == nil
    }

    /// Check if a recipe can be stopped
    func canStop(_ recipe: Recipe) -> Bool {
        !isLaunching && recipe.status == .running
    }

    /// Duplicate a recipe
    @MainActor
    func duplicateRecipe(_ recipe: Recipe) async throws {
        var newRecipe = recipe
        newRecipe.id = UUID().uuidString
        newRecipe.name = "\(recipe.name) (Copy)"
        newRecipe.status = .stopped
        try await createRecipe(newRecipe)
    }
}

// MARK: - Preview Support

extension RecipesViewModel {
    static var preview: RecipesViewModel {
        let viewModel = RecipesViewModel()
        viewModel.recipes = Recipe.samples
        viewModel.pinnedRecipeIds = Set(["llama-3-70b"])
        return viewModel
    }

    static var previewLoading: RecipesViewModel {
        let viewModel = RecipesViewModel()
        viewModel.isLoading = true
        return viewModel
    }

    static var previewLaunching: RecipesViewModel {
        let viewModel = RecipesViewModel()
        viewModel.recipes = Recipe.samples
        viewModel.isLaunching = true
        viewModel.launchProgress = 0.6
        viewModel.launchStatusMessage = "Loading model weights..."
        return viewModel
    }

    static var previewError: RecipesViewModel {
        let viewModel = RecipesViewModel()
        viewModel.recipes = Recipe.samples
        viewModel.errorMessage = "Failed to connect to server"
        return viewModel
    }
}
