import SwiftUI

// MARK: - Editor Mode

enum RecipeEditorMode {
    case create
    case edit(Recipe)

    var title: String {
        switch self {
        case .create: return "New Recipe"
        case .edit: return "Edit Recipe"
        }
    }

    var saveButtonTitle: String {
        switch self {
        case .create: return "Create"
        case .edit: return "Save"
        }
    }

    var recipe: Recipe {
        switch self {
        case .create: return Recipe()
        case .edit(let recipe): return recipe
        }
    }
}

// MARK: - Editor Tab

enum EditorTab: String, CaseIterable {
    case form = "Form"
    case command = "Command"

    var icon: String {
        switch self {
        case .form: return "slider.horizontal.3"
        case .command: return "terminal"
        }
    }
}

// MARK: - Recipe Editor Sheet

struct RecipeEditorSheet: View {
    // MARK: - Properties

    let mode: RecipeEditorMode
    @Bindable var viewModel: RecipesViewModel

    @State private var recipe: Recipe
    @State private var selectedTab: EditorTab = .form
    @State private var commandText: String = ""
    @State private var showingVRAMCalculator = false
    @State private var showingValidationAlert = false
    @State private var validationErrors: [String] = []
    @State private var isSaving = false

    @Environment(\.dismiss) private var dismiss

    // MARK: - Initialization

    init(mode: RecipeEditorMode, viewModel: RecipesViewModel) {
        self.mode = mode
        self.viewModel = viewModel
        _recipe = State(initialValue: mode.recipe)
        _commandText = State(initialValue: mode.recipe.toCommand())
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab picker
                tabPicker

                // Content
                TabView(selection: $selectedTab) {
                    FormModeEditor(recipe: $recipe)
                        .tag(EditorTab.form)

                    CommandModeEditor(
                        commandText: $commandText,
                        onParse: parseCommand
                    )
                    .tag(EditorTab.command)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut(duration: 0.2), value: selectedTab)
            }
            .background(Color.theme.background)
            .navigationTitle(mode.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarContent }
            .sheet(isPresented: $showingVRAMCalculator) {
                VRAMCalculator()
            }
            .alert("Validation Error", isPresented: $showingValidationAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(validationErrors.joined(separator: "\n"))
            }
            .onChange(of: recipe) { _, newValue in
                // Sync command text when form changes
                if selectedTab == .form {
                    commandText = newValue.toCommand()
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(hasChanges)
        .preferredColorScheme(.dark)
    }

    // MARK: - Tab Picker

    private var tabPicker: some View {
        HStack(spacing: 0) {
            ForEach(EditorTab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedTab = tab
                    }
                } label: {
                    HStack(spacing: .spacing.sm) {
                        Image(systemName: tab.icon)
                            .font(.theme.caption)
                        Text(tab.rawValue)
                            .font(.theme.body)
                    }
                    .foregroundStyle(selectedTab == tab ? Color.theme.primary : Color.theme.mutedForeground)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, .spacing.md)
                    .background(
                        selectedTab == tab ? Color.theme.primary.opacity(0.1) : Color.clear
                    )
                    .overlay(alignment: .bottom) {
                        if selectedTab == tab {
                            Rectangle()
                                .fill(Color.theme.primary)
                                .frame(height: 2)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .background(Color.theme.backgroundSecondary)
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button("Cancel") {
                dismiss()
            }
        }

        ToolbarItem(placement: .topBarTrailing) {
            HStack(spacing: .spacing.md) {
                // VRAM Calculator button
                Button {
                    showingVRAMCalculator = true
                } label: {
                    Image(systemName: "memorychip")
                }

                // Save button
                Button {
                    saveRecipe()
                } label: {
                    if isSaving {
                        ProgressView()
                            .tint(Color.theme.primary)
                    } else {
                        Text(mode.saveButtonTitle)
                            .fontWeight(.semibold)
                    }
                }
                .disabled(!isValid || isSaving)
            }
        }
    }

    // MARK: - Actions

    private func parseCommand() {
        let parsed = Recipe.fromCommand(commandText, existingRecipe: recipe)
        recipe = parsed
    }

    private func saveRecipe() {
        // Validate
        let errors = validateRecipe()
        if !errors.isEmpty {
            validationErrors = errors
            showingValidationAlert = true
            return
        }

        isSaving = true

        Task {
            do {
                switch mode {
                case .create:
                    try await viewModel.createRecipe(recipe)
                case .edit:
                    try await viewModel.updateRecipe(recipe)
                }
                await MainActor.run {
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    validationErrors = [error.localizedDescription]
                    showingValidationAlert = true
                    isSaving = false
                }
            }
        }
    }

    private func validateRecipe() -> [String] {
        var errors: [String] = []

        if recipe.name.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("Recipe name is required")
        }

        if recipe.modelPath.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("Model path is required")
        }

        if let util = recipe.gpuMemoryUtilization, (util < 0 || util > 1) {
            errors.append("GPU memory utilization must be between 0 and 1")
        }

        if let tp = recipe.tensorParallelSize, tp < 1 {
            errors.append("Tensor parallel size must be at least 1")
        }

        return errors
    }

    // MARK: - Computed Properties

    private var isValid: Bool {
        !recipe.name.trimmingCharacters(in: .whitespaces).isEmpty &&
        !recipe.modelPath.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var hasChanges: Bool {
        switch mode {
        case .create:
            return !recipe.name.isEmpty || !recipe.modelPath.isEmpty
        case .edit(let original):
            return recipe != original
        }
    }
}

// MARK: - Preview

#Preview("Create") {
    RecipeEditorSheet(
        mode: .create,
        viewModel: RecipesViewModel.preview
    )
}

#Preview("Edit") {
    RecipeEditorSheet(
        mode: .edit(Recipe.sample),
        viewModel: RecipesViewModel.preview
    )
}
