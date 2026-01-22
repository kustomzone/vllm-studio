import SwiftUI

/// Message input bar with multi-line text editor, send button, and attachment support
struct ChatInputBar: View {
    @Binding var text: String
    let isStreaming: Bool
    let canSend: Bool
    let attachedImages: [ChatViewModel.AttachedImage]
    var onSend: () -> Void
    var onStop: () -> Void
    var onAttachment: () -> Void
    var onRemoveImage: (Int) -> Void

    @FocusState private var isFocused: Bool
    @State private var textEditorHeight: CGFloat = 36

    private let minHeight: CGFloat = 36
    private let maxHeight: CGFloat = 120

    var body: some View {
        VStack(spacing: 0) {
            // Attached images preview
            if !attachedImages.isEmpty {
                attachedImagesPreview
            }

            // Main input area
            HStack(alignment: .bottom, spacing: .spacing.sm) {
                // Attachment button
                attachmentButton

                // Text input
                textInputArea

                // Send or Stop button
                actionButton
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .background(Color.theme.backgroundSecondary)
        }
    }

    // MARK: - Attached Images Preview

    private var attachedImagesPreview: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: .spacing.sm) {
                ForEach(Array(attachedImages.enumerated()), id: \.element.id) { index, image in
                    AttachedImagePreview(
                        image: image.thumbnail ?? UIImage(),
                        onRemove: { onRemoveImage(index) }
                    )
                }
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
        }
        .background(Color.theme.backgroundSecondary)
    }

    // MARK: - Attachment Button

    private var attachmentButton: some View {
        Button(action: onAttachment) {
            Image(systemName: "plus")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(Color.theme.mutedForeground)
                .frame(width: 36, height: 36)
                .background(Color.theme.backgroundTertiary)
                .clipShape(Circle())
        }
        .disabled(isStreaming)
        .opacity(isStreaming ? 0.5 : 1)
    }

    // MARK: - Text Input Area

    private var textInputArea: some View {
        ZStack(alignment: .leading) {
            // Placeholder
            if text.isEmpty {
                Text("Message...")
                    .font(.system(size: 16))
                    .foregroundStyle(Color.theme.mutedForeground)
                    .padding(.horizontal, .spacing.md)
                    .padding(.vertical, .spacing.sm)
            }

            // Dynamic height text editor
            DynamicHeightTextEditor(
                text: $text,
                minHeight: minHeight,
                maxHeight: maxHeight,
                isFocused: $isFocused
            )
        }
        .background(Color.theme.backgroundTertiary)
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }

    // MARK: - Action Button

    private var actionButton: some View {
        Group {
            if isStreaming {
                // Stop button
                Button(action: onStop) {
                    Image(systemName: "stop.fill")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.theme.foreground)
                        .frame(width: 36, height: 36)
                        .background(Color.theme.error)
                        .clipShape(Circle())
                }
            } else {
                // Send button
                Button(action: onSend) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(canSend ? Color.theme.foreground : Color.theme.mutedForeground)
                        .frame(width: 36, height: 36)
                        .background(canSend ? Color.theme.primary : Color.theme.backgroundTertiary)
                        .clipShape(Circle())
                }
                .disabled(!canSend)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: isStreaming)
    }
}

// MARK: - Dynamic Height Text Editor

private struct DynamicHeightTextEditor: View {
    @Binding var text: String
    let minHeight: CGFloat
    let maxHeight: CGFloat
    var isFocused: FocusState<Bool>.Binding

    var body: some View {
        TextEditor(text: $text)
            .font(.system(size: 16))
            .foregroundStyle(Color.theme.foreground)
            .scrollContentBackground(.hidden)
            .background(.clear)
            .padding(.horizontal, .spacing.sm)
            .padding(.vertical, .spacing.xs)
            .frame(minHeight: minHeight, maxHeight: maxHeight)
            .fixedSize(horizontal: false, vertical: true)
            .focused(isFocused)
    }
}

// MARK: - Attached Image Preview

private struct AttachedImagePreview: View {
    let image: UIImage
    let onRemove: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: 60, height: 60)
                .clipShape(RoundedRectangle(cornerRadius: .radius.sm))

            // Remove button
            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(.white)
                    .background(Circle().fill(.black.opacity(0.6)))
            }
            .offset(x: 6, y: -6)
        }
    }
}

// MARK: - Compact Input Bar (iPhone bottom)

struct CompactChatInputBar: View {
    @Binding var text: String
    let isStreaming: Bool
    let canSend: Bool
    let elapsedSeconds: Int
    var onSend: () -> Void
    var onStop: () -> Void
    var onAttachment: () -> Void
    var onSettings: () -> Void

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            Divider()
                .background(Color.theme.border)

            HStack(alignment: .bottom, spacing: .spacing.sm) {
                // Attachment button
                Button(action: onAttachment) {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 28))
                        .foregroundStyle(Color.theme.mutedForeground)
                }
                .disabled(isStreaming)

                // Text input
                ZStack(alignment: .leading) {
                    if text.isEmpty {
                        Text("Message...")
                            .font(.system(size: 16))
                            .foregroundStyle(Color.theme.mutedForeground)
                            .padding(.leading, .spacing.md)
                    }

                    TextField("", text: $text, axis: .vertical)
                        .font(.system(size: 16))
                        .foregroundStyle(Color.theme.foreground)
                        .lineLimit(1...5)
                        .padding(.horizontal, .spacing.md)
                        .padding(.vertical, .spacing.sm)
                        .focused($isFocused)
                }
                .background(Color.theme.backgroundTertiary)
                .clipShape(RoundedRectangle(cornerRadius: 20))

                // Send/Stop button
                if isStreaming {
                    VStack(spacing: 2) {
                        Button(action: onStop) {
                            Image(systemName: "stop.circle.fill")
                                .font(.system(size: 32))
                                .foregroundStyle(Color.theme.error)
                        }
                        Text("\(elapsedSeconds)s")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(Color.theme.mutedForeground)
                    }
                } else {
                    Button(action: onSend) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 32))
                            .foregroundStyle(canSend ? Color.theme.primary : Color.theme.mutedForeground.opacity(0.5))
                    }
                    .disabled(!canSend)
                }
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .background(Color.theme.background)
        }
    }
}

// MARK: - Preview

#Preview("Input Bar - Empty") {
    VStack {
        Spacer()
        ChatInputBar(
            text: .constant(""),
            isStreaming: false,
            canSend: false,
            attachedImages: [],
            onSend: {},
            onStop: {},
            onAttachment: {},
            onRemoveImage: { _ in }
        )
    }
    .background(Color.theme.background)
}

#Preview("Input Bar - With Text") {
    VStack {
        Spacer()
        ChatInputBar(
            text: .constant("Hello, how can I help you today?"),
            isStreaming: false,
            canSend: true,
            attachedImages: [],
            onSend: {},
            onStop: {},
            onAttachment: {},
            onRemoveImage: { _ in }
        )
    }
    .background(Color.theme.background)
}

#Preview("Input Bar - Streaming") {
    VStack {
        Spacer()
        ChatInputBar(
            text: .constant(""),
            isStreaming: true,
            canSend: false,
            attachedImages: [],
            onSend: {},
            onStop: {},
            onAttachment: {},
            onRemoveImage: { _ in }
        )
    }
    .background(Color.theme.background)
}

#Preview("Compact Input - iPhone") {
    VStack {
        Spacer()
        CompactChatInputBar(
            text: .constant(""),
            isStreaming: false,
            canSend: false,
            elapsedSeconds: 0,
            onSend: {},
            onStop: {},
            onAttachment: {},
            onSettings: {}
        )
    }
    .background(Color.theme.background)
}
