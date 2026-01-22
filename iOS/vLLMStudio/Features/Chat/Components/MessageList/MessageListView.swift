import SwiftUI

/// Scrollable list of chat messages with auto-scroll behavior
struct MessageListView: View {
    let messages: [Message]
    let isStreaming: Bool
    let artifactsEnabled: Bool
    let selectedModel: String?
    var onFork: ((Int) -> Void)?
    var onReprompt: (() -> Void)?

    @State private var scrolledToBottom = true
    @State private var showScrollToBottom = false

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: .spacing.lg) {
                    ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                        MessageBubble(
                            message: message,
                            isStreaming: isStreaming && index == messages.count - 1,
                            artifactsEnabled: artifactsEnabled,
                            selectedModel: selectedModel,
                            onFork: onFork != nil ? { onFork?(index) } : nil,
                            onReprompt: message.role == .assistant && index == messages.count - 1 ? onReprompt : nil
                        )
                        .id(message.id)
                    }

                    // Anchor for scrolling to bottom
                    Color.clear
                        .frame(height: 1)
                        .id("bottom")
                }
                .padding(.horizontal, .spacing.lg)
                .padding(.top, .spacing.lg)
                .padding(.bottom, .spacing.xxl)
            }
            .scrollIndicators(.hidden)
            .background(
                GeometryReader { geometry in
                    Color.clear
                        .preference(
                            key: ScrollOffsetPreferenceKey.self,
                            value: geometry.frame(in: .named("scroll")).minY
                        )
                }
            )
            .coordinateSpace(name: "scroll")
            .onPreferenceChange(ScrollOffsetPreferenceKey.self) { value in
                // Show scroll button when user has scrolled up
                withAnimation(.easeInOut(duration: 0.2)) {
                    showScrollToBottom = value < -100
                }
            }
            .onChange(of: messages.count) { _, _ in
                if scrolledToBottom {
                    scrollToBottom(proxy: proxy)
                }
            }
            .onChange(of: messages.last?.content) { _, _ in
                if scrolledToBottom {
                    scrollToBottom(proxy: proxy)
                }
            }
            .overlay(alignment: .bottom) {
                if showScrollToBottom {
                    ScrollToBottomButton {
                        scrolledToBottom = true
                        scrollToBottom(proxy: proxy)
                    }
                    .padding(.bottom, .spacing.lg)
                    .transition(.scale.combined(with: .opacity))
                }
            }
        }
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        withAnimation(.easeOut(duration: 0.3)) {
            proxy.scrollTo("bottom", anchor: .bottom)
        }
    }
}

// MARK: - Scroll Offset Preference Key

private struct ScrollOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

// MARK: - Scroll to Bottom Button

private struct ScrollToBottomButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "arrow.down")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.theme.foreground)
                .frame(width: 36, height: 36)
                .background(Color.theme.backgroundSecondary)
                .clipShape(Circle())
                .shadow(color: .black.opacity(0.3), radius: 4, y: 2)
        }
    }
}

// MARK: - Empty State

struct MessageListEmptyState: View {
    var body: some View {
        VStack(spacing: .spacing.lg) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 48))
                .foregroundStyle(Color.theme.mutedForeground.opacity(0.5))

            VStack(spacing: .spacing.sm) {
                Text("Start a Conversation")
                    .font(.theme.headline)
                    .foregroundStyle(Color.theme.foreground)

                Text("Send a message to begin chatting with the AI assistant.")
                    .font(.theme.body)
                    .foregroundStyle(Color.theme.mutedForeground)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.spacing.xl)
    }
}

// MARK: - Loading State

struct MessageListLoadingState: View {
    var body: some View {
        VStack(spacing: .spacing.md) {
            ProgressView()
                .tint(Color.theme.primary)

            Text("Loading messages...")
                .font(.theme.caption)
                .foregroundStyle(Color.theme.mutedForeground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Error State

struct MessageListErrorState: View {
    let error: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: .spacing.lg) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(Color.theme.error)

            VStack(spacing: .spacing.sm) {
                Text("Failed to Load Messages")
                    .font(.theme.headline)
                    .foregroundStyle(Color.theme.foreground)

                Text(error)
                    .font(.theme.body)
                    .foregroundStyle(Color.theme.mutedForeground)
                    .multilineTextAlignment(.center)
            }

            Button("Try Again", action: onRetry)
                .buttonStyle(PrimaryButtonStyle())
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.spacing.xl)
    }
}

// MARK: - Primary Button Style

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.theme.body.weight(.medium))
            .foregroundStyle(Color.theme.foreground)
            .padding(.horizontal, .spacing.lg)
            .padding(.vertical, .spacing.md)
            .background(Color.theme.primary)
            .clipShape(RoundedRectangle(cornerRadius: .radius.md))
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - Preview

#Preview("Message List") {
    MessageListView(
        messages: [Message.previewUser, Message.previewAssistant],
        isStreaming: false,
        artifactsEnabled: true,
        selectedModel: "Qwen2.5-72B-Instruct"
    )
    .background(Color.theme.background)
}

#Preview("Empty State") {
    MessageListEmptyState()
        .background(Color.theme.background)
}

#Preview("Error State") {
    MessageListErrorState(
        error: "Network connection failed",
        onRetry: {}
    )
    .background(Color.theme.background)
}
