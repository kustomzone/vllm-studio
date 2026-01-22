import SwiftUI

/// User message display with right-aligned bubble
struct UserMessageView: View {
    let message: Message
    let copied: Bool
    let onCopy: () -> Void
    let onExport: () -> Void

    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        VStack(alignment: .trailing, spacing: .spacing.sm) {
            // Header with label and actions
            HStack(spacing: .spacing.sm) {
                Spacer()

                // Actions (visible on hover on iPad, always on iPhone via long press)
                if sizeClass == .regular {
                    MessageActions(
                        copied: copied,
                        onCopy: onCopy,
                        onExport: onExport
                    )
                }

                Text("You")
                    .font(.system(size: 10, weight: .medium))
                    .textCase(.uppercase)
                    .tracking(1.5)
                    .foregroundStyle(Color.theme.mutedForeground)
            }

            // Message content
            Group {
                if sizeClass == .regular {
                    // iPad: Card style with border
                    iPadMessageCard
                } else {
                    // iPhone: Simple text
                    iPhoneMessageContent
                }
            }
            .contextMenu {
                Button(action: onCopy) {
                    Label(copied ? "Copied!" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                }

                Button(action: onExport) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
    }

    // MARK: - iPad Layout

    private var iPadMessageCard: some View {
        VStack(alignment: .trailing, spacing: .spacing.sm) {
            // Attached images
            if let images = message.images, !images.isEmpty {
                AttachedImagesGrid(images: images)
            }

            // Text content
            Text(message.content)
                .font(.system(size: 15))
                .foregroundStyle(Color.theme.foreground)
                .lineSpacing(4)
                .textSelection(.enabled)
                .multilineTextAlignment(.trailing)
        }
        .padding(.horizontal, .spacing.md)
        .padding(.vertical, .spacing.md)
        .frame(maxWidth: UIScreen.main.bounds.width * 0.62, alignment: .trailing)
        .background(Color.theme.card.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: .radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: .radius.lg)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }

    // MARK: - iPhone Layout

    private var iPhoneMessageContent: some View {
        VStack(alignment: .trailing, spacing: .spacing.sm) {
            // Attached images
            if let images = message.images, !images.isEmpty {
                AttachedImagesGrid(images: images)
            }

            // Text content
            Text(message.content)
                .font(.system(size: 15))
                .foregroundStyle(Color.theme.foreground)
                .lineSpacing(4)
                .textSelection(.enabled)
        }
    }
}

// MARK: - Message Actions

private struct MessageActions: View {
    let copied: Bool
    let onCopy: () -> Void
    let onExport: () -> Void

    var body: some View {
        HStack(spacing: 2) {
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

// MARK: - Attached Images Grid

struct AttachedImagesGrid: View {
    let images: [String]

    @State private var selectedImage: String?

    private let columns = [
        GridItem(.adaptive(minimum: 80, maximum: 120), spacing: 8)
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 8) {
            ForEach(Array(images.prefix(4).enumerated()), id: \.offset) { index, base64 in
                AttachedImageThumbnail(
                    base64: base64,
                    remainingCount: index == 3 && images.count > 4 ? images.count - 4 : nil
                )
                .onTapGesture {
                    selectedImage = base64
                }
            }
        }
        .frame(maxWidth: 260)
        .sheet(item: $selectedImage) { base64 in
            ImagePreviewSheet(base64: base64)
        }
    }
}

extension String: @retroactive Identifiable {
    public var id: String { self }
}

private struct AttachedImageThumbnail: View {
    let base64: String
    let remainingCount: Int?

    var body: some View {
        Group {
            if let data = Data(base64Encoded: base64),
               let uiImage = UIImage(data: data) {
                Image(uiImage: uiImage)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: 80, height: 80)
                    .clipShape(RoundedRectangle(cornerRadius: .radius.sm))
                    .overlay {
                        if let count = remainingCount, count > 0 {
                            RoundedRectangle(cornerRadius: .radius.sm)
                                .fill(.black.opacity(0.6))
                            Text("+\(count)")
                                .font(.theme.headline)
                                .foregroundStyle(.white)
                        }
                    }
            } else {
                RoundedRectangle(cornerRadius: .radius.sm)
                    .fill(Color.theme.backgroundSecondary)
                    .frame(width: 80, height: 80)
                    .overlay {
                        Image(systemName: "photo")
                            .foregroundStyle(Color.theme.mutedForeground)
                    }
            }
        }
    }
}

private struct ImagePreviewSheet: View {
    let base64: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if let data = Data(base64Encoded: base64),
                   let uiImage = UIImage(data: data) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                } else {
                    Text("Unable to load image")
                        .foregroundStyle(Color.theme.mutedForeground)
                }
            }
            .navigationTitle("Image")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Preview

#Preview("User Message - iPad") {
    UserMessageView(
        message: Message.previewUser,
        copied: false,
        onCopy: {},
        onExport: {}
    )
    .padding()
    .background(Color.theme.background)
    .environment(\.horizontalSizeClass, .regular)
}

#Preview("User Message - iPhone") {
    UserMessageView(
        message: Message.previewUser,
        copied: false,
        onCopy: {},
        onExport: {}
    )
    .padding()
    .background(Color.theme.background)
    .environment(\.horizontalSizeClass, .compact)
}

#Preview("With Images") {
    UserMessageView(
        message: Message(
            role: .user,
            content: "What's in this image?",
            images: ["iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="]
        ),
        copied: false,
        onCopy: {},
        onExport: {}
    )
    .padding()
    .background(Color.theme.background)
}
