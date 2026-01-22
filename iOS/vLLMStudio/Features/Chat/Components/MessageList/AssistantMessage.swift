import SwiftUI

/// Assistant message display with markdown rendering, code blocks, and thinking sections
struct AssistantMessageView: View {
    let message: Message
    let isStreaming: Bool
    let artifactsEnabled: Bool
    let selectedModel: String?
    let copied: Bool
    let onCopy: () -> Void
    var onFork: (() -> Void)?
    var onReprompt: (() -> Void)?
    let onExport: () -> Void

    @Environment(\.horizontalSizeClass) private var sizeClass

    private var displayModel: String {
        let model = message.modelName ?? selectedModel ?? "Assistant"
        return model.components(separatedBy: "/").last ?? model
    }

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.sm) {
            // Header with model name and actions
            messageHeader

            // Thinking block (collapsible on mobile)
            if message.hasThinking {
                ThinkingBlockView(
                    content: message.thinkingContent ?? "",
                    isActive: isStreaming && message.content.isEmpty
                )
            }

            // Tool calls display
            if message.hasToolCalls {
                ToolCallsView(
                    toolCalls: message.toolCalls ?? [],
                    isStreaming: isStreaming
                )
            }

            // Main content
            if !message.content.isEmpty {
                MarkdownContentView(
                    content: message.content,
                    artifactsEnabled: artifactsEnabled,
                    isStreaming: isStreaming
                )
            } else if isStreaming && !message.hasThinking {
                // Show typing indicator when streaming but no content yet
                HStack(spacing: .spacing.sm) {
                    TypingIndicator()
                    Text("Thinking...")
                        .font(.theme.body)
                        .foregroundStyle(Color.theme.mutedForeground)
                }
            }

            // Streaming cursor
            if isStreaming && !message.content.isEmpty {
                StreamingCursor()
            }
        }
        .contextMenu {
            Button(action: onCopy) {
                Label(copied ? "Copied!" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
            }

            if let onFork = onFork {
                Button(action: onFork) {
                    Label("Fork Conversation", systemImage: "arrow.branch")
                }
            }

            if let onReprompt = onReprompt {
                Button(action: onReprompt) {
                    Label("Regenerate", systemImage: "arrow.clockwise")
                }
            }

            Divider()

            Button(action: onExport) {
                Label("Share", systemImage: "square.and.arrow.up")
            }
        }
    }

    // MARK: - Header

    private var messageHeader: some View {
        HStack(spacing: .spacing.sm) {
            // Model name
            Text(displayModel)
                .font(.system(size: 10, weight: .medium))
                .textCase(.uppercase)
                .tracking(1.5)
                .foregroundStyle(Color.theme.mutedForeground)
                .lineLimit(1)

            // Token count (iPad only)
            if sizeClass == .regular, let tokens = message.totalTokens, tokens > 0 {
                TokenCountBadge(count: tokens)
            }

            Spacer()

            // Actions (iPad only)
            if sizeClass == .regular {
                AssistantMessageActions(
                    copied: copied,
                    isStreaming: isStreaming,
                    onCopy: onCopy,
                    onFork: onFork,
                    onReprompt: onReprompt,
                    onExport: onExport
                )
            }
        }
    }
}

// MARK: - Assistant Message Actions

private struct AssistantMessageActions: View {
    let copied: Bool
    let isStreaming: Bool
    let onCopy: () -> Void
    var onFork: (() -> Void)?
    var onReprompt: (() -> Void)?
    let onExport: () -> Void

    var body: some View {
        HStack(spacing: 2) {
            if let onReprompt = onReprompt {
                ActionButton(
                    icon: "arrow.clockwise",
                    action: onReprompt
                )
                .disabled(isStreaming)
            }

            if let onFork = onFork {
                ActionButton(
                    icon: "arrow.branch",
                    action: onFork
                )
            }

            ActionButton(
                icon: copied ? "checkmark" : "doc.on.doc",
                iconColor: copied ? Color.theme.success : Color.theme.mutedForeground,
                action: onCopy
            )

            ActionButton(
                icon: "square.and.arrow.up",
                action: onExport
            )
        }
        .opacity(0.7)
    }
}

private struct ActionButton: View {
    let icon: String
    var iconColor: Color = Color.theme.mutedForeground
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundStyle(iconColor)
                .frame(width: 24, height: 24)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Thinking Block

struct ThinkingBlockView: View {
    let content: String
    let isActive: Bool

    @State private var isExpanded = false
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.xs) {
            // Header button
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: .spacing.sm) {
                    if isActive {
                        ProgressView()
                            .scaleEffect(0.7)
                            .tint(Color.theme.info)
                    } else {
                        Image(systemName: "brain")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.theme.mutedForeground)
                    }

                    Text(isActive ? "Thinking..." : "Reasoning")
                        .font(.theme.caption)
                        .foregroundStyle(Color.theme.mutedForeground)

                    if !content.isEmpty {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.theme.mutedForeground)
                    }

                    Spacer()
                }
            }
            .buttonStyle(.plain)

            // Expandable content
            if !content.isEmpty && isExpanded {
                ScrollView {
                    Text(content)
                        .font(.theme.caption)
                        .foregroundStyle(Color.theme.mutedForeground)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxHeight: 200)
                .padding(.leading, .spacing.lg)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.spacing.sm)
        .background(Color.theme.backgroundSecondary.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: .radius.sm))
    }
}

// MARK: - Tool Calls View

struct ToolCallsView: View {
    let toolCalls: [ToolCall]
    let isStreaming: Bool

    @State private var isExpanded = false
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var activeTools: [ToolCall] {
        toolCalls.filter { $0.state == .calling || $0.state == .inputStreaming }
    }

    private var hasActiveTools: Bool {
        !activeTools.isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.xs) {
            // Mobile inline view
            if sizeClass == .compact {
                mobileToolsView
            }

            // Desktop detailed view
            if sizeClass == .regular {
                desktopToolsView
            }
        }
    }

    private var mobileToolsView: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                isExpanded.toggle()
            }
        } label: {
            HStack(spacing: .spacing.sm) {
                if hasActiveTools {
                    ProgressView()
                        .scaleEffect(0.7)
                        .tint(Color.theme.warning)
                } else {
                    Image(systemName: "wrench.and.screwdriver")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.theme.mutedForeground)
                }

                Text(hasActiveTools
                    ? "Running \(activeTools.count) tool\(activeTools.count > 1 ? "s" : "")..."
                    : "\(toolCalls.count) tool\(toolCalls.count > 1 ? "s" : "")")
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)

                Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.theme.mutedForeground)

                Spacer()
            }
        }
        .buttonStyle(.plain)

        if isExpanded {
            VStack(alignment: .leading, spacing: .spacing.xs) {
                ForEach(toolCalls) { tool in
                    ToolCallRow(toolCall: tool)
                }
            }
            .padding(.leading, .spacing.lg)
            .transition(.opacity.combined(with: .move(edge: .top)))
        }
    }

    private var desktopToolsView: some View {
        VStack(alignment: .leading, spacing: .spacing.xs) {
            ForEach(toolCalls) { tool in
                ToolCallRow(toolCall: tool)
            }
        }
        .padding(.top, .spacing.sm)
    }
}

private struct ToolCallRow: View {
    let toolCall: ToolCall

    private var isRunning: Bool {
        toolCall.state == .calling || toolCall.state == .inputStreaming
    }

    private var isComplete: Bool {
        toolCall.state == .complete
    }

    private var isError: Bool {
        toolCall.state == .error || (toolCall.result?.isError ?? false)
    }

    var body: some View {
        HStack(spacing: .spacing.sm) {
            // Status indicator
            Group {
                if isRunning {
                    ProgressView()
                        .scaleEffect(0.6)
                        .tint(Color.theme.warning)
                } else if isComplete {
                    Image(systemName: isError ? "xmark.circle.fill" : "checkmark.circle.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(isError ? Color.theme.error : Color.theme.success)
                } else {
                    Circle()
                        .fill(Color.theme.mutedForeground.opacity(0.5))
                        .frame(width: 8, height: 8)
                }
            }
            .frame(width: 16)

            // Tool name
            Text(toolCall.function.name)
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(Color.theme.mutedForeground)

            // Status text
            if isRunning {
                Text("calling...")
                    .font(.theme.caption2)
                    .foregroundStyle(Color.theme.mutedForeground.opacity(0.7))
            } else if isComplete {
                Text("complete")
                    .font(.theme.caption2)
                    .foregroundStyle(Color.theme.mutedForeground.opacity(0.7))
            }
        }
    }
}

// MARK: - Markdown Content View

struct MarkdownContentView: View {
    let content: String
    let artifactsEnabled: Bool
    let isStreaming: Bool

    var body: some View {
        // Parse and render markdown content
        VStack(alignment: .leading, spacing: .spacing.md) {
            ForEach(parseContent(), id: \.id) { segment in
                switch segment.type {
                case .text:
                    MarkdownTextView(text: segment.content)

                case .code:
                    CodeBlockView(
                        code: segment.content,
                        language: segment.language ?? "plaintext",
                        artifactsEnabled: artifactsEnabled
                    )
                }
            }
        }
    }

    private func parseContent() -> [ContentSegment] {
        var segments: [ContentSegment] = []
        var currentText = ""
        var inCodeBlock = false
        var codeBlockContent = ""
        var codeBlockLanguage: String?

        let lines = content.components(separatedBy: .newlines)

        for line in lines {
            if line.hasPrefix("```") {
                if inCodeBlock {
                    // End of code block
                    segments.append(ContentSegment(
                        type: .code,
                        content: codeBlockContent.trimmingCharacters(in: .whitespacesAndNewlines),
                        language: codeBlockLanguage
                    ))
                    codeBlockContent = ""
                    codeBlockLanguage = nil
                    inCodeBlock = false
                } else {
                    // Start of code block
                    if !currentText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        segments.append(ContentSegment(type: .text, content: currentText))
                        currentText = ""
                    }
                    codeBlockLanguage = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                    if codeBlockLanguage?.isEmpty == true {
                        codeBlockLanguage = nil
                    }
                    inCodeBlock = true
                }
            } else if inCodeBlock {
                codeBlockContent += (codeBlockContent.isEmpty ? "" : "\n") + line
            } else {
                currentText += (currentText.isEmpty ? "" : "\n") + line
            }
        }

        // Add remaining text
        if inCodeBlock {
            // Unclosed code block (streaming)
            segments.append(ContentSegment(
                type: .code,
                content: codeBlockContent,
                language: codeBlockLanguage
            ))
        } else if !currentText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            segments.append(ContentSegment(type: .text, content: currentText))
        }

        return segments
    }
}

private struct ContentSegment: Identifiable {
    let id = UUID()
    let type: SegmentType
    let content: String
    var language: String?

    enum SegmentType {
        case text
        case code
    }
}

// MARK: - Markdown Text View

struct MarkdownTextView: View {
    let text: String

    var body: some View {
        Text(attributedText)
            .font(.system(size: 15))
            .foregroundStyle(Color.theme.foreground)
            .lineSpacing(4)
            .textSelection(.enabled)
    }

    private var attributedText: AttributedString {
        // Simple markdown parsing for headers, bold, italic, code
        var result = AttributedString(text)

        // Parse inline code
        if let regex = try? NSRegularExpression(pattern: "`([^`]+)`", options: []) {
            let nsString = text as NSString
            let matches = regex.matches(in: text, options: [], range: NSRange(location: 0, length: nsString.length))

            for match in matches.reversed() {
                if let range = Range(match.range, in: text),
                   let attrRange = Range(range, in: result) {
                    result[attrRange].font = .system(size: 13, design: .monospaced)
                    result[attrRange].backgroundColor = Color.theme.backgroundSecondary
                }
            }
        }

        return result
    }
}

// MARK: - Code Block View

struct CodeBlockView: View {
    let code: String
    let language: String
    let artifactsEnabled: Bool

    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header with language and actions
            HStack {
                Text(language)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(Color.theme.mutedForeground)

                Spacer()

                Button {
                    UIPasteboard.general.string = code
                    copied = true
                    Task {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        copied = false
                    }
                } label: {
                    Image(systemName: copied ? "checkmark" : "doc.on.doc")
                        .font(.system(size: 12))
                        .foregroundStyle(copied ? Color.theme.success : Color.theme.mutedForeground)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .background(Color.theme.backgroundTertiary)

            // Code content
            ScrollView(.horizontal, showsIndicators: false) {
                Text(code)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundStyle(Color.theme.foreground)
                    .textSelection(.enabled)
                    .padding(.spacing.md)
            }
            .background(Color.theme.card)
        }
        .clipShape(RoundedRectangle(cornerRadius: .radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: .radius.md)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }
}

// MARK: - Streaming Cursor

struct StreamingCursor: View {
    @State private var visible = true

    var body: some View {
        Rectangle()
            .fill(Color.theme.primary)
            .frame(width: 2, height: 16)
            .opacity(visible ? 1 : 0)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.5).repeatForever()) {
                    visible.toggle()
                }
            }
    }
}

// MARK: - Preview

#Preview("Assistant Message") {
    ScrollView {
        AssistantMessageView(
            message: Message.previewAssistant,
            isStreaming: false,
            artifactsEnabled: true,
            selectedModel: "Qwen2.5-72B-Instruct",
            copied: false,
            onCopy: {},
            onFork: {},
            onReprompt: {},
            onExport: {}
        )
        .padding()
    }
    .background(Color.theme.background)
}

#Preview("With Tool Calls") {
    ScrollView {
        AssistantMessageView(
            message: Message.previewWithToolCall,
            isStreaming: false,
            artifactsEnabled: false,
            selectedModel: "Qwen2.5-72B-Instruct",
            copied: false,
            onCopy: {},
            onExport: {}
        )
        .padding()
    }
    .background(Color.theme.background)
}

#Preview("Streaming") {
    AssistantMessageView(
        message: Message(
            role: .assistant,
            content: "Let me think about that...",
            isStreaming: true,
            thinkingContent: "The user is asking about Swift concurrency. I should explain async/await, Tasks, and actors."
        ),
        isStreaming: true,
        artifactsEnabled: false,
        selectedModel: "Qwen2.5-72B-Instruct",
        copied: false,
        onCopy: {},
        onExport: {}
    )
    .padding()
    .background(Color.theme.background)
}
