import SwiftUI

// MARK: - API Key Section

struct APIKeySection: View {
    @Binding var apiKey: String
    @Binding var isKeyVisible: Bool
    var isSaving: Bool = false
    var hasStoredKey: Bool = false
    var onSave: () -> Void
    var onClear: () -> Void

    @State private var editingKey: String = ""
    @State private var isEditing: Bool = false
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Section Header
            HStack {
                Label("API Key", systemImage: "key.fill")
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)

                Spacer()

                if hasStoredKey {
                    StatusIndicator(isActive: true, label: "Configured")
                } else {
                    StatusIndicator(isActive: false, label: "Not Set")
                }
            }

            // Description
            Text("Your API key is used to authenticate requests to the vLLM server. It is stored securely in the device keychain.")
                .font(.theme.caption)
                .foregroundColor(Color.theme.mutedForeground)

            // API Key Input
            VStack(spacing: .spacing.sm) {
                HStack(spacing: .spacing.sm) {
                    // Input Field
                    Group {
                        if isKeyVisible {
                            TextField("Enter API key...", text: $editingKey)
                        } else {
                            SecureField("Enter API key...", text: $editingKey)
                        }
                    }
                    .font(.theme.body)
                    .foregroundColor(Color.theme.foreground)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($isFocused)
                    .onAppear {
                        if hasStoredKey && !isEditing {
                            editingKey = maskedKey
                        }
                    }
                    .onChange(of: isFocused) { _, newValue in
                        if newValue && hasStoredKey && !isEditing {
                            editingKey = ""
                            isEditing = true
                        }
                    }

                    // Visibility Toggle
                    Button {
                        isKeyVisible.toggle()
                    } label: {
                        Image(systemName: isKeyVisible ? "eye.slash" : "eye")
                            .font(.system(size: .iconSize.md))
                            .foregroundColor(Color.theme.mutedForeground)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: .radius.md)
                        .fill(Color.theme.backgroundSecondary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: .radius.md)
                        .stroke(isFocused ? Color.theme.primary : Color.theme.border, lineWidth: isFocused ? 2 : 1)
                )

                // Action Buttons
                HStack(spacing: .spacing.sm) {
                    // Save Button
                    Button {
                        if !editingKey.isEmpty && editingKey != maskedKey {
                            apiKey = editingKey
                            onSave()
                            isEditing = false
                            isFocused = false
                        }
                    } label: {
                        HStack(spacing: .spacing.xs) {
                            if isSaving {
                                ProgressView()
                                    .scaleEffect(0.8)
                                    .tint(Color.theme.background)
                            } else {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 12, weight: .semibold))
                            }
                            Text(isSaving ? "Saving..." : "Save Key")
                                .font(.theme.caption)
                                .fontWeight(.medium)
                        }
                        .foregroundColor(Color.theme.background)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, .spacing.sm + 2)
                        .background(
                            RoundedRectangle(cornerRadius: .radius.md)
                                .fill(canSave ? Color.theme.primary : Color.theme.primary.opacity(0.5))
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(!canSave || isSaving)

                    // Clear Button
                    if hasStoredKey {
                        Button {
                            editingKey = ""
                            isEditing = false
                            onClear()
                        } label: {
                            HStack(spacing: .spacing.xs) {
                                Image(systemName: "trash")
                                    .font(.system(size: 12, weight: .semibold))
                                Text("Clear")
                                    .font(.theme.caption)
                                    .fontWeight(.medium)
                            }
                            .foregroundColor(Color.theme.error)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, .spacing.sm + 2)
                            .background(
                                RoundedRectangle(cornerRadius: .radius.md)
                                    .fill(Color.theme.error.opacity(0.15))
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            // Security Note
            SecurityNote()
        }
        .padding(.spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: .radius.lg)
                .fill(Color.theme.card)
        )
        .overlay(
            RoundedRectangle(cornerRadius: .radius.lg)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }

    private var maskedKey: String {
        guard hasStoredKey else { return "" }
        return "••••••••••••••••"
    }

    private var canSave: Bool {
        !editingKey.isEmpty && editingKey != maskedKey
    }
}

// MARK: - Status Indicator

struct StatusIndicator: View {
    var isActive: Bool
    var label: String

    var body: some View {
        HStack(spacing: .spacing.xs) {
            Circle()
                .fill(isActive ? Color.theme.success : Color.theme.mutedForeground)
                .frame(width: 8, height: 8)

            Text(label)
                .font(.theme.caption)
                .foregroundColor(isActive ? Color.theme.success : Color.theme.mutedForeground)
        }
    }
}

// MARK: - Security Note

struct SecurityNote: View {
    var body: some View {
        HStack(alignment: .top, spacing: .spacing.sm) {
            Image(systemName: "lock.shield")
                .font(.system(size: 14))
                .foregroundColor(Color.theme.info)

            Text("Your API key is encrypted and stored securely in the iOS Keychain. It never leaves your device.")
                .font(.theme.caption2)
                .foregroundColor(Color.theme.mutedForeground)
        }
        .padding(.spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: .radius.sm)
                .fill(Color.theme.info.opacity(0.1))
        )
    }
}

// MARK: - Compact API Key Input

struct CompactAPIKeyInput: View {
    @Binding var apiKey: String
    var placeholder: String = "Enter API key..."
    @Binding var isVisible: Bool

    var body: some View {
        HStack(spacing: .spacing.sm) {
            Group {
                if isVisible {
                    TextField(placeholder, text: $apiKey)
                } else {
                    SecureField(placeholder, text: $apiKey)
                }
            }
            .font(.theme.body)
            .foregroundColor(Color.theme.foreground)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()

            Button {
                isVisible.toggle()
            } label: {
                Image(systemName: isVisible ? "eye.slash" : "eye")
                    .font(.system(size: .iconSize.sm))
                    .foregroundColor(Color.theme.mutedForeground)
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - API Key Status Badge

struct APIKeyStatusBadge: View {
    var hasKey: Bool
    var isConnected: Bool

    var body: some View {
        HStack(spacing: .spacing.xs) {
            Image(systemName: statusIcon)
                .font(.system(size: 12))

            Text(statusText)
                .font(.theme.caption)
        }
        .foregroundColor(statusColor)
        .padding(.horizontal, .spacing.md)
        .padding(.vertical, .spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: .radius.full)
                .fill(statusColor.opacity(0.15))
        )
    }

    private var statusIcon: String {
        if !hasKey {
            return "key"
        } else if isConnected {
            return "checkmark.circle"
        } else {
            return "exclamationmark.triangle"
        }
    }

    private var statusText: String {
        if !hasKey {
            return "No API Key"
        } else if isConnected {
            return "Connected"
        } else {
            return "Disconnected"
        }
    }

    private var statusColor: Color {
        if !hasKey {
            return Color.theme.warning
        } else if isConnected {
            return Color.theme.success
        } else {
            return Color.theme.error
        }
    }
}

// MARK: - Preview

#Preview("API Key Section - Empty") {
    ScrollView {
        APIKeySection(
            apiKey: .constant(""),
            isKeyVisible: .constant(false),
            hasStoredKey: false,
            onSave: {},
            onClear: {}
        )
        .padding()
    }
    .background(Color.theme.background)
}

#Preview("API Key Section - Configured") {
    ScrollView {
        APIKeySection(
            apiKey: .constant("sk-test-key-1234"),
            isKeyVisible: .constant(false),
            hasStoredKey: true,
            onSave: {},
            onClear: {}
        )
        .padding()
    }
    .background(Color.theme.background)
}

#Preview("API Key Section - Visible") {
    ScrollView {
        APIKeySection(
            apiKey: .constant("sk-test-key-1234"),
            isKeyVisible: .constant(true),
            hasStoredKey: true,
            onSave: {},
            onClear: {}
        )
        .padding()
    }
    .background(Color.theme.background)
}

#Preview("Status Badges") {
    VStack(spacing: 16) {
        APIKeyStatusBadge(hasKey: false, isConnected: false)
        APIKeyStatusBadge(hasKey: true, isConnected: true)
        APIKeyStatusBadge(hasKey: true, isConnected: false)
    }
    .padding()
    .background(Color.theme.background)
}
