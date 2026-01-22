import SwiftUI

/// Container component for displaying a message with role-based styling
struct MessageBubble: View {
    let message: Message
    let isStreaming: Bool
    let artifactsEnabled: Bool
    let selectedModel: String?
    var onFork: (() -> Void)?
    var onReprompt: (() -> Void)?

    @State private var copied = false
    @State private var showActions = false

    var body: some View {
        Group {
            switch message.role {
            case .user:
                UserMessageView(
                    message: message,
                    copied: copied,
                    onCopy: copyContent,
                    onExport: exportMessage
                )

            case .assistant:
                AssistantMessageView(
                    message: message,
                    isStreaming: isStreaming,
                    artifactsEnabled: artifactsEnabled,
                    selectedModel: selectedModel,
                    copied: copied,
                    onCopy: copyContent,
                    onFork: onFork,
                    onReprompt: onReprompt,
                    onExport: exportMessage
                )

            case .system:
                SystemMessageView(message: message)
            }
        }
        .id(message.id)
    }

    // MARK: - Actions

    private func copyContent() {
        UIPasteboard.general.string = message.content
        copied = true

        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            copied = false
        }
    }

    private func exportMessage() {
        // Create activity items for sharing
        let text = formatMessageForExport()
        let activityVC = UIActivityViewController(
            activityItems: [text],
            applicationActivities: nil
        )

        // Present the share sheet
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first,
           let rootVC = window.rootViewController {
            rootVC.present(activityVC, animated: true)
        }
    }

    private func formatMessageForExport() -> String {
        var export = ""

        if message.role == .user {
            export += "**You:**\n"
        } else {
            export += "**\(message.modelName ?? "Assistant"):**\n"
        }

        export += message.content

        if let tokens = message.totalTokens {
            export += "\n\n_Tokens: \(tokens)_"
        }

        return export
    }
}

// MARK: - System Message View

struct SystemMessageView: View {
    let message: Message

    var body: some View {
        HStack {
            Spacer()

            Text(message.content)
                .font(.theme.caption)
                .foregroundStyle(Color.theme.mutedForeground)
                .padding(.horizontal, .spacing.md)
                .padding(.vertical, .spacing.sm)
                .background(Color.theme.backgroundSecondary.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: .radius.sm))

            Spacer()
        }
    }
}

// MARK: - Message Actions Menu

struct MessageActionsMenu: View {
    let message: Message
    let onCopy: () -> Void
    let onFork: (() -> Void)?
    let onReprompt: (() -> Void)?
    let onExport: () -> Void

    var body: some View {
        Menu {
            Button(action: onCopy) {
                Label("Copy", systemImage: "doc.on.doc")
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
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 14))
                .foregroundStyle(Color.theme.mutedForeground)
                .frame(width: 28, height: 28)
                .contentShape(Rectangle())
        }
    }
}

// MARK: - Message Timestamp

struct MessageTimestamp: View {
    let date: Date

    private var timeString: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    var body: some View {
        Text(timeString)
            .font(.theme.caption2)
            .foregroundStyle(Color.theme.mutedForeground.opacity(0.7))
    }
}

// MARK: - Token Count Badge

struct TokenCountBadge: View {
    let count: Int

    var body: some View {
        Text("\(formatCount(count)) tok")
            .font(.system(size: 10, weight: .medium, design: .monospaced))
            .foregroundStyle(Color.theme.mutedForeground)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color.theme.backgroundSecondary)
            .clipShape(Capsule())
    }

    private func formatCount(_ count: Int) -> String {
        if count >= 1000 {
            return String(format: "%.1fk", Double(count) / 1000)
        }
        return "\(count)"
    }
}

// MARK: - Streaming Indicator

struct StreamingIndicator: View {
    @State private var dotCount = 0

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Color.theme.primary)
                    .frame(width: 6, height: 6)
                    .opacity(dotCount == index ? 1.0 : 0.3)
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 0.4).repeatForever()) {
                startAnimation()
            }
        }
    }

    private func startAnimation() {
        Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { _ in
            dotCount = (dotCount + 1) % 3
        }
    }
}

// MARK: - Typing Indicator

struct TypingIndicator: View {
    @State private var phase: Int = 0

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Color.theme.mutedForeground)
                    .frame(width: 8, height: 8)
                    .scaleEffect(phase == index ? 1.2 : 0.8)
                    .animation(
                        .easeInOut(duration: 0.4)
                            .repeatForever()
                            .delay(Double(index) * 0.15),
                        value: phase
                    )
            }
        }
        .onAppear {
            phase = 0
            Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { _ in
                phase = (phase + 1) % 3
            }
        }
    }
}

// MARK: - Preview

#Preview("User Message") {
    VStack {
        MessageBubble(
            message: Message.previewUser,
            isStreaming: false,
            artifactsEnabled: false,
            selectedModel: nil
        )
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("Assistant Message") {
    VStack {
        MessageBubble(
            message: Message.previewAssistant,
            isStreaming: false,
            artifactsEnabled: true,
            selectedModel: "Qwen2.5-72B-Instruct"
        )
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("Streaming") {
    VStack {
        MessageBubble(
            message: Message(role: .assistant, content: "Thinking about your question...", isStreaming: true),
            isStreaming: true,
            artifactsEnabled: false,
            selectedModel: "Qwen2.5-72B-Instruct"
        )
    }
    .padding()
    .background(Color.theme.background)
}
