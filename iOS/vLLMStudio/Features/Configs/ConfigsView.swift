import SwiftUI

// MARK: - Configs View

struct ConfigsView: View {
    @State private var viewModel = ConfigsViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: .spacing.lg) {
                    // API Key Section
                    APIKeySection(
                        apiKey: $viewModel.apiKey,
                        isKeyVisible: $viewModel.isAPIKeyVisible,
                        isSaving: viewModel.isSavingKey,
                        hasStoredKey: viewModel.hasStoredKey,
                        onSave: {
                            viewModel.saveAPIKey()
                        },
                        onClear: {
                            viewModel.clearAPIKey()
                        }
                    )

                    // Server URL Section
                    ServerURLSection(
                        serverURL: $viewModel.serverURL,
                        error: viewModel.serverURLError,
                        onSave: {
                            viewModel.saveServerURL()
                        },
                        onReset: {
                            viewModel.resetServerURL()
                        }
                    )

                    // Connection Test Section
                    ConnectionTestButton(
                        status: viewModel.connectionStatus,
                        lastTestTime: viewModel.lastTestTime,
                        onTest: {
                            Task {
                                await viewModel.testConnection()
                            }
                        }
                    )

                    // System Info Section
                    SystemInfoSection(systemInfo: viewModel.systemInfo)

                    // Danger Zone
                    DangerZoneSection(
                        isClearing: viewModel.isClearingData,
                        onClearData: {
                            viewModel.showClearDataConfirmation = true
                        }
                    )
                }
                .padding(.spacing.lg)
            }
            .background(Color.theme.background)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "An unknown error occurred")
            }
            .confirmationDialog(
                "Clear All Data?",
                isPresented: $viewModel.showClearDataConfirmation,
                titleVisibility: .visible
            ) {
                Button("Clear Data", role: .destructive) {
                    Task {
                        await viewModel.clearData()
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will remove your API key, server settings, and all local data. This action cannot be undone.")
            }
        }
    }
}

// MARK: - Server URL Section

struct ServerURLSection: View {
    @Binding var serverURL: String
    var error: String?
    var onSave: () -> Void
    var onReset: () -> Void

    @FocusState private var isFocused: Bool
    @State private var hasChanges: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Section Header
            Label("Server URL", systemImage: "server.rack")
                .font(.theme.headline)
                .foregroundColor(Color.theme.foreground)

            // Description
            Text("The URL of your vLLM server. Make sure the server is running and accessible from this device.")
                .font(.theme.caption)
                .foregroundColor(Color.theme.mutedForeground)

            // URL Input
            VStack(alignment: .leading, spacing: .spacing.sm) {
                HStack(spacing: .spacing.sm) {
                    Image(systemName: "link")
                        .font(.system(size: .iconSize.sm))
                        .foregroundColor(Color.theme.mutedForeground)

                    TextField("http://localhost:8080", text: $serverURL)
                        .font(.theme.body)
                        .foregroundColor(Color.theme.foreground)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($isFocused)
                        .onChange(of: serverURL) { _, _ in
                            hasChanges = true
                        }
                }
                .padding(.spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: .radius.md)
                        .fill(Color.theme.backgroundSecondary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: .radius.md)
                        .stroke(
                            error != nil ? Color.theme.error :
                                (isFocused ? Color.theme.primary : Color.theme.border),
                            lineWidth: isFocused ? 2 : 1
                        )
                )

                // Error message
                if let error = error {
                    HStack(spacing: .spacing.xs) {
                        Image(systemName: "exclamationmark.circle")
                            .font(.system(size: 12))
                        Text(error)
                            .font(.theme.caption)
                    }
                    .foregroundColor(Color.theme.error)
                }

                // Action buttons
                HStack(spacing: .spacing.sm) {
                    Button {
                        onSave()
                        hasChanges = false
                        isFocused = false
                    } label: {
                        HStack(spacing: .spacing.xs) {
                            Image(systemName: "checkmark")
                                .font(.system(size: 12, weight: .semibold))
                            Text("Save")
                                .font(.theme.caption)
                                .fontWeight(.medium)
                        }
                        .foregroundColor(hasChanges && error == nil ? Color.theme.background : Color.theme.mutedForeground)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, .spacing.sm + 2)
                        .background(
                            RoundedRectangle(cornerRadius: .radius.md)
                                .fill(hasChanges && error == nil ? Color.theme.primary : Color.theme.backgroundSecondary)
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(!hasChanges || error != nil)

                    Button {
                        onReset()
                        hasChanges = false
                    } label: {
                        HStack(spacing: .spacing.xs) {
                            Image(systemName: "arrow.counterclockwise")
                                .font(.system(size: 12, weight: .semibold))
                            Text("Reset")
                                .font(.theme.caption)
                                .fontWeight(.medium)
                        }
                        .foregroundColor(Color.theme.foreground)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, .spacing.sm + 2)
                        .background(
                            RoundedRectangle(cornerRadius: .radius.md)
                                .fill(Color.theme.backgroundSecondary)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: .radius.md)
                                .stroke(Color.theme.border, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
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
}

// MARK: - System Info Section

struct SystemInfoSection: View {
    let systemInfo: SystemInfo

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Section Header
            Label("System Information", systemImage: "info.circle")
                .font(.theme.headline)
                .foregroundColor(Color.theme.foreground)

            // Info Grid
            VStack(spacing: .spacing.sm) {
                InfoRow(label: "App Version", value: "\(systemInfo.appVersion) (\(systemInfo.buildNumber))")
                InfoRow(label: "iOS Version", value: systemInfo.iosVersion)
                InfoRow(label: "Device", value: systemInfo.deviceModel)
                InfoRow(label: "Server URL", value: systemInfo.serverURL)

                if let vllmVersion = systemInfo.vllmVersion {
                    InfoRow(label: "vLLM Version", value: vllmVersion)
                }

                if let apiVersion = systemInfo.apiVersion {
                    InfoRow(label: "API Version", value: apiVersion)
                }
            }
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
}

// MARK: - Info Row

struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.theme.body)
                .foregroundColor(Color.theme.mutedForeground)

            Spacer()

            Text(value)
                .font(.theme.body)
                .foregroundColor(Color.theme.foreground)
                .multilineTextAlignment(.trailing)
        }
        .padding(.spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: .radius.sm)
                .fill(Color.theme.backgroundSecondary)
        )
    }
}

// MARK: - Danger Zone Section

struct DangerZoneSection: View {
    var isClearing: Bool
    var onClearData: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Section Header
            HStack {
                Label("Danger Zone", systemImage: "exclamationmark.triangle")
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.error)
            }

            // Warning
            Text("These actions are destructive and cannot be undone.")
                .font(.theme.caption)
                .foregroundColor(Color.theme.mutedForeground)

            // Clear Data Button
            Button {
                onClearData()
            } label: {
                HStack(spacing: .spacing.sm) {
                    if isClearing {
                        ProgressView()
                            .scaleEffect(0.8)
                            .tint(Color.theme.error)
                    } else {
                        Image(systemName: "trash")
                            .font(.system(size: 14, weight: .semibold))
                    }

                    Text(isClearing ? "Clearing..." : "Clear All Data")
                        .font(.theme.body)
                        .fontWeight(.medium)
                }
                .foregroundColor(Color.theme.error)
                .frame(maxWidth: .infinity)
                .padding(.vertical, .spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: .radius.md)
                        .fill(Color.theme.error.opacity(0.15))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: .radius.md)
                        .stroke(Color.theme.error.opacity(0.3), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .disabled(isClearing)

            // Description
            Text("This will remove your API key, server settings, chat history, and all local preferences.")
                .font(.theme.caption2)
                .foregroundColor(Color.theme.mutedForeground)
        }
        .padding(.spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: .radius.lg)
                .fill(Color.theme.card)
        )
        .overlay(
            RoundedRectangle(cornerRadius: .radius.lg)
                .stroke(Color.theme.error.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Settings Row (Generic)

struct SettingsRow<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        HStack {
            Label(title, systemImage: icon)
                .font(.theme.body)
                .foregroundColor(Color.theme.foreground)

            Spacer()

            content()
        }
        .padding(.spacing.md)
        .background(
            RoundedRectangle(cornerRadius: .radius.md)
                .fill(Color.theme.backgroundSecondary)
        )
    }
}

// MARK: - Toggle Settings Row

struct ToggleSettingsRow: View {
    let title: String
    let icon: String
    @Binding var isOn: Bool

    var body: some View {
        SettingsRow(title: title, icon: icon) {
            Toggle("", isOn: $isOn)
                .tint(Color.theme.primary)
                .labelsHidden()
        }
    }
}

// MARK: - Navigation Settings Row

struct NavigationSettingsRow: View {
    let title: String
    let icon: String
    let value: String?
    var action: (() -> Void)?

    var body: some View {
        Button {
            action?()
        } label: {
            SettingsRow(title: title, icon: icon) {
                HStack(spacing: .spacing.sm) {
                    if let value = value {
                        Text(value)
                            .font(.theme.body)
                            .foregroundColor(Color.theme.mutedForeground)
                    }

                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color.theme.mutedForeground)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview("Configs View") {
    ConfigsView()
}

#Preview("Server URL Section") {
    VStack(spacing: 20) {
        ServerURLSection(
            serverURL: .constant("http://localhost:8080"),
            error: nil,
            onSave: {},
            onReset: {}
        )

        ServerURLSection(
            serverURL: .constant("invalid-url"),
            error: "Invalid URL format",
            onSave: {},
            onReset: {}
        )
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("System Info Section") {
    SystemInfoSection(systemInfo: .current)
        .padding()
        .background(Color.theme.background)
}

#Preview("Danger Zone Section") {
    DangerZoneSection(
        isClearing: false,
        onClearData: {}
    )
    .padding()
    .background(Color.theme.background)
}
