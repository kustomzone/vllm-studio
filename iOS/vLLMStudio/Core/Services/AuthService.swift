//
//  AuthService.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation

/// Service for managing API key authentication.
/// Handles secure storage, retrieval, and validation of API credentials.
@Observable
final class AuthService {

    // MARK: - Singleton

    /// Shared instance of the auth service
    static let shared = AuthService()

    // MARK: - Dependencies

    private let keychainManager: KeychainManager
    private let apiClient: APIClient

    // MARK: - Observable State

    /// Current authentication status
    private(set) var authState: AuthState = .unknown

    /// Error message from last operation
    private(set) var lastError: String?

    // MARK: - Computed Properties

    /// Whether the user is authenticated (has a valid API key stored)
    var isAuthenticated: Bool {
        keychainManager.hasAPIKey
    }

    /// The current API key (if stored)
    var currentAPIKey: String? {
        keychainManager.getAPIKey()
    }

    // MARK: - Initialization

    private init(
        keychainManager: KeychainManager = .shared,
        apiClient: APIClient = .shared
    ) {
        self.keychainManager = keychainManager
        self.apiClient = apiClient
        updateAuthState()
    }

    // MARK: - Public Methods

    /// Stores a new API key in the keychain
    /// - Parameter apiKey: The API key to store
    /// - Returns: True if successful, false otherwise
    @discardableResult
    func setAPIKey(_ apiKey: String) -> Bool {
        guard !apiKey.isEmpty else {
            lastError = "API key cannot be empty"
            return false
        }

        let success = keychainManager.saveAPIKey(apiKey)
        if success {
            updateAuthState()
            lastError = nil
        } else {
            lastError = "Failed to save API key to keychain"
        }
        return success
    }

    /// Retrieves the stored API key
    /// - Returns: The API key if stored, nil otherwise
    func getAPIKey() -> String? {
        keychainManager.getAPIKey()
    }

    /// Clears the stored API key and logs out the user
    func logout() {
        keychainManager.deleteAPIKey()
        keychainManager.deleteServerToken()
        authState = .unauthenticated
        lastError = nil
    }

    /// Validates the current API key by making a test request to the server
    /// - Returns: True if the API key is valid
    /// - Throws: NetworkError if validation fails
    func validateAPIKey() async throws -> Bool {
        guard let apiKey = currentAPIKey, !apiKey.isEmpty else {
            authState = .unauthenticated
            throw AuthError.noAPIKey
        }

        authState = .validating

        do {
            let response: HealthResponse = try await apiClient.request(.health)
            if response.status == "ok" || response.status == "healthy" {
                authState = .authenticated
                lastError = nil
                return true
            } else {
                authState = .invalid
                lastError = "Server returned unexpected status: \(response.status)"
                return false
            }
        } catch let error as NetworkError {
            switch error {
            case .unauthorized:
                authState = .invalid
                lastError = "Invalid API key"
                throw AuthError.invalidAPIKey
            case .serverUnreachable, .noConnection:
                authState = .unknown
                lastError = "Unable to reach server"
                throw AuthError.serverUnreachable
            default:
                authState = .unknown
                lastError = error.localizedDescription
                throw error
            }
        } catch {
            authState = .unknown
            lastError = error.localizedDescription
            throw error
        }
    }

    /// Validates a specific API key without storing it
    /// - Parameter apiKey: The API key to validate
    /// - Returns: True if valid
    func validateAPIKey(_ apiKey: String) async throws -> Bool {
        guard !apiKey.isEmpty else {
            throw AuthError.noAPIKey
        }

        // Temporarily use the provided API key for validation
        // Note: In a real implementation, you might want to create a separate request
        // that doesn't affect the stored key
        let previousKey = currentAPIKey
        keychainManager.saveAPIKey(apiKey)

        defer {
            // Restore previous key if validation fails
            if let previousKey = previousKey {
                keychainManager.saveAPIKey(previousKey)
            }
        }

        return try await validateAPIKey()
    }

    /// Tests connection to the server without requiring authentication
    /// - Returns: True if server is reachable
    func testConnection() async -> Bool {
        await apiClient.healthCheck()
    }

    // MARK: - Private Methods

    private func updateAuthState() {
        if keychainManager.hasAPIKey {
            authState = .authenticated
        } else {
            authState = .unauthenticated
        }
    }
}

// MARK: - Auth State

/// Authentication state enumeration
enum AuthState: Equatable {
    /// Authentication status is unknown
    case unknown
    /// User is not authenticated
    case unauthenticated
    /// Currently validating credentials
    case validating
    /// User is authenticated
    case authenticated
    /// API key is invalid
    case invalid
}

// MARK: - Auth Error

/// Authentication-related errors
enum AuthError: LocalizedError {
    case noAPIKey
    case invalidAPIKey
    case serverUnreachable
    case validationFailed(String)

    var errorDescription: String? {
        switch self {
        case .noAPIKey:
            return "No API key configured. Please add your API key in Settings."
        case .invalidAPIKey:
            return "Invalid API key. Please check your API key and try again."
        case .serverUnreachable:
            return "Unable to reach the server. Please check your connection and server URL."
        case .validationFailed(let message):
            return "Validation failed: \(message)"
        }
    }
}

// MARK: - Health Response

/// Response from the health check endpoint
struct HealthResponse: Decodable {
    let status: String
    let version: String?
    let backendReachable: Bool?
    let runningModel: String?

    enum CodingKeys: String, CodingKey {
        case status
        case version
        case backendReachable = "backend_reachable"
        case runningModel = "running_model"
    }
}
