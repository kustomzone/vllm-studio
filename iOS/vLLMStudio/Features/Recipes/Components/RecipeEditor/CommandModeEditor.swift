import SwiftUI

// MARK: - Command Mode Editor

struct CommandModeEditor: View {
    // MARK: - Properties

    @Binding var commandText: String
    var onParse: () -> Void

    @State private var showingHelp = false
    @FocusState private var isEditorFocused: Bool

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Toolbar
            editorToolbar

            // Editor
            ScrollView {
                VStack(alignment: .leading, spacing: .spacing.md) {
                    // Description
                    descriptionCard

                    // Command editor
                    commandEditor

                    // Help section
                    if showingHelp {
                        helpSection
                    }
                }
                .padding(.spacing.lg)
            }
        }
        .background(Color.theme.background)
    }

    // MARK: - Editor Toolbar

    private var editorToolbar: some View {
        HStack(spacing: .spacing.md) {
            // Parse button
            Button {
                onParse()
            } label: {
                Label("Parse to Form", systemImage: "arrow.right.square")
                    .font(.theme.caption)
            }
            .buttonStyle(.bordered)
            .tint(Color.theme.primary)

            Spacer()

            // Copy button
            Button {
                UIPasteboard.general.string = commandText
            } label: {
                Image(systemName: "doc.on.doc")
                    .font(.theme.body)
            }
            .buttonStyle(.plain)
            .foregroundStyle(Color.theme.mutedForeground)

            // Paste button
            Button {
                if let pastedText = UIPasteboard.general.string {
                    commandText = pastedText
                }
            } label: {
                Image(systemName: "doc.on.clipboard")
                    .font(.theme.body)
            }
            .buttonStyle(.plain)
            .foregroundStyle(Color.theme.mutedForeground)

            // Help button
            Button {
                withAnimation {
                    showingHelp.toggle()
                }
            } label: {
                Image(systemName: showingHelp ? "questionmark.circle.fill" : "questionmark.circle")
                    .font(.theme.body)
            }
            .buttonStyle(.plain)
            .foregroundStyle(showingHelp ? Color.theme.primary : Color.theme.mutedForeground)
        }
        .padding(.horizontal, .spacing.lg)
        .padding(.vertical, .spacing.md)
        .background(Color.theme.backgroundSecondary)
    }

    // MARK: - Description Card

    private var descriptionCard: some View {
        VStack(alignment: .leading, spacing: .spacing.sm) {
            Label("Command Mode", systemImage: "terminal")
                .font(.theme.headline)
                .foregroundStyle(Color.theme.foreground)

            Text("Edit the raw vLLM/SGLang launch command directly. Changes will be parsed into form fields when you switch tabs.")
                .font(.theme.caption)
                .foregroundStyle(Color.theme.mutedForeground)
        }
        .padding(.spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.theme.card)
        .clipShape(RoundedRectangle(cornerRadius: .radius.md))
    }

    // MARK: - Command Editor

    private var commandEditor: some View {
        VStack(alignment: .leading, spacing: .spacing.sm) {
            // Header
            HStack {
                Text("Launch Command")
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)

                Spacer()

                Text("\(commandText.count) characters")
                    .font(.theme.caption2)
                    .foregroundStyle(Color.theme.mutedForeground)
            }

            // Text editor with syntax-like styling
            ZStack(alignment: .topLeading) {
                // Syntax highlighted view (background)
                syntaxHighlightedView
                    .allowsHitTesting(false)

                // Actual text editor (transparent)
                TextEditor(text: $commandText)
                    .font(.system(size: 13, weight: .regular, design: .monospaced))
                    .foregroundStyle(Color.clear) // Hidden but interactive
                    .scrollContentBackground(.hidden)
                    .background(Color.clear)
                    .focused($isEditorFocused)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
            }
            .padding(.spacing.md)
            .frame(minHeight: 300)
            .background(Color.theme.card)
            .clipShape(RoundedRectangle(cornerRadius: .radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: .radius.md)
                    .stroke(
                        isEditorFocused ? Color.theme.primary : Color.theme.border,
                        lineWidth: isEditorFocused ? 2 : 1
                    )
            )
        }
    }

    // MARK: - Syntax Highlighted View

    private var syntaxHighlightedView: some View {
        Text(attributedCommand)
            .font(.system(size: 13, weight: .regular, design: .monospaced))
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var attributedCommand: AttributedString {
        var result = AttributedString(commandText)

        // Default foreground color
        result.foregroundColor = Color.theme.foreground

        // Highlight patterns
        let patterns: [(pattern: String, color: Color)] = [
            // Environment variables
            ("CUDA_VISIBLE_DEVICES=[0-9,]+", Color(hex: "#a3e635")),
            // Commands
            ("vllm serve|python -m sglang\\.launch_server", Color(hex: "#60a5fa")),
            // Flags
            ("--[a-z-]+", Color(hex: "#f472b6")),
            // Numbers
            ("\\b[0-9]+\\.?[0-9]*\\b", Color(hex: "#fbbf24")),
            // Paths
            ("/[^\\s]+", Color(hex: "#4ade80")),
            // Line continuations
            ("\\\\$", Color.theme.mutedForeground),
        ]

        for (pattern, color) in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
                let nsString = commandText as NSString
                let matches = regex.matches(in: commandText, options: [], range: NSRange(location: 0, length: nsString.length))

                for match in matches {
                    if let range = Range(match.range, in: commandText),
                       let attrRange = Range(range, in: result) {
                        result[attrRange].foregroundColor = color
                    }
                }
            }
        }

        return result
    }

    // MARK: - Help Section

    private var helpSection: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            Text("Command Syntax Help")
                .font(.theme.headline)
                .foregroundStyle(Color.theme.foreground)

            VStack(alignment: .leading, spacing: .spacing.sm) {
                helpItem(title: "vLLM Format", code: "vllm serve /path/to/model --flag value")
                helpItem(title: "SGLang Format", code: "python -m sglang.launch_server --model-path /path/to/model")
                helpItem(title: "Multi-GPU", code: "CUDA_VISIBLE_DEVICES=0,1,2,3")
                helpItem(title: "Line Continuation", code: "Use \\ at end of line")
            }

            Divider()
                .background(Color.theme.border)

            Text("Common Flags")
                .font(.theme.body.weight(.semibold))
                .foregroundStyle(Color.theme.foreground)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: .spacing.sm) {
                flagItem("--tensor-parallel-size", "GPU count for TP")
                flagItem("--max-model-len", "Context length")
                flagItem("--gpu-memory-utilization", "VRAM usage (0-1)")
                flagItem("--dtype", "Data type")
                flagItem("--quantization", "Quantization method")
                flagItem("--trust-remote-code", "Allow custom code")
                flagItem("--tool-call-parser", "Tool calling format")
                flagItem("--reasoning-parser", "Reasoning format")
            }
        }
        .padding(.spacing.lg)
        .background(Color.theme.card)
        .clipShape(RoundedRectangle(cornerRadius: .radius.md))
    }

    private func helpItem(title: String, code: String) -> some View {
        VStack(alignment: .leading, spacing: .spacing.xxs) {
            Text(title)
                .font(.theme.caption)
                .foregroundStyle(Color.theme.mutedForeground)
            Text(code)
                .font(.theme.code)
                .foregroundStyle(Color.theme.foreground)
                .padding(.horizontal, .spacing.sm)
                .padding(.vertical, .spacing.xs)
                .background(Color.theme.backgroundTertiary)
                .clipShape(RoundedRectangle(cornerRadius: .radius.sm))
        }
    }

    private func flagItem(_ flag: String, _ description: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(flag)
                .font(.theme.code)
                .foregroundStyle(Color(hex: "#f472b6"))
            Text(description)
                .font(.theme.caption2)
                .foregroundStyle(Color.theme.mutedForeground)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Preview

#Preview {
    CommandModeEditor(
        commandText: .constant("""
            CUDA_VISIBLE_DEVICES=0,1,2,3 \\
            vllm serve /models/meta-llama/Meta-Llama-3-70B-Instruct \\
              --tensor-parallel-size 4 \\
              --dtype bfloat16 \\
              --max-model-len 8192 \\
              --gpu-memory-utilization 0.9 \\
              --tool-call-parser hermes \\
              --enable-auto-tool-choice \\
              --trust-remote-code \\
              --host 0.0.0.0 \\
              --port 8000
            """),
        onParse: {}
    )
    .preferredColorScheme(.dark)
}
