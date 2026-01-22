import SwiftUI

// MARK: - Thinking Block

/// A collapsible section for displaying AI thinking/reasoning content
struct ThinkingBlock: View {
    let content: String
    let isStreaming: Bool
    let showWordCount: Bool

    @State private var isExpanded = false
    @State private var animationPhase = 0.0

    init(
        content: String,
        isStreaming: Bool = false,
        showWordCount: Bool = true
    ) {
        self.content = content
        self.isStreaming = isStreaming
        self.showWordCount = showWordCount
    }

    private var wordCount: Int {
        content.split(separator: " ").count
    }

    private var formattedWordCount: String {
        if wordCount < 1000 {
            return "\(wordCount) words"
        } else {
            let thousands = Double(wordCount) / 1000.0
            return String(format: "%.1fk words", thousands)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            headerView
                .contentShape(Rectangle())
                .onTapGesture {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        isExpanded.toggle()
                    }
                }

            // Content (when expanded)
            if isExpanded {
                contentView
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .background(Color.theme.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: .radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: .radius.md)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }

    // MARK: - Header View

    private var headerView: some View {
        HStack(spacing: .spacing.sm) {
            // Brain icon with animation
            ZStack {
                if isStreaming {
                    // Animated thinking indicator
                    Circle()
                        .fill(Color.theme.primary.opacity(0.2))
                        .frame(width: 28, height: 28)
                        .scaleEffect(1.0 + 0.2 * sin(animationPhase))

                    Image(systemName: "brain")
                        .font(.system(size: 14))
                        .foregroundColor(Color.theme.primary)
                        .onAppear {
                            withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: true)) {
                                animationPhase = .pi
                            }
                        }
                } else {
                    Image(systemName: "brain")
                        .font(.system(size: 14))
                        .foregroundColor(Color.theme.mutedForeground)
                }
            }

            // Title
            HStack(spacing: .spacing.xs) {
                Text(isStreaming ? "Thinking..." : "Thinking")
                    .font(.theme.callout)
                    .fontWeight(.medium)
                    .foregroundColor(isStreaming ? Color.theme.primary : Color.theme.mutedForeground)

                if isStreaming {
                    ThinkingDotsView()
                }
            }

            Spacer()

            // Word count badge
            if showWordCount && !content.isEmpty {
                Text(formattedWordCount)
                    .font(.theme.caption2)
                    .foregroundColor(Color.theme.mutedForeground)
                    .padding(.horizontal, .spacing.sm)
                    .padding(.vertical, .spacing.xxs)
                    .background(Color.theme.border)
                    .clipShape(Capsule())
            }

            // Chevron
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(Color.theme.mutedForeground)
                .rotationEffect(.degrees(isExpanded ? 90 : 0))
        }
        .padding(.horizontal, .spacing.md)
        .padding(.vertical, .spacing.sm)
    }

    // MARK: - Content View

    private var contentView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Divider()
                .background(Color.theme.border)

            ScrollView {
                Text(content)
                    .font(.theme.body)
                    .foregroundColor(Color.theme.mutedForeground)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.spacing.md)
            }
            .frame(maxHeight: 300)
        }
    }
}

// MARK: - Thinking Dots Animation

/// Animated dots indicator for streaming state
struct ThinkingDotsView: View {
    @State private var animationPhase = 0

    private let timer = Timer.publish(every: 0.4, on: .main, in: .common).autoconnect()

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Color.theme.primary)
                    .frame(width: 4, height: 4)
                    .opacity(animationPhase == index ? 1.0 : 0.3)
            }
        }
        .onReceive(timer) { _ in
            animationPhase = (animationPhase + 1) % 3
        }
    }
}

// MARK: - Streaming Thinking Block

/// A thinking block specifically designed for streaming content
struct StreamingThinkingBlock: View {
    let content: String
    let startTime: Date

    @State private var elapsedTime: TimeInterval = 0
    @State private var isExpanded = true

    private let timer = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()

    private var formattedElapsedTime: String {
        let seconds = Int(elapsedTime)
        if seconds < 60 {
            return "\(seconds)s"
        } else {
            let minutes = seconds / 60
            let remainingSeconds = seconds % 60
            return "\(minutes)m \(remainingSeconds)s"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(spacing: .spacing.sm) {
                // Animated brain icon
                PulsingBrainIcon()

                Text("Thinking")
                    .font(.theme.callout)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.primary)

                ThinkingDotsView()

                Spacer()

                // Elapsed time
                Text(formattedElapsedTime)
                    .font(.theme.caption)
                    .foregroundColor(Color.theme.mutedForeground)
                    .monospacedDigit()

                // Chevron
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Color.theme.mutedForeground)
                    .rotationEffect(.degrees(isExpanded ? 90 : 0))
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .contentShape(Rectangle())
            .onTapGesture {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    isExpanded.toggle()
                }
            }

            // Content
            if isExpanded && !content.isEmpty {
                Divider()
                    .background(Color.theme.border)

                ScrollView {
                    Text(content)
                        .font(.theme.body)
                        .foregroundColor(Color.theme.mutedForeground)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.spacing.md)
                }
                .frame(maxHeight: 200)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .background(Color.theme.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: .radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: .radius.md)
                .stroke(Color.theme.primary.opacity(0.3), lineWidth: 1)
        )
        .onReceive(timer) { _ in
            elapsedTime = Date().timeIntervalSince(startTime)
        }
    }
}

// MARK: - Pulsing Brain Icon

/// An animated brain icon for the streaming state
struct PulsingBrainIcon: View {
    @State private var scale: CGFloat = 1.0
    @State private var opacity: Double = 0.2

    var body: some View {
        ZStack {
            // Outer pulse
            Circle()
                .fill(Color.theme.primary.opacity(opacity))
                .frame(width: 28, height: 28)
                .scaleEffect(scale)

            // Inner circle
            Circle()
                .fill(Color.theme.primary.opacity(0.3))
                .frame(width: 22, height: 22)

            // Brain icon
            Image(systemName: "brain")
                .font(.system(size: 12))
                .foregroundColor(Color.theme.primary)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                scale = 1.3
                opacity = 0.0
            }
        }
    }
}

// MARK: - Collapsed Thinking Summary

/// A compact summary view for collapsed thinking blocks
struct ThinkingSummary: View {
    let wordCount: Int
    let duration: TimeInterval?

    var body: some View {
        HStack(spacing: .spacing.sm) {
            Image(systemName: "brain")
                .font(.system(size: 12))
                .foregroundColor(Color.theme.mutedForeground)

            Text("Thought for")
                .font(.theme.caption)
                .foregroundColor(Color.theme.mutedForeground)

            if let duration = duration {
                Text(formatDuration(duration))
                    .font(.theme.caption)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.foreground)
            }

            if wordCount > 0 {
                Text("(\(wordCount) words)")
                    .font(.theme.caption)
                    .foregroundColor(Color.theme.mutedForeground)
            }
        }
        .padding(.horizontal, .spacing.md)
        .padding(.vertical, .spacing.sm)
        .background(Color.theme.backgroundSecondary)
        .clipShape(Capsule())
    }

    private func formatDuration(_ duration: TimeInterval) -> String {
        let seconds = Int(duration)
        if seconds < 60 {
            return "\(seconds)s"
        } else {
            let minutes = seconds / 60
            let remainingSeconds = seconds % 60
            return "\(minutes)m \(remainingSeconds)s"
        }
    }
}

// MARK: - Preview

#if DEBUG
struct ThinkingBlock_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Thinking Block (Collapsed)")
                    .font(.headline)
                    .foregroundColor(.white)

                ThinkingBlock(
                    content: sampleThinking,
                    isStreaming: false,
                    showWordCount: true
                )

                Text("Thinking Block (Streaming)")
                    .font(.headline)
                    .foregroundColor(.white)

                ThinkingBlock(
                    content: "Let me analyze this problem step by step...",
                    isStreaming: true,
                    showWordCount: true
                )

                Text("Streaming Thinking Block")
                    .font(.headline)
                    .foregroundColor(.white)

                StreamingThinkingBlock(
                    content: "First, I need to understand the requirements. The user wants to build a responsive dashboard with real-time updates...",
                    startTime: Date().addingTimeInterval(-15)
                )

                Text("Thinking Summary")
                    .font(.headline)
                    .foregroundColor(.white)

                ThinkingSummary(
                    wordCount: 342,
                    duration: 12.5
                )
            }
            .padding()
        }
        .background(Color.theme.background)
        .preferredColorScheme(.dark)
    }

    static let sampleThinking = """
    Let me break down this problem step by step.

    First, I need to understand what the user is asking for. They want to implement a feature that displays code with syntax highlighting in their iOS app.

    The key requirements are:
    1. Support for multiple programming languages
    2. A color scheme that matches the web application
    3. Copy functionality
    4. Optional line numbers

    I'll approach this by creating a SyntaxHighlighter class that tokenizes the code and applies appropriate colors based on the language grammar. Then I'll create a CodeBlock SwiftUI view that uses this highlighter to render the code.

    For the color scheme, I'll match the One Dark theme colors that are commonly used in code editors:
    - Keywords: Purple (#c678dd)
    - Strings: Green (#98c379)
    - Numbers: Orange (#d19a66)
    - Comments: Gray (#5c6370)
    - Functions: Blue (#61afef)

    This should provide a visually appealing and consistent experience across the app.
    """
}
#endif
