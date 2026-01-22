import SwiftUI

// MARK: - Discover View

struct DiscoverView: View {
    @State private var viewModel = DiscoverViewModel()
    @State private var displayMode: DisplayMode = .grid

    enum DisplayMode: String, CaseIterable {
        case grid
        case list

        var icon: String {
            switch self {
            case .grid: return "square.grid.2x2"
            case .list: return "list.bullet"
            }
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search Bar
                DebouncedSearchBar(
                    text: $viewModel.searchText,
                    placeholder: "Search models...",
                    debounceInterval: 0.3
                ) { _ in
                    viewModel.search()
                }
                .padding(.horizontal, .spacing.lg)
                .padding(.top, .spacing.md)

                // Filter Bar
                FilterBar(
                    selectedTaskType: $viewModel.selectedTaskType,
                    selectedProvider: $viewModel.selectedProvider,
                    selectedSize: $viewModel.selectedSize
                ) {
                    viewModel.clearFilters()
                }

                // Results Header
                ResultsHeader(
                    count: viewModel.filteredModels.count,
                    sortOrder: viewModel.sortOrder,
                    displayMode: $displayMode,
                    onSortChange: { viewModel.setSortOrder($0) }
                )
                .padding(.horizontal, .spacing.lg)
                .padding(.vertical, .spacing.sm)

                // Content
                if viewModel.isLoading {
                    LoadingStateView()
                } else if viewModel.filteredModels.isEmpty {
                    EmptyStateView(
                        message: viewModel.emptyStateMessage,
                        hasFilters: viewModel.hasActiveFilters,
                        onClearFilters: { viewModel.clearFilters() }
                    )
                } else {
                    ModelGridView(
                        models: viewModel.filteredModels,
                        displayMode: displayMode,
                        onAddToRecipes: { model in
                            Task {
                                await viewModel.addToRecipes(model)
                            }
                        }
                    )
                }
            }
            .background(Color.theme.background)
            .navigationTitle("Discover")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task {
                            await viewModel.refresh()
                        }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: .iconSize.md))
                            .foregroundColor(Color.theme.foreground)
                    }
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "An unknown error occurred")
            }
        }
    }
}

// MARK: - Results Header

struct ResultsHeader: View {
    let count: Int
    let sortOrder: SortOrder
    @Binding var displayMode: DiscoverView.DisplayMode
    var onSortChange: (SortOrder) -> Void

    var body: some View {
        HStack {
            Text("\(count) models")
                .font(.theme.caption)
                .foregroundColor(Color.theme.mutedForeground)

            Spacer()

            HStack(spacing: .spacing.md) {
                // Sort Menu
                Menu {
                    ForEach(SortOrder.allCases) { order in
                        Button {
                            onSortChange(order)
                        } label: {
                            HStack {
                                Label(order.displayName, systemImage: order.iconName)
                                if sortOrder == order {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    HStack(spacing: .spacing.xs) {
                        Image(systemName: sortOrder.iconName)
                            .font(.system(size: 12))
                        Text(sortOrder.displayName)
                            .font(.theme.caption)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 10))
                    }
                    .foregroundColor(Color.theme.foreground)
                    .padding(.horizontal, .spacing.sm)
                    .padding(.vertical, .spacing.xs)
                    .background(
                        RoundedRectangle(cornerRadius: .radius.sm)
                            .fill(Color.theme.backgroundSecondary)
                    )
                }

                // Display Mode Toggle
                Picker("Display Mode", selection: $displayMode) {
                    ForEach(DiscoverView.DisplayMode.allCases, id: \.self) { mode in
                        Image(systemName: mode.icon)
                            .tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 80)
            }
        }
    }
}

// MARK: - Model Grid View

struct ModelGridView: View {
    let models: [DiscoverModel]
    let displayMode: DiscoverView.DisplayMode
    var onAddToRecipes: ((DiscoverModel) -> Void)?

    private let gridColumns = [
        GridItem(.adaptive(minimum: 300, maximum: 400), spacing: .spacing.lg)
    ]

    var body: some View {
        ScrollView {
            switch displayMode {
            case .grid:
                LazyVGrid(columns: gridColumns, spacing: .spacing.lg) {
                    ForEach(models) { model in
                        ModelCard(model: model) {
                            onAddToRecipes?(model)
                        }
                    }
                }
                .padding(.horizontal, .spacing.lg)
                .padding(.vertical, .spacing.md)

            case .list:
                LazyVStack(spacing: .spacing.md) {
                    ForEach(models) { model in
                        CompactModelCard(model: model) {
                            // Detail tap
                        } onAddToRecipes: {
                            onAddToRecipes?(model)
                        }
                    }
                }
                .padding(.horizontal, .spacing.lg)
                .padding(.vertical, .spacing.md)
            }
        }
    }
}

// MARK: - Loading State View

struct LoadingStateView: View {
    var body: some View {
        VStack(spacing: .spacing.lg) {
            Spacer()

            ProgressView()
                .scaleEffect(1.5)
                .tint(Color.theme.primary)

            Text("Loading models...")
                .font(.theme.body)
                .foregroundColor(Color.theme.mutedForeground)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Empty State View

struct EmptyStateView: View {
    let message: String
    var hasFilters: Bool = false
    var onClearFilters: (() -> Void)?

    var body: some View {
        VStack(spacing: .spacing.xl) {
            Spacer()

            Image(systemName: hasFilters ? "magnifyingglass" : "cube.box")
                .font(.system(size: 48))
                .foregroundColor(Color.theme.mutedForeground)

            VStack(spacing: .spacing.sm) {
                Text(hasFilters ? "No Results" : "No Models")
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)

                Text(message)
                    .font(.theme.body)
                    .foregroundColor(Color.theme.mutedForeground)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, .spacing.xxl)
            }

            if hasFilters, let onClear = onClearFilters {
                Button {
                    onClear()
                } label: {
                    HStack(spacing: .spacing.sm) {
                        Image(systemName: "xmark")
                        Text("Clear Filters")
                    }
                    .font(.theme.body)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.background)
                    .padding(.horizontal, .spacing.xl)
                    .padding(.vertical, .spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: .radius.md)
                            .fill(Color.theme.primary)
                    )
                }
                .buttonStyle(.plain)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Skeleton Card

struct SkeletonModelCard: View {
    @State private var isAnimating = false

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Title skeleton
            SkeletonView(height: 20)
                .frame(width: 200)

            // Badge skeletons
            HStack(spacing: .spacing.sm) {
                SkeletonView(height: 16)
                    .frame(width: 60)
                SkeletonView(height: 16)
                    .frame(width: 40)
            }

            // Description skeleton
            VStack(alignment: .leading, spacing: .spacing.xs) {
                SkeletonView(height: 12)
                SkeletonView(height: 12)
                    .frame(width: 200)
            }

            // Task badges skeleton
            HStack(spacing: .spacing.xs) {
                SkeletonView(height: 20)
                    .frame(width: 80)
                SkeletonView(height: 20)
                    .frame(width: 60)
            }

            Spacer()

            // Footer skeleton
            HStack {
                HStack(spacing: .spacing.lg) {
                    SkeletonView(height: 14)
                        .frame(width: 50)
                    SkeletonView(height: 14)
                        .frame(width: 50)
                }
                Spacer()
                SkeletonView(height: 32)
                    .frame(width: 60)
            }
        }
        .padding(.spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: .radius.lg)
                .fill(Color.theme.card)
        )
        .overlay(
            RoundedRectangle(cornerRadius: .radius.lg)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }
}

// MARK: - Skeleton View

struct SkeletonView: View {
    var height: CGFloat = 20

    @State private var isAnimating = false

    var body: some View {
        RoundedRectangle(cornerRadius: .radius.sm)
            .fill(Color.theme.backgroundSecondary)
            .frame(height: height)
            .overlay(
                RoundedRectangle(cornerRadius: .radius.sm)
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.clear,
                                Color.white.opacity(0.1),
                                Color.clear
                            ]),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .offset(x: isAnimating ? 200 : -200)
            )
            .clipped()
            .onAppear {
                withAnimation(
                    Animation.linear(duration: 1.5)
                        .repeatForever(autoreverses: false)
                ) {
                    isAnimating = true
                }
            }
    }
}

// MARK: - Featured Section (Optional)

struct FeaturedModelsSection: View {
    let models: [DiscoverModel]
    var onModelTap: ((DiscoverModel) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            HStack {
                Image(systemName: "flame.fill")
                    .foregroundColor(Color.theme.primary)
                Text("Popular Models")
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)
                Spacer()
                Button("See All") {
                    // Navigate to filtered view
                }
                .font(.theme.caption)
                .foregroundColor(Color.theme.primary)
            }
            .padding(.horizontal, .spacing.lg)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: .spacing.md) {
                    ForEach(models) { model in
                        FeaturedModelCard(model: model) {
                            onModelTap?(model)
                        }
                    }
                }
                .padding(.horizontal, .spacing.lg)
            }
        }
    }
}

// MARK: - Featured Model Card

struct FeaturedModelCard: View {
    let model: DiscoverModel
    var onTap: (() -> Void)?

    var body: some View {
        Button {
            onTap?()
        } label: {
            VStack(alignment: .leading, spacing: .spacing.sm) {
                HStack {
                    ProviderBadge(provider: model.provider)
                    Spacer()
                    SizeBadge(size: model.size, parameterCount: model.parameterCount)
                }

                Text(model.name)
                    .font(.theme.body)
                    .fontWeight(.semibold)
                    .foregroundColor(Color.theme.foreground)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                HStack(spacing: .spacing.md) {
                    StatItem(icon: "arrow.down.circle", value: model.formattedDownloads)
                    StatItem(icon: "heart", value: model.formattedLikes)
                }
            }
            .padding(.spacing.md)
            .frame(width: 200)
            .background(
                RoundedRectangle(cornerRadius: .radius.lg)
                    .fill(Color.theme.card)
            )
            .overlay(
                RoundedRectangle(cornerRadius: .radius.lg)
                    .stroke(Color.theme.border, lineWidth: 1)
            )
        }
        .buttonStyle(CardButtonStyle())
    }
}

// MARK: - Preview

#Preview("Discover View") {
    DiscoverView()
}

#Preview("Empty State") {
    EmptyStateView(
        message: "No models match your filters. Try adjusting your search criteria.",
        hasFilters: true
    ) {
        print("Clear filters")
    }
    .background(Color.theme.background)
}

#Preview("Loading State") {
    LoadingStateView()
        .background(Color.theme.background)
}

#Preview("Skeleton Card") {
    SkeletonModelCard()
        .padding()
        .background(Color.theme.background)
}
