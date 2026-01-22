import SwiftUI

// MARK: - VRAM Calculator

struct VRAMCalculator: View {
    // MARK: - Properties

    @Environment(\.dismiss) private var dismiss

    // Model parameters
    @State private var modelSizeB: Double = 70 // Billion parameters
    @State private var precision: Precision = .fp16
    @State private var contextLength: Int = 8192
    @State private var batchSize: Int = 1
    @State private var numGpus: Int = 1

    // Advanced parameters
    @State private var numLayers: Int = 80
    @State private var numKvHeads: Int = 8
    @State private var hiddenSize: Int = 8192
    @State private var headDim: Int = 128

    // GPU info
    @State private var gpuVramGb: Double = 24 // Per GPU VRAM

    @State private var showAdvanced = false

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: .spacing.lg) {
                    // Result card
                    resultCard

                    // Basic parameters
                    basicParametersSection

                    // Advanced parameters
                    if showAdvanced {
                        advancedParametersSection
                    }

                    // GPU configuration
                    gpuConfigSection

                    // Breakdown
                    breakdownSection

                    // Recommendations
                    recommendationsSection
                }
                .padding(.spacing.lg)
            }
            .background(Color.theme.background)
            .navigationTitle("VRAM Calculator")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        withAnimation {
                            showAdvanced.toggle()
                        }
                    } label: {
                        Label(showAdvanced ? "Basic" : "Advanced", systemImage: "slider.horizontal.3")
                    }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .preferredColorScheme(.dark)
    }

    // MARK: - Result Card

    private var resultCard: some View {
        VStack(spacing: .spacing.lg) {
            // Total VRAM
            VStack(spacing: .spacing.xs) {
                Text("Estimated Total VRAM")
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)

                Text(String(format: "%.1f GB", calculation.totalGb))
                    .font(.system(size: 48, weight: .bold, design: .rounded))
                    .foregroundStyle(fitsColor)
            }

            // Per GPU
            if numGpus > 1 {
                HStack(spacing: .spacing.xl) {
                    VStack(spacing: .spacing.xs) {
                        Text("Per GPU")
                            .font(.theme.caption)
                            .foregroundStyle(Color.theme.mutedForeground)
                        Text(String(format: "%.1f GB", calculation.perGpuGb))
                            .font(.theme.title2)
                            .foregroundStyle(Color.theme.foreground)
                    }

                    VStack(spacing: .spacing.xs) {
                        Text("GPUs")
                            .font(.theme.caption)
                            .foregroundStyle(Color.theme.mutedForeground)
                        Text("\(numGpus)")
                            .font(.theme.title2)
                            .foregroundStyle(Color.theme.foreground)
                    }
                }
            }

            // Status badge
            HStack(spacing: .spacing.sm) {
                Circle()
                    .fill(fitsColor)
                    .frame(width: 8, height: 8)

                Text(fitsMessage)
                    .font(.theme.body)
                    .foregroundStyle(fitsColor)
            }
            .padding(.horizontal, .spacing.lg)
            .padding(.vertical, .spacing.sm)
            .background(fitsColor.opacity(0.1))
            .clipShape(Capsule())

            // Utilization bar
            VStack(spacing: .spacing.xs) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        // Background
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.theme.border)

                        // Fill
                        RoundedRectangle(cornerRadius: 4)
                            .fill(fitsColor)
                            .frame(width: min(geo.size.width * CGFloat(calculation.utilizationPercent / 100), geo.size.width))
                    }
                }
                .frame(height: 8)

                HStack {
                    Text("0 GB")
                        .font(.theme.caption2)
                        .foregroundStyle(Color.theme.mutedForeground)
                    Spacer()
                    Text(String(format: "%.0f GB (total)", gpuVramGb * Double(numGpus)))
                        .font(.theme.caption2)
                        .foregroundStyle(Color.theme.mutedForeground)
                }
            }
        }
        .padding(.spacing.xl)
        .background(Color.theme.card)
        .clipShape(RoundedRectangle(cornerRadius: .radius.lg))
    }

    // MARK: - Basic Parameters Section

    private var basicParametersSection: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            Label("Model Parameters", systemImage: "cube")
                .font(.theme.headline)
                .foregroundStyle(Color.theme.foreground)

            VStack(spacing: .spacing.md) {
                // Model size
                VStack(alignment: .leading, spacing: .spacing.xs) {
                    HStack {
                        Text("Model Size")
                            .font(.theme.caption)
                            .foregroundStyle(Color.theme.mutedForeground)
                        Spacer()
                        Text(String(format: "%.0fB", modelSizeB))
                            .font(.theme.body.weight(.semibold))
                            .foregroundStyle(Color.theme.primary)
                    }
                    Slider(value: $modelSizeB, in: 1...405, step: 1)
                        .tint(Color.theme.primary)

                    // Quick presets
                    HStack(spacing: .spacing.sm) {
                        ForEach([7, 13, 34, 70, 72, 405], id: \.self) { size in
                            Button("\(size)B") {
                                modelSizeB = Double(size)
                            }
                            .font(.theme.caption)
                            .padding(.horizontal, .spacing.sm)
                            .padding(.vertical, .spacing.xs)
                            .background(modelSizeB == Double(size) ? Color.theme.primary : Color.theme.backgroundTertiary)
                            .foregroundStyle(modelSizeB == Double(size) ? .white : Color.theme.foreground)
                            .clipShape(RoundedRectangle(cornerRadius: .radius.sm))
                        }
                    }
                }

                Divider().background(Color.theme.border)

                // Precision
                VStack(alignment: .leading, spacing: .spacing.xs) {
                    Text("Precision / Quantization")
                        .font(.theme.caption)
                        .foregroundStyle(Color.theme.mutedForeground)

                    Picker("Precision", selection: $precision) {
                        ForEach(Precision.allCases, id: \.self) { p in
                            Text(p.displayName).tag(p)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Divider().background(Color.theme.border)

                // Context length
                VStack(alignment: .leading, spacing: .spacing.xs) {
                    HStack {
                        Text("Context Length")
                            .font(.theme.caption)
                            .foregroundStyle(Color.theme.mutedForeground)
                        Spacer()
                        Text(formatNumber(contextLength))
                            .font(.theme.body.weight(.semibold))
                            .foregroundStyle(Color.theme.primary)
                    }

                    Slider(
                        value: Binding(
                            get: { Double(contextLength) },
                            set: { contextLength = Int($0) }
                        ),
                        in: 512...131072,
                        step: 512
                    )
                    .tint(Color.theme.primary)

                    // Quick presets
                    HStack(spacing: .spacing.sm) {
                        ForEach([4096, 8192, 16384, 32768, 65536, 131072], id: \.self) { size in
                            Button(formatCompact(size)) {
                                contextLength = size
                            }
                            .font(.theme.caption)
                            .padding(.horizontal, .spacing.sm)
                            .padding(.vertical, .spacing.xs)
                            .background(contextLength == size ? Color.theme.primary : Color.theme.backgroundTertiary)
                            .foregroundStyle(contextLength == size ? .white : Color.theme.foreground)
                            .clipShape(RoundedRectangle(cornerRadius: .radius.sm))
                        }
                    }
                }
            }
            .padding(.spacing.lg)
            .background(Color.theme.card)
            .clipShape(RoundedRectangle(cornerRadius: .radius.md))
        }
    }

    // MARK: - Advanced Parameters Section

    private var advancedParametersSection: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            Label("Architecture Details", systemImage: "cpu")
                .font(.theme.headline)
                .foregroundStyle(Color.theme.foreground)

            VStack(spacing: .spacing.md) {
                HStack(spacing: .spacing.lg) {
                    calcNumberField(label: "Layers", value: $numLayers, range: 1...200)
                    calcNumberField(label: "KV Heads", value: $numKvHeads, range: 1...128)
                }

                HStack(spacing: .spacing.lg) {
                    calcNumberField(label: "Hidden Size", value: $hiddenSize, range: 512...16384)
                    calcNumberField(label: "Head Dim", value: $headDim, range: 32...256)
                }

                // Auto-detect info
                HStack {
                    Image(systemName: "info.circle")
                        .font(.caption)
                    Text("These values are typically auto-detected from model config")
                        .font(.theme.caption2)
                }
                .foregroundStyle(Color.theme.mutedForeground)
            }
            .padding(.spacing.lg)
            .background(Color.theme.card)
            .clipShape(RoundedRectangle(cornerRadius: .radius.md))
        }
    }

    // MARK: - GPU Config Section

    private var gpuConfigSection: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            Label("GPU Configuration", systemImage: "desktopcomputer")
                .font(.theme.headline)
                .foregroundStyle(Color.theme.foreground)

            VStack(spacing: .spacing.md) {
                // Number of GPUs
                HStack {
                    Text("Number of GPUs")
                        .font(.theme.body)
                        .foregroundStyle(Color.theme.foreground)
                    Spacer()
                    Stepper("\(numGpus)", value: $numGpus, in: 1...8)
                }

                // GPU VRAM
                VStack(alignment: .leading, spacing: .spacing.xs) {
                    HStack {
                        Text("VRAM per GPU")
                            .font(.theme.caption)
                            .foregroundStyle(Color.theme.mutedForeground)
                        Spacer()
                        Text(String(format: "%.0f GB", gpuVramGb))
                            .font(.theme.body.weight(.semibold))
                            .foregroundStyle(Color.theme.primary)
                    }

                    // Quick presets
                    HStack(spacing: .spacing.sm) {
                        ForEach([16, 24, 40, 48, 80], id: \.self) { size in
                            Button("\(size)GB") {
                                gpuVramGb = Double(size)
                            }
                            .font(.theme.caption)
                            .padding(.horizontal, .spacing.sm)
                            .padding(.vertical, .spacing.xs)
                            .background(gpuVramGb == Double(size) ? Color.theme.primary : Color.theme.backgroundTertiary)
                            .foregroundStyle(gpuVramGb == Double(size) ? .white : Color.theme.foreground)
                            .clipShape(RoundedRectangle(cornerRadius: .radius.sm))
                        }
                    }
                }

                // Batch size
                HStack {
                    Text("Max Batch Size")
                        .font(.theme.body)
                        .foregroundStyle(Color.theme.foreground)
                    Spacer()
                    Stepper("\(batchSize)", value: $batchSize, in: 1...64)
                }
            }
            .padding(.spacing.lg)
            .background(Color.theme.card)
            .clipShape(RoundedRectangle(cornerRadius: .radius.md))
        }
    }

    // MARK: - Breakdown Section

    private var breakdownSection: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            Label("Memory Breakdown", systemImage: "chart.pie")
                .font(.theme.headline)
                .foregroundStyle(Color.theme.foreground)

            VStack(spacing: 0) {
                breakdownRow(
                    label: "Model Weights",
                    value: calculation.modelWeightsGb,
                    color: Color(hex: "#60a5fa")
                )
                breakdownRow(
                    label: "KV Cache",
                    value: calculation.kvCacheGb,
                    color: Color(hex: "#f472b6")
                )
                breakdownRow(
                    label: "Activations",
                    value: calculation.activationsGb,
                    color: Color(hex: "#4ade80")
                )
                breakdownRow(
                    label: "Overhead",
                    value: calculation.overheadGb,
                    color: Color(hex: "#fbbf24"),
                    isLast: true
                )
            }
            .background(Color.theme.card)
            .clipShape(RoundedRectangle(cornerRadius: .radius.md))
        }
    }

    private func breakdownRow(label: String, value: Double, color: Color, isLast: Bool = false) -> some View {
        HStack {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)

            Text(label)
                .font(.theme.body)
                .foregroundStyle(Color.theme.mutedForeground)

            Spacer()

            Text(String(format: "%.2f GB", value))
                .font(.theme.body.weight(.medium))
                .foregroundStyle(Color.theme.foreground)
        }
        .padding(.horizontal, .spacing.lg)
        .padding(.vertical, .spacing.md)
        .overlay(alignment: .bottom) {
            if !isLast {
                Divider().background(Color.theme.border)
            }
        }
    }

    // MARK: - Recommendations Section

    private var recommendationsSection: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            Label("Recommendations", systemImage: "lightbulb")
                .font(.theme.headline)
                .foregroundStyle(Color.theme.foreground)

            VStack(alignment: .leading, spacing: .spacing.sm) {
                ForEach(recommendations, id: \.self) { rec in
                    HStack(alignment: .top, spacing: .spacing.sm) {
                        Image(systemName: "chevron.right")
                            .font(.caption2)
                            .foregroundStyle(Color.theme.primary)
                        Text(rec)
                            .font(.theme.caption)
                            .foregroundStyle(Color.theme.mutedForeground)
                    }
                }
            }
            .padding(.spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.theme.card)
            .clipShape(RoundedRectangle(cornerRadius: .radius.md))
        }
    }

    // MARK: - Helper Views

    private func calcNumberField(label: String, value: Binding<Int>, range: ClosedRange<Int>) -> some View {
        VStack(alignment: .leading, spacing: .spacing.xs) {
            Text(label)
                .font(.theme.caption)
                .foregroundStyle(Color.theme.mutedForeground)

            TextField("", value: value, format: .number)
                .font(.theme.body)
                .foregroundStyle(Color.theme.foreground)
                .keyboardType(.numberPad)
                .padding(.spacing.sm)
                .background(Color.theme.backgroundTertiary)
                .clipShape(RoundedRectangle(cornerRadius: .radius.sm))
        }
    }

    // MARK: - Calculations

    private var calculation: VRAMCalculation {
        let bytesPerParam = precision.bytesPerParam

        // Model weights
        let modelWeightsGb = (modelSizeB * 1e9 * bytesPerParam) / (1024 * 1024 * 1024)

        // KV cache: 2 * num_layers * 2 * num_kv_heads * head_dim * context_length * batch_size * bytes_per_param
        let kvCacheBytes = Double(2 * numLayers * 2 * numKvHeads * headDim * contextLength * batchSize) * bytesPerParam
        let kvCacheGb = kvCacheBytes / (1024 * 1024 * 1024)

        // Activations (rough estimate: 10% of model size)
        let activationsGb = modelWeightsGb * 0.1

        // Overhead (CUDA context, etc.: ~1-2 GB)
        let overheadGb = 1.5

        let totalGb = modelWeightsGb + kvCacheGb + activationsGb + overheadGb
        let perGpuGb = totalGb / Double(numGpus)
        let totalAvailableGb = gpuVramGb * Double(numGpus)
        let fitsInVram = perGpuGb <= gpuVramGb
        let utilizationPercent = (totalGb / totalAvailableGb) * 100

        return VRAMCalculation(
            modelWeightsGb: modelWeightsGb,
            kvCacheGb: kvCacheGb,
            activationsGb: activationsGb,
            overheadGb: overheadGb,
            totalGb: totalGb,
            perGpuGb: perGpuGb,
            fitsInVram: fitsInVram,
            utilizationPercent: min(utilizationPercent, 100)
        )
    }

    private var fitsColor: Color {
        let util = calculation.utilizationPercent
        if util <= 70 {
            return Color.theme.success
        } else if util <= 90 {
            return Color.theme.warning
        } else if calculation.fitsInVram {
            return Color.theme.warning
        } else {
            return Color.theme.error
        }
    }

    private var fitsMessage: String {
        if calculation.fitsInVram {
            let util = calculation.utilizationPercent
            if util <= 70 {
                return "Fits comfortably with room to spare"
            } else if util <= 90 {
                return "Fits but memory is tight"
            } else {
                return "May work but very tight on memory"
            }
        } else {
            return "Does not fit - increase GPUs or reduce precision"
        }
    }

    private var recommendations: [String] {
        var recs: [String] = []

        if !calculation.fitsInVram {
            recs.append("Add more GPUs or use a smaller precision/quantization")
        }

        if calculation.utilizationPercent > 85 && calculation.fitsInVram {
            recs.append("Consider reducing context length for more headroom")
        }

        if precision == .fp32 {
            recs.append("FP16 or BF16 will halve memory with minimal quality loss")
        }

        if precision == .fp16 && !calculation.fitsInVram {
            recs.append("Try 4-bit or 8-bit quantization (AWQ, GPTQ)")
        }

        if numGpus > 1 {
            recs.append("Use tensor parallelism for multi-GPU inference")
        }

        if contextLength > 32768 {
            recs.append("Long contexts benefit from prefix caching")
        }

        if recs.isEmpty {
            recs.append("Configuration looks good for inference")
        }

        return recs
    }

    // MARK: - Formatters

    private func formatNumber(_ num: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: num)) ?? "\(num)"
    }

    private func formatCompact(_ num: Int) -> String {
        if num >= 1000 {
            return "\(num / 1024)K"
        }
        return "\(num)"
    }
}

// MARK: - Precision Enum

enum Precision: String, CaseIterable {
    case fp32 = "FP32"
    case fp16 = "FP16"
    case bf16 = "BF16"
    case int8 = "INT8"
    case int4 = "4-bit"

    var displayName: String { rawValue }

    var bytesPerParam: Double {
        switch self {
        case .fp32: return 4.0
        case .fp16, .bf16: return 2.0
        case .int8: return 1.0
        case .int4: return 0.5
        }
    }
}

// MARK: - VRAM Calculation

struct VRAMCalculation {
    let modelWeightsGb: Double
    let kvCacheGb: Double
    let activationsGb: Double
    let overheadGb: Double
    let totalGb: Double
    let perGpuGb: Double
    let fitsInVram: Bool
    let utilizationPercent: Double
}

// MARK: - Preview

#Preview {
    VRAMCalculator()
}
