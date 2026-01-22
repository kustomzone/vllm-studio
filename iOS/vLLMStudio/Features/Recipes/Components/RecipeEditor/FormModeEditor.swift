import SwiftUI

// MARK: - Form Mode Editor

struct FormModeEditor: View {
    // MARK: - Properties

    @Binding var recipe: Recipe

    // Section expansion state
    @State private var expandedSections: Set<FormSection> = [.basic, .model]

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: .spacing.lg) {
                // Basic info
                basicInfoSection

                // Model loading
                modelLoadingSection

                // Parallelism
                parallelismSection

                // Memory & KV Cache
                memorySection

                // Performance tuning
                performanceSection

                // Tool calling
                toolCallingSection

                // Advanced
                advancedSection
            }
            .padding(.spacing.lg)
        }
        .background(Color.theme.background)
    }

    // MARK: - Basic Info Section

    private var basicInfoSection: some View {
        FormEditorSection(
            title: "Basic Info",
            icon: "info.circle",
            section: .basic,
            expandedSections: $expandedSections
        ) {
            // Name
            FormTextField(
                label: "Recipe Name",
                placeholder: "My Recipe",
                text: Binding(
                    get: { recipe.name },
                    set: { recipe.name = $0 }
                ),
                isRequired: true
            )

            // Model path
            FormTextField(
                label: "Model Path",
                placeholder: "/models/meta-llama/Meta-Llama-3-70B-Instruct",
                text: Binding(
                    get: { recipe.modelPath },
                    set: { recipe.modelPath = $0 }
                ),
                isRequired: true,
                keyboardType: .URL
            )

            // Backend
            FormPicker(
                label: "Backend",
                selection: Binding(
                    get: { recipe.backend ?? .vllm },
                    set: { recipe.backend = $0 }
                ),
                options: BackendType.allCases
            ) { backend in
                Text(backend.displayName)
            }

            // Served model name
            FormTextField(
                label: "Served Model Name",
                placeholder: "Optional display name",
                text: Binding(
                    get: { recipe.servedModelName ?? "" },
                    set: { recipe.servedModelName = $0.isEmpty ? nil : $0 }
                )
            )
        }
    }

    // MARK: - Model Loading Section

    private var modelLoadingSection: some View {
        FormEditorSection(
            title: "Model Loading",
            icon: "cube.box",
            section: .model,
            expandedSections: $expandedSections
        ) {
            // Data type
            FormTextField(
                label: "Data Type (dtype)",
                placeholder: "auto, float16, bfloat16",
                text: Binding(
                    get: { recipe.dtype ?? "" },
                    set: { recipe.dtype = $0.isEmpty ? nil : $0 }
                )
            )

            // Tokenizer mode
            FormPicker(
                label: "Tokenizer Mode",
                selection: Binding(
                    get: { recipe.tokenizerMode ?? .auto },
                    set: { recipe.tokenizerMode = $0 }
                ),
                options: TokenizerMode.allCases
            ) { mode in
                Text(mode.rawValue)
            }

            // Trust remote code
            FormToggle(
                label: "Trust Remote Code",
                isOn: Binding(
                    get: { recipe.trustRemoteCode ?? false },
                    set: { recipe.trustRemoteCode = $0 }
                ),
                help: "Allow loading models with custom code"
            )

            // Quantization
            FormTextField(
                label: "Quantization",
                placeholder: "awq, gptq, squeezellm",
                text: Binding(
                    get: { recipe.quantization ?? "" },
                    set: { recipe.quantization = $0.isEmpty ? nil : $0 }
                )
            )

            // Revision
            FormTextField(
                label: "Model Revision",
                placeholder: "main",
                text: Binding(
                    get: { recipe.revision ?? "" },
                    set: { recipe.revision = $0.isEmpty ? nil : $0 }
                )
            )
        }
    }

    // MARK: - Parallelism Section

    private var parallelismSection: some View {
        FormEditorSection(
            title: "Parallelism",
            icon: "cpu",
            section: .parallelism,
            expandedSections: $expandedSections
        ) {
            // Tensor parallel size
            FormNumberField(
                label: "Tensor Parallel Size",
                value: Binding(
                    get: { recipe.tensorParallelSize ?? recipe.tp ?? 1 },
                    set: {
                        recipe.tensorParallelSize = $0
                        recipe.tp = $0
                    }
                ),
                range: 1...8,
                help: "Number of GPUs for tensor parallelism"
            )

            // Pipeline parallel size
            FormNumberField(
                label: "Pipeline Parallel Size",
                value: Binding(
                    get: { recipe.pipelineParallelSize ?? recipe.pp ?? 1 },
                    set: {
                        recipe.pipelineParallelSize = $0
                        recipe.pp = $0
                    }
                ),
                range: 1...8,
                help: "Number of GPUs for pipeline parallelism"
            )

            // Data parallel size
            FormNumberField(
                label: "Data Parallel Size",
                value: Binding(
                    get: { recipe.dataParallelSize ?? 1 },
                    set: { recipe.dataParallelSize = $0 > 1 ? $0 : nil }
                ),
                range: 1...8,
                help: "Number of replicas for data parallelism"
            )

            // Distributed executor backend
            FormPicker(
                label: "Distributed Backend",
                selection: Binding(
                    get: { recipe.distributedExecutorBackend ?? .mp },
                    set: { recipe.distributedExecutorBackend = $0 }
                ),
                options: DistributedExecutorBackend.allCases
            ) { backend in
                Text(backend.rawValue.uppercased())
            }

            // Expert parallel
            FormToggle(
                label: "Enable Expert Parallel",
                isOn: Binding(
                    get: { recipe.enableExpertParallel ?? false },
                    set: { recipe.enableExpertParallel = $0 }
                ),
                help: "For Mixture of Experts models"
            )

            // Total GPUs display
            HStack {
                Text("Total GPUs")
                    .font(.theme.body)
                    .foregroundStyle(Color.theme.mutedForeground)
                Spacer()
                Text("\(recipe.totalGpuCount)")
                    .font(.theme.body.weight(.semibold))
                    .foregroundStyle(Color.theme.primary)
            }
            .padding(.vertical, .spacing.xs)
        }
    }

    // MARK: - Memory Section

    private var memorySection: some View {
        FormEditorSection(
            title: "Memory & KV Cache",
            icon: "memorychip",
            section: .memory,
            expandedSections: $expandedSections
        ) {
            // GPU memory utilization
            FormSlider(
                label: "GPU Memory Utilization",
                value: Binding(
                    get: { recipe.gpuMemoryUtilization ?? 0.9 },
                    set: { recipe.gpuMemoryUtilization = $0 }
                ),
                range: 0.1...1.0,
                step: 0.05,
                format: "%.0f%%",
                multiplier: 100
            )

            // Max model length
            FormNumberField(
                label: "Max Model Length",
                value: Binding(
                    get: { recipe.maxModelLen ?? 0 },
                    set: { recipe.maxModelLen = $0 > 0 ? $0 : nil }
                ),
                range: 0...131072,
                help: "Maximum context length (0 = auto)"
            )

            // KV cache dtype
            FormTextField(
                label: "KV Cache Dtype",
                placeholder: "auto, fp8",
                text: Binding(
                    get: { recipe.kvCacheDtype ?? "" },
                    set: { recipe.kvCacheDtype = $0.isEmpty ? nil : $0 }
                )
            )

            // Block size
            FormNumberField(
                label: "Block Size",
                value: Binding(
                    get: { recipe.blockSize ?? 16 },
                    set: { recipe.blockSize = $0 }
                ),
                range: 8...128,
                help: "KV cache block size"
            )

            // Swap space
            FormNumberField(
                label: "Swap Space (GB)",
                value: Binding(
                    get: { recipe.swapSpace ?? 0 },
                    set: { recipe.swapSpace = $0 > 0 ? $0 : nil }
                ),
                range: 0...256,
                help: "CPU swap space for KV cache"
            )

            // Prefix caching
            FormToggle(
                label: "Enable Prefix Caching",
                isOn: Binding(
                    get: { recipe.enablePrefixCaching ?? false },
                    set: { recipe.enablePrefixCaching = $0 }
                ),
                help: "Cache common prompt prefixes"
            )
        }
    }

    // MARK: - Performance Section

    private var performanceSection: some View {
        FormEditorSection(
            title: "Performance Tuning",
            icon: "gauge.with.dots.needle.67percent",
            section: .performance,
            expandedSections: $expandedSections
        ) {
            // Max sequences
            FormNumberField(
                label: "Max Sequences",
                value: Binding(
                    get: { recipe.maxNumSeqs ?? 256 },
                    set: { recipe.maxNumSeqs = $0 }
                ),
                range: 1...1024,
                help: "Maximum concurrent sequences"
            )

            // Max batched tokens
            FormNumberField(
                label: "Max Batched Tokens",
                value: Binding(
                    get: { recipe.maxNumBatchedTokens ?? 0 },
                    set: { recipe.maxNumBatchedTokens = $0 > 0 ? $0 : nil }
                ),
                range: 0...65536,
                help: "Max tokens per batch (0 = auto)"
            )

            // Scheduling policy
            FormPicker(
                label: "Scheduling Policy",
                selection: Binding(
                    get: { recipe.schedulingPolicy ?? .fcfs },
                    set: { recipe.schedulingPolicy = $0 }
                ),
                options: SchedulingPolicy.allCases
            ) { policy in
                Text(policy.rawValue.uppercased())
            }

            // Enforce eager
            FormToggle(
                label: "Enforce Eager Mode",
                isOn: Binding(
                    get: { recipe.enforceEager ?? false },
                    set: { recipe.enforceEager = $0 }
                ),
                help: "Disable CUDA graph optimization"
            )

            // Chunked prefill
            FormToggle(
                label: "Enable Chunked Prefill",
                isOn: Binding(
                    get: { recipe.enableChunkedPrefill ?? false },
                    set: { recipe.enableChunkedPrefill = $0 }
                ),
                help: "Process prefill in chunks"
            )

            // Disable CUDA graph
            FormToggle(
                label: "Disable CUDA Graph",
                isOn: Binding(
                    get: { recipe.disableCudaGraph ?? false },
                    set: { recipe.disableCudaGraph = $0 }
                ),
                help: "Disable CUDA graph capture"
            )
        }
    }

    // MARK: - Tool Calling Section

    private var toolCallingSection: some View {
        FormEditorSection(
            title: "Tool Calling & Reasoning",
            icon: "wrench.and.screwdriver",
            section: .toolCalling,
            expandedSections: $expandedSections
        ) {
            // Tool call parser
            FormTextField(
                label: "Tool Call Parser",
                placeholder: "hermes, llama3_json, mistral",
                text: Binding(
                    get: { recipe.toolCallParser ?? "" },
                    set: { recipe.toolCallParser = $0.isEmpty ? nil : $0 }
                )
            )

            // Enable auto tool choice
            FormToggle(
                label: "Enable Auto Tool Choice",
                isOn: Binding(
                    get: { recipe.enableAutoToolChoice ?? false },
                    set: { recipe.enableAutoToolChoice = $0 }
                ),
                help: "Allow model to choose tools automatically"
            )

            // Reasoning parser
            FormTextField(
                label: "Reasoning Parser",
                placeholder: "deepseek_r1",
                text: Binding(
                    get: { recipe.reasoningParser ?? "" },
                    set: { recipe.reasoningParser = $0.isEmpty ? nil : $0 }
                )
            )

            // Enable thinking
            FormToggle(
                label: "Enable Thinking Mode",
                isOn: Binding(
                    get: { recipe.enableThinking ?? false },
                    set: { recipe.enableThinking = $0 }
                ),
                help: "Enable thinking/reasoning output"
            )

            // Thinking budget
            if recipe.enableThinking == true {
                FormNumberField(
                    label: "Thinking Budget",
                    value: Binding(
                        get: { recipe.thinkingBudget ?? 0 },
                        set: { recipe.thinkingBudget = $0 > 0 ? $0 : nil }
                    ),
                    range: 0...65536,
                    help: "Max tokens for thinking (0 = unlimited)"
                )
            }
        }
    }

    // MARK: - Advanced Section

    private var advancedSection: some View {
        FormEditorSection(
            title: "Advanced",
            icon: "gearshape.2",
            section: .advanced,
            expandedSections: $expandedSections
        ) {
            // Host
            FormTextField(
                label: "Host",
                placeholder: "0.0.0.0",
                text: Binding(
                    get: { recipe.host ?? "0.0.0.0" },
                    set: { recipe.host = $0.isEmpty ? nil : $0 }
                )
            )

            // Port
            FormNumberField(
                label: "Port",
                value: Binding(
                    get: { recipe.port ?? 8000 },
                    set: { recipe.port = $0 }
                ),
                range: 1024...65535
            )

            // Disable log requests
            FormToggle(
                label: "Disable Log Requests",
                isOn: Binding(
                    get: { recipe.disableLogRequests ?? false },
                    set: { recipe.disableLogRequests = $0 }
                ),
                help: "Disable request logging for privacy"
            )

            // Disable custom all reduce
            FormToggle(
                label: "Disable Custom All Reduce",
                isOn: Binding(
                    get: { recipe.disableCustomAllReduce ?? false },
                    set: { recipe.disableCustomAllReduce = $0 }
                ),
                help: "Use NCCL all-reduce instead"
            )
        }
    }
}

// MARK: - Form Section Enum

enum FormSection: String, CaseIterable {
    case basic
    case model
    case parallelism
    case memory
    case performance
    case toolCalling
    case advanced
}

// MARK: - Form Editor Section

struct FormEditorSection<Content: View>: View {
    let title: String
    let icon: String
    let section: FormSection
    @Binding var expandedSections: Set<FormSection>
    @ViewBuilder let content: Content

    private var isExpanded: Bool {
        expandedSections.contains(section)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    if isExpanded {
                        expandedSections.remove(section)
                    } else {
                        expandedSections.insert(section)
                    }
                }
            } label: {
                HStack {
                    Label(title, systemImage: icon)
                        .font(.theme.headline)
                        .foregroundStyle(Color.theme.foreground)

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(Color.theme.mutedForeground)
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                }
                .padding(.spacing.lg)
                .background(Color.theme.card)
            }
            .buttonStyle(.plain)

            // Content
            if isExpanded {
                VStack(spacing: .spacing.md) {
                    content
                }
                .padding(.spacing.lg)
                .background(Color.theme.backgroundSecondary)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: .radius.md))
    }
}

// MARK: - Form Components

struct FormTextField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var isRequired: Bool = false
    var keyboardType: UIKeyboardType = .default

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.xs) {
            HStack(spacing: .spacing.xs) {
                Text(label)
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)
                if isRequired {
                    Text("*")
                        .font(.theme.caption)
                        .foregroundStyle(Color.theme.error)
                }
            }

            TextField(placeholder, text: $text)
                .font(.theme.body)
                .foregroundStyle(Color.theme.foreground)
                .padding(.spacing.md)
                .background(Color.theme.card)
                .clipShape(RoundedRectangle(cornerRadius: .radius.sm))
                .keyboardType(keyboardType)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
        }
    }
}

struct FormNumberField: View {
    let label: String
    @Binding var value: Int
    let range: ClosedRange<Int>
    var help: String?

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.xs) {
            Text(label)
                .font(.theme.caption)
                .foregroundStyle(Color.theme.mutedForeground)

            HStack {
                TextField("", value: $value, format: .number)
                    .font(.theme.body)
                    .foregroundStyle(Color.theme.foreground)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.leading)

                Stepper("", value: $value, in: range)
                    .labelsHidden()
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .background(Color.theme.card)
            .clipShape(RoundedRectangle(cornerRadius: .radius.sm))

            if let help = help {
                Text(help)
                    .font(.theme.caption2)
                    .foregroundStyle(Color.theme.mutedForeground)
            }
        }
    }
}

struct FormToggle: View {
    let label: String
    @Binding var isOn: Bool
    var help: String?

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.xs) {
            Toggle(label, isOn: $isOn)
                .font(.theme.body)
                .foregroundStyle(Color.theme.foreground)
                .tint(Color.theme.primary)

            if let help = help {
                Text(help)
                    .font(.theme.caption2)
                    .foregroundStyle(Color.theme.mutedForeground)
            }
        }
    }
}

struct FormPicker<T: Hashable, Content: View>: View {
    let label: String
    @Binding var selection: T
    let options: [T]
    @ViewBuilder let content: (T) -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.xs) {
            Text(label)
                .font(.theme.caption)
                .foregroundStyle(Color.theme.mutedForeground)

            Picker(label, selection: $selection) {
                ForEach(options, id: \.self) { option in
                    content(option).tag(option)
                }
            }
            .pickerStyle(.segmented)
        }
    }
}

struct FormSlider: View {
    let label: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    let format: String
    var multiplier: Double = 1

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.xs) {
            HStack {
                Text(label)
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)
                Spacer()
                Text(String(format: format, value * multiplier))
                    .font(.theme.body.weight(.semibold))
                    .foregroundStyle(Color.theme.primary)
            }

            Slider(value: $value, in: range, step: step)
                .tint(Color.theme.primary)
        }
    }
}

// MARK: - Preview

#Preview {
    FormModeEditor(recipe: .constant(Recipe.sample))
        .preferredColorScheme(.dark)
}
