import Foundation
import SwiftUI

// MARK: - System Info

struct SystemInfo: Equatable {
    let appVersion: String
    let buildNumber: String
    let iosVersion: String
    let deviceModel: String
    let serverURL: String
    let apiVersion: String?
    let vllmVersion: String?

    static var current: SystemInfo {
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
        let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"

        #if targetEnvironment(simulator)
        let deviceModel = "Simulator"
        #else
        var systemInfo = utsname()
        uname(&systemInfo)
        let deviceModel = withUnsafePointer(to: &systemInfo.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: 1) {
                String(validatingUTF8: $0) ?? "Unknown"
            }
        }
        #endif

        return SystemInfo(
            appVersion: appVersion,
            buildNumber: buildNumber,
            iosVersion: UIDevice.current.systemVersion,
            deviceModel: deviceModel,
            serverURL: "Not configured",
            apiVersion: nil,
            vllmVersion: nil
        )
    }
}

// MARK: - Configs View Model

@Observable
final class ConfigsViewModel {
    // MARK: - Properties

    /// API key (masked for display)
    var apiKey: String = ""

    /// Whether the API key is visible
    var isAPIKeyVisible: Bool = false

    /// Server URL
    var serverURL: String = "http://localhost:8080"

    /// Connection status
    private(set) var connectionStatus: ConnectionStatus = .disconnected

    /// Last connection test time
    private(set) var lastTestTime: Date?

    /// System information
    private(set) var systemInfo: SystemInfo = .current

    /// Whether the API key is being saved
    private(set) var isSavingKey: Bool = false

    /// Whether there's a stored API key
    private(set) var hasStoredKey: Bool = false

    /// Error message
    private(set) var errorMessage: String?

    /// Whether to show error alert
    var showError: Bool = false

    /// Whether to show clear data confirmation
    var showClearDataConfirmation: Bool = false

    /// Whether data is being cleared
    private(set) var isClearingData: Bool = false

    // MARK: - Keychain Keys

    private let apiKeyKeychainKey = "com.vllmstudio.apikey"
    private let serverURLKey = "serverURL"

    // MARK: - Initialization

    init() {
        loadStoredSettings()
    }

    // MARK: - Public Methods

    /// Save API key to keychain
    func saveAPIKey() {
        guard !apiKey.isEmpty else { return }

        isSavingKey = true

        // Simulate keychain save (in real app, use KeychainAccess)
        Task {
            try? await Task.sleep(nanoseconds: 500_000_000)

            await MainActor.run {
                // In real implementation:
                // try keychain.set(apiKey, key: apiKeyKeychainKey)

                self.hasStoredKey = true
                self.isSavingKey = false

                // Clear the displayed key for security
                self.apiKey = ""
                self.isAPIKeyVisible = false
            }
        }
    }

    /// Clear API key from keychain
    func clearAPIKey() {
        // In real implementation:
        // try keychain.remove(apiKeyKeychainKey)

        hasStoredKey = false
        apiKey = ""
        connectionStatus = .disconnected
    }

    /// Save server URL
    func saveServerURL() {
        UserDefaults.standard.set(serverURL, forKey: serverURLKey)
        updateSystemInfo()
    }

    /// Test connection to server
    func testConnection() async {
        connectionStatus = .connecting

        do {
            // Simulate API call
            try await Task.sleep(nanoseconds: 1_500_000_000)

            // In real implementation:
            // let response = try await apiClient.request(.health)

            // Simulate random success/failure for demo
            let isSuccess = Bool.random()

            await MainActor.run {
                if isSuccess {
                    self.connectionStatus = .connected
                    self.updateSystemInfo(vllmVersion: "vLLM 0.4.2", apiVersion: "v1")
                } else {
                    self.connectionStatus = .failed("Connection refused")
                }
                self.lastTestTime = Date()
            }
        } catch {
            await MainActor.run {
                self.connectionStatus = .failed(error.localizedDescription)
                self.lastTestTime = Date()
            }
        }
    }

    /// Clear all app data
    func clearData() async {
        isClearingData = true

        do {
            try await Task.sleep(nanoseconds: 1_000_000_000)

            await MainActor.run {
                // Clear keychain
                self.hasStoredKey = false
                self.apiKey = ""

                // Clear UserDefaults
                if let bundleID = Bundle.main.bundleIdentifier {
                    UserDefaults.standard.removePersistentDomain(forName: bundleID)
                }

                // Reset to defaults
                self.serverURL = "http://localhost:8080"
                self.connectionStatus = .disconnected
                self.lastTestTime = nil

                // Update system info
                self.updateSystemInfo()

                self.isClearingData = false
            }
        } catch {
            await MainActor.run {
                self.errorMessage = "Failed to clear data: \(error.localizedDescription)"
                self.showError = true
                self.isClearingData = false
            }
        }
    }

    /// Reset server URL to default
    func resetServerURL() {
        serverURL = "http://localhost:8080"
        saveServerURL()
    }

    // MARK: - Private Methods

    private func loadStoredSettings() {
        // Load server URL
        if let storedURL = UserDefaults.standard.string(forKey: serverURLKey) {
            serverURL = storedURL
        }

        // Check if API key exists in keychain
        // In real implementation:
        // hasStoredKey = (try? keychain.get(apiKeyKeychainKey)) != nil

        // For demo, simulate stored key
        hasStoredKey = false

        updateSystemInfo()
    }

    private func updateSystemInfo(vllmVersion: String? = nil, apiVersion: String? = nil) {
        let current = SystemInfo.current
        systemInfo = SystemInfo(
            appVersion: current.appVersion,
            buildNumber: current.buildNumber,
            iosVersion: current.iosVersion,
            deviceModel: current.deviceModel,
            serverURL: serverURL,
            apiVersion: apiVersion,
            vllmVersion: vllmVersion
        )
    }
}

// MARK: - Validation

extension ConfigsViewModel {
    /// Validate server URL format
    var isValidServerURL: Bool {
        guard let url = URL(string: serverURL) else { return false }
        return url.scheme == "http" || url.scheme == "https"
    }

    /// Server URL validation error
    var serverURLError: String? {
        if serverURL.isEmpty {
            return "Server URL is required"
        }
        if !isValidServerURL {
            return "Invalid URL format. Must start with http:// or https://"
        }
        return nil
    }
}

// MARK: - Computed Properties

extension ConfigsViewModel {
    /// Whether the save button should be enabled
    var canSaveServerURL: Bool {
        isValidServerURL && serverURL != systemInfo.serverURL
    }

    /// Whether connection test can be performed
    var canTestConnection: Bool {
        isValidServerURL && !connectionStatus.isConnecting
    }

    /// Display version string
    var displayVersion: String {
        "\(systemInfo.appVersion) (\(systemInfo.buildNumber))"
    }
}
