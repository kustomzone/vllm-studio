import SwiftUI

// MARK: - Recipes View

struct RecipesView: View {
    // MARK: - Properties

    @State private var viewModel = RecipesViewModel()
    @State private var showingCreateSheet = false
    @State private var showingDeleteConfirmation = false
    @State private var recipeToDelete: Recipe?
    @State private var selectedRecipe: Recipe?
    @State private var navigationPath = NavigationPath()

    // MARK: - Body

    var body: some View {
        NavigationStack(path: $navigationPath) {
            ZStack {
                // Background
                Color.theme.background
                    .ignoresSafeArea()

                // Content
                content
                    .navigationTitle("Recipes")
                    .navigationBarTitleDisplayMode(.large)
                    .searchable(
                        text: $viewModel.searchText,
                        placement: .navigationBarDrawer(displayMode: .always),
                        prompt: "Search recipes..."
                    )
                    .toolbar { toolbarContent }
                    .navigationDestination(for: Recipe.self) { recipe in
                        RecipeDetailView(
                            recipe: recipe,
                            viewModel: viewModel,
                            onDelete: { recipeToDelete = $0; showingDeleteConfirmation = true }
                        )
                    }

                // Floating Add Button
                floatingAddButton
            }
            .sheet(isPresented: $showingCreateSheet) {
                RecipeEditorSheet(
                    mode: .create,
                    viewModel: viewModel
                )
            }
            .alert("Delete Recipe", isPresented: $showingDeleteConfirmation) {
                Button("Cancel", role: .cancel) {
                    recipeToDelete = nil
                }
                Button("Delete", role: .destructive) {
                    if let recipe = recipeToDelete {
                        Task {
                            try? await viewModel.deleteRecipe(recipe)
                        }
                    }
                    recipeToDelete = nil
                }
            } message: {
                if let recipe = recipeToDelete {
                    Text("Are you sure you want to delete \"\(recipe.name)\"? This action cannot be undone.")
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
            .task {
                await viewModel.fetchRecipes()
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.recipes.isEmpty {
            loadingView
        } else if let error = viewModel.errorMessage, viewModel.recipes.isEmpty {
            errorView(error)
        } else if viewModel.filteredRecipes.isEmpty {
            emptyView
        } else {
            recipesList
        }
    }

    // MARK: - Recipes List

    private var recipesList: some View {
        List {
            // Launch progress section
            if viewModel.isLaunching {
                launchProgressSection
            }

            // Pinned section
            if !pinnedRecipes.isEmpty {
                Section {
                    ForEach(pinnedRecipes) { recipe in
                        recipeRow(for: recipe)
                    }
                } header: {
                    Label("Pinned", systemImage: "pin.fill")
                        .font(.theme.caption)
                        .foregroundStyle(Color.theme.mutedForeground)
                }
            }

            // All recipes section
            Section {
                ForEach(unpinnedRecipes) { recipe in
                    recipeRow(for: recipe)
                }
            } header: {
                if !pinnedRecipes.isEmpty {
                    Label("All Recipes", systemImage: "square.stack.3d.up")
                        .font(.theme.caption)
                        .foregroundStyle(Color.theme.mutedForeground)
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }

    // MARK: - Recipe Row

    private func recipeRow(for recipe: Recipe) -> some View {
        NavigationLink(value: recipe) {
            RecipeRow(
                recipe: recipe,
                isPinned: viewModel.isPinned(recipe)
            )
        }
        .listRowBackground(Color.theme.card)
        .listRowSeparatorTint(Color.theme.border)
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            Button {
                withAnimation {
                    viewModel.togglePin(recipe)
                }
            } label: {
                Label(
                    viewModel.isPinned(recipe) ? "Unpin" : "Pin",
                    systemImage: viewModel.isPinned(recipe) ? "pin.slash" : "pin"
                )
            }
            .tint(Color.theme.primary)
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                recipeToDelete = recipe
                showingDeleteConfirmation = true
            } label: {
                Label("Delete", systemImage: "trash")
            }

            Button {
                Task {
                    try? await viewModel.duplicateRecipe(recipe)
                }
            } label: {
                Label("Duplicate", systemImage: "doc.on.doc")
            }
            .tint(Color.theme.info)
        }
    }

    // MARK: - Launch Progress Section

    private var launchProgressSection: some View {
        Section {
            VStack(alignment: .leading, spacing: .spacing.sm) {
                HStack {
                    ProgressView()
                        .tint(Color.theme.primary)

                    Text(viewModel.launchStatusMessage ?? "Loading...")
                        .font(.theme.body)
                        .foregroundStyle(Color.theme.foreground)
                }

                ProgressView(value: viewModel.launchProgress)
                    .tint(Color.theme.primary)
                    .background(Color.theme.border)
            }
            .padding(.vertical, .spacing.xs)
        }
        .listRowBackground(Color.theme.backgroundSecondary)
    }

    // MARK: - Computed Properties

    private var pinnedRecipes: [Recipe] {
        viewModel.filteredRecipes.filter { viewModel.isPinned($0) }
    }

    private var unpinnedRecipes: [Recipe] {
        viewModel.filteredRecipes.filter { !viewModel.isPinned($0) }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: .spacing.lg) {
            ProgressView()
                .scaleEffect(1.5)
                .tint(Color.theme.primary)

            Text("Loading recipes...")
                .font(.theme.body)
                .foregroundStyle(Color.theme.mutedForeground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Error View

    private func errorView(_ error: String) -> some View {
        VStack(spacing: .spacing.lg) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundStyle(Color.theme.error)

            Text("Failed to Load Recipes")
                .font(.theme.headline)
                .foregroundStyle(Color.theme.foreground)

            Text(error)
                .font(.theme.body)
                .foregroundStyle(Color.theme.mutedForeground)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Button {
                Task {
                    await viewModel.fetchRecipes()
                }
            } label: {
                Label("Try Again", systemImage: "arrow.clockwise")
                    .font(.theme.body.weight(.semibold))
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.theme.primary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty View

    private var emptyView: some View {
        VStack(spacing: .spacing.lg) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 48))
                .foregroundStyle(Color.theme.mutedForeground)

            if viewModel.searchText.isEmpty {
                Text("No Recipes")
                    .font(.theme.headline)
                    .foregroundStyle(Color.theme.foreground)

                Text("Create a recipe to configure model launch parameters")
                    .font(.theme.body)
                    .foregroundStyle(Color.theme.mutedForeground)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                Button {
                    showingCreateSheet = true
                } label: {
                    Label("Create Recipe", systemImage: "plus")
                        .font(.theme.body.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.theme.primary)
            } else {
                Text("No Results")
                    .font(.theme.headline)
                    .foregroundStyle(Color.theme.foreground)

                Text("No recipes match \"\(viewModel.searchText)\"")
                    .font(.theme.body)
                    .foregroundStyle(Color.theme.mutedForeground)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                Button {
                    viewModel.clearSearch()
                } label: {
                    Text("Clear Search")
                        .font(.theme.body.weight(.semibold))
                }
                .buttonStyle(.bordered)
                .tint(Color.theme.primary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Floating Add Button

    private var floatingAddButton: some View {
        VStack {
            Spacer()
            HStack {
                Spacer()
                Button {
                    showingCreateSheet = true
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 56, height: 56)
                        .background(Color.theme.primary)
                        .clipShape(Circle())
                        .shadow(color: .black.opacity(0.3), radius: 8, y: 4)
                }
                .padding(.trailing, .spacing.lg)
                .padding(.bottom, .spacing.lg)
            }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            sortMenu
        }
    }

    private var sortMenu: some View {
        Menu {
            ForEach(RecipeSortOrder.allCases, id: \.self) { order in
                Button {
                    withAnimation {
                        viewModel.setSortOrder(order)
                    }
                } label: {
                    Label(order.displayName, systemImage: order.systemImage)
                }
                .disabled(viewModel.sortOrder == order)
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down")
                .font(.theme.body)
                .foregroundStyle(Color.theme.foreground)
        }
    }
}

// MARK: - Preview

#Preview("Default") {
    RecipesView()
}

#Preview("Loading") {
    let view = RecipesView()
    return view
}
