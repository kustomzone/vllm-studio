import SwiftUI

// MARK: - Recipe Detail View

struct RecipeDetailView: View {
    // MARK: - Properties

    let recipe: Recipe
    @Bindable var viewModel: RecipesViewModel
    var onDelete: ((Recipe) -> Void)?

    @State private var showingEditSheet = false
    @State private var showingDeleteConfirmation = false
    @State private var showingCommandSheet = false
    @Environment(\.dismiss) private var dismiss

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: .spacing.lg) {
                // Header card
                headerCard

                // Quick actions
                quickActionsSection

                // Model configuration
                modelConfigSection

                // Parallelism settings
                parallelismSection

                // Memory & KV Cache
                memorySection

                // Performance tuning
                performanceSection

                // Tool calling
                toolCallingSection

                // Delete button
                deleteSection
            }
            .padding(.spacing.lg)
        }
        .background(Color.theme.background)
        .navigationTitle(recipe.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbarContent }
        .sheet(isPresented: $showingEditSheet) {
            RecipeEditorSheet(
                mode: .edit(recipe),
                viewModel: viewModel
            )
        }
        .sheet(isPresented: $showingCommandSheet) {
            commandSheet
        }
        .alert("Delete Recipe", isPresented: $showingDeleteConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                onDelete?(recipe)
                dismiss()
            }
        } message: {
            Text("Are you sure you want to delete \"\(recipe.name)\"? This action cannot be undone.")
        }
    }

    // MARK: - Header Card

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Status row
            HStack {
                statusBadge

                Spacer()

                if let backend = recipe.backend {
                    Text(backend.displayName)
                        .font(.theme.caption)
                        .foregroundStyle(Color.theme.mutedForeground)
                        .padding(.horizontal, .spacing.sm)
                        .padding(.vertical, .spacing.xs)
                        .background(Color.theme.backgroundTertiary)
                        .clipShape(Capsule())
                }
            }

            // Model path
            VStack(alignment: .leading, spacing: .spacing.xs) {
                Text("Model Path")
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)

                Text(recipe.modelPath)
                    .font(.theme.code)
                    .foregroundStyle(Color.theme.foreground)
                    .textSelection(.enabled)
            }

            // Server info
            if let host = recipe.host, let port = recipe.port {
                VStack(alignment: .leading, spacing: .spacing.xs) {
                    Text("Server")
                        .font(.theme.caption)
                        .foregroundStyle(Color.theme.mutedForeground)

                    Text("\(host):\(port)")
                        .font(.theme.code)
                        .foregroundStyle(Color.theme.foreground)
                }
            }
        }
        .padding(.spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.theme.card)
        .clipShape(RoundedRectangle(cornerRadius: .radius.lg))
    }

    // MARK: - Status Badge

    private var statusBadge: some View {
        HStack(spacing: .spacing.sm) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)

            Text(recipe.status.displayName)
                .font(.theme.body)
                .fontWeight(.medium)
                .foregroundStyle(statusColor)
        }
        .padding(.horizontal, .spacing.md)
        .padding(.vertical, .spacing.sm)
        .background(statusColor.opacity(0.1))
        .clipShape(Capsule())
    }

    private var statusColor: Color {
        switch recipe.status {
        case .running: return Color.theme.success
        case .starting: return Color.theme.warning
        case .ready: return Color.theme.info
        case .stopped: return Color.theme.mutedForeground
        case .error: return Color.theme.error
        }
    }

    // MARK: - Quick Actions Section

    private var quickActionsSection: some View {
        HStack(spacing: .spacing.md) {
            // Launch/Stop button
            Button {
                Task {
                    if recipe.status == .running {
                        try? await viewModel.stop(recipe)
                    } else {
                        try? await viewModel.launch(recipe)
                    }
                }
            } label: {
                Label(
                    recipe.status == .running ? "Stop" : "Launch",
                    systemImage: recipe.status == .running ? "stop.fill" : "play.fill"
                )
                .font(.theme.body.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, .spacing.md)
            }
            .buttonStyle(.borderedProminent)
            .tint(recipe.status == .running ? Color.theme.error : Color.theme.success)
            .disabled(viewModel.isLaunching)

            // View Command button
            Button {
                showingCommandSheet = true
            } label: {
                Label("Command", systemImage: "terminal")
                    .font(.theme.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, .spacing.md)
            }
            .buttonStyle(.bordered)
            .tint(Color.theme.foreground)
        }
    }

    // MARK: - Model Config Section

    private var modelConfigSection: some View {
        DetailSection(title: "Model Configuration", icon: "cube") {
            DetailRow(label: "Data Type", value: recipe.dtype ?? "auto")
            DetailRow(label: "Tokenizer Mode", value: recipe.tokenizerMode?.rawValue ?? "auto")
            DetailRow(label: "Trust Remote Code", value: recipe.trustRemoteCode == true ? "Yes" : "No")
            if let quant = recipe.quantization {
                DetailRow(label: "Quantization", value: quant)
            }
            if let servedName = recipe.servedModelName {
                DetailRow(label: "Served Model Name", value: servedName)
            }
        }
    }

    // MARK: - Parallelism Section

    private var parallelismSection: some View {
        DetailSection(title: "Parallelism", icon: "cpu") {
            DetailRow(label: "Tensor Parallel Size", value: "\(recipe.effectiveTensorParallelSize)")
            DetailRow(label: "Pipeline Parallel Size", value: "\(recipe.effectivePipelineParallelSize)")
            DetailRow(label: "Total GPUs", value: "\(recipe.totalGpuCount)")
            if let dp = recipe.dataParallelSize {
                DetailRow(label: "Data Parallel Size", value: "\(dp)")
            }
            if let backend = recipe.distributedExecutorBackend {
                DetailRow(label: "Distributed Backend", value: backend.rawValue)
            }
            DetailRow(label: "Expert Parallel", value: recipe.enableExpertParallel == true ? "Enabled" : "Disabled")
        }
    }

    // MARK: - Memory Section

    private var memorySection: some View {
        DetailSection(title: "Memory & KV Cache", icon: "memorychip") {
            if let util = recipe.gpuMemoryUtilization {
                DetailRow(label: "GPU Memory Utilization", value: String(format: "%.0f%%", util * 100))
            }
            if let maxLen = recipe.maxModelLen {
                DetailRow(label: "Max Model Length", value: formatNumber(maxLen))
            }
            if let kvDtype = recipe.kvCacheDtype {
                DetailRow(label: "KV Cache Dtype", value: kvDtype)
            }
            if let blockSize = recipe.blockSize {
                DetailRow(label: "Block Size", value: "\(blockSize)")
            }
            if let swap = recipe.swapSpace {
                DetailRow(label: "Swap Space", value: "\(swap) GB")
            }
            DetailRow(label: "Prefix Caching", value: recipe.enablePrefixCaching == true ? "Enabled" : "Disabled")
        }
    }

    // MARK: - Performance Section

    private var performanceSection: some View {
        DetailSection(title: "Performance Tuning", icon: "gauge.with.dots.needle.67percent") {
            if let maxSeqs = recipe.maxNumSeqs {
                DetailRow(label: "Max Sequences", value: "\(maxSeqs)")
            }
            if let maxBatched = recipe.maxNumBatchedTokens {
                DetailRow(label: "Max Batched Tokens", value: formatNumber(maxBatched))
            }
            DetailRow(label: "Enforce Eager", value: recipe.enforceEager == true ? "Yes" : "No")
            DetailRow(label: "CUDA Graph", value: recipe.disableCudaGraph == true ? "Disabled" : "Enabled")
            DetailRow(label: "Chunked Prefill", value: recipe.enableChunkedPrefill == true ? "Enabled" : "Disabled")
        }
    }

    // MARK: - Tool Calling Section

    private var toolCallingSection: some View {
        DetailSection(title: "Tool Calling & Reasoning", icon: "wrench.and.screwdriver") {
            if let parser = recipe.toolCallParser {
                DetailRow(label: "Tool Call Parser", value: parser)
            }
            DetailRow(label: "Auto Tool Choice", value: recipe.enableAutoToolChoice == true ? "Enabled" : "Disabled")
            if let reasoning = recipe.reasoningParser {
                DetailRow(label: "Reasoning Parser", value: reasoning)
            }
            DetailRow(label: "Thinking Mode", value: recipe.enableThinking == true ? "Enabled" : "Disabled")
            if let budget = recipe.thinkingBudget {
                DetailRow(label: "Thinking Budget", value: formatNumber(budget))
            }
        }
    }

    // MARK: - Delete Section

    private var deleteSection: some View {
        Button(role: .destructive) {
            showingDeleteConfirmation = true
        } label: {
            HStack {
                Spacer()
                Label("Delete Recipe", systemImage: "trash")
                    .font(.theme.body.weight(.semibold))
                Spacer()
            }
            .padding(.vertical, .spacing.md)
        }
        .buttonStyle(.bordered)
        .tint(Color.theme.error)
    }

    // MARK: - Command Sheet

    private var commandSheet: some View {
        NavigationStack {
            ScrollView {
                Text(recipe.toCommand())
                    .font(.theme.code)
                    .foregroundStyle(Color.theme.foreground)
                    .padding(.spacing.lg)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.theme.card)
                    .clipShape(RoundedRectangle(cornerRadius: .radius.md))
                    .textSelection(.enabled)
                    .padding(.spacing.lg)
            }
            .background(Color.theme.background)
            .navigationTitle("Launch Command")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        showingCommandSheet = false
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        UIPasteboard.general.string = recipe.toCommand()
                    } label: {
                        Label("Copy", systemImage: "doc.on.doc")
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .preferredColorScheme(.dark)
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                showingEditSheet = true
            } label: {
                Text("Edit")
            }
        }
    }

    // MARK: - Helpers

    private func formatNumber(_ num: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: num)) ?? "\(num)"
    }
}

// MARK: - Detail Section

struct DetailSection<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Header
            Label(title, systemImage: icon)
                .font(.theme.headline)
                .foregroundStyle(Color.theme.foreground)

            // Content
            VStack(spacing: 0) {
                content
            }
            .background(Color.theme.card)
            .clipShape(RoundedRectangle(cornerRadius: .radius.md))
        }
    }
}

// MARK: - Detail Row

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.theme.body)
                .foregroundStyle(Color.theme.mutedForeground)

            Spacer()

            Text(value)
                .font(.theme.body)
                .foregroundStyle(Color.theme.foreground)
        }
        .padding(.horizontal, .spacing.lg)
        .padding(.vertical, .spacing.md)
        .overlay(alignment: .bottom) {
            Divider()
                .background(Color.theme.border)
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        RecipeDetailView(
            recipe: Recipe.sample,
            viewModel: RecipesViewModel.preview
        )
    }
    .preferredColorScheme(.dark)
}
