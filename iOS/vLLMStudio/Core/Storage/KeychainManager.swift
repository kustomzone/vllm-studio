//
//  KeychainManager.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation
import Security

/// Manages secure storage of sensitive data in the iOS Keychain.
/// Used primarily for storing API keys and authentication tokens.
final class KeychainManager {

    // MARK: - Singleton

    /// Shared instance of the Keychain manager
    static let shared = KeychainManager()

    // MARK: - Constants

    private enum Keys {
        static let apiKey = "com.vllmstudio.apikey"
        static let serverToken = "com.vllmstudio.servertoken"
    }

    private let service = "com.vllmstudio.keychain"

    // MARK: - Initialization

    private init() {}

    // MARK: - API Key Management

    /// Saves the API key to the Keychain
    /// - Parameter apiKey: The API key to save
    /// - Returns: True if successful, false otherwise
    @discardableResult
    func saveAPIKey(_ apiKey: String) -> Bool {
        save(key: Keys.apiKey, value: apiKey)
    }

    /// Retrieves the API key from the Keychain
    /// - Returns: The API key if found, nil otherwise
    func getAPIKey() -> String? {
        retrieve(key: Keys.apiKey)
    }

    /// Deletes the API key from the Keychain
    /// - Returns: True if successful, false otherwise
    @discardableResult
    func deleteAPIKey() -> Bool {
        delete(key: Keys.apiKey)
    }

    /// Checks if an API key is stored
    var hasAPIKey: Bool {
        getAPIKey() != nil
    }

    // MARK: - Server Token Management

    /// Saves a server authentication token
    @discardableResult
    func saveServerToken(_ token: String) -> Bool {
        save(key: Keys.serverToken, value: token)
    }

    /// Retrieves the server authentication token
    func getServerToken() -> String? {
        retrieve(key: Keys.serverToken)
    }

    /// Deletes the server authentication token
    @discardableResult
    func deleteServerToken() -> Bool {
        delete(key: Keys.serverToken)
    }

    // MARK: - Generic Keychain Operations

    /// Saves a string value to the Keychain
    /// - Parameters:
    ///   - key: The key to store the value under
    ///   - value: The string value to store
    /// - Returns: True if successful, false otherwise
    @discardableResult
    func save(key: String, value: String) -> Bool {
        guard let data = value.data(using: .utf8) else {
            return false
        }

        // Delete any existing item first
        delete(key: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }

    /// Retrieves a string value from the Keychain
    /// - Parameter key: The key to retrieve the value for
    /// - Returns: The string value if found, nil otherwise
    func retrieve(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }

        return value
    }

    /// Deletes a value from the Keychain
    /// - Parameter key: The key to delete
    /// - Returns: True if successful or item didn't exist, false otherwise
    @discardableResult
    func delete(key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    /// Updates an existing Keychain item
    /// - Parameters:
    ///   - key: The key to update
    ///   - value: The new value
    /// - Returns: True if successful, false otherwise
    @discardableResult
    func update(key: String, value: String) -> Bool {
        guard let data = value.data(using: .utf8) else {
            return false
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        let attributes: [String: Any] = [
            kSecValueData as String: data
        ]

        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)

        if status == errSecItemNotFound {
            return save(key: key, value: value)
        }

        return status == errSecSuccess
    }

    // MARK: - Utility Methods

    /// Clears all stored Keychain items for this app
    func clearAll() {
        delete(key: Keys.apiKey)
        delete(key: Keys.serverToken)
    }

    /// Checks if a key exists in the Keychain
    /// - Parameter key: The key to check
    /// - Returns: True if the key exists, false otherwise
    func exists(key: String) -> Bool {
        retrieve(key: key) != nil
    }
}

// MARK: - Error Handling

extension KeychainManager {

    /// Keychain error types
    enum KeychainError: LocalizedError {
        case itemNotFound
        case duplicateItem
        case unexpectedStatus(OSStatus)
        case encodingFailed
        case decodingFailed

        var errorDescription: String? {
            switch self {
            case .itemNotFound:
                return "The requested item was not found in the Keychain."
            case .duplicateItem:
                return "An item with this key already exists in the Keychain."
            case .unexpectedStatus(let status):
                return "Keychain operation failed with status: \(status)"
            case .encodingFailed:
                return "Failed to encode data for Keychain storage."
            case .decodingFailed:
                return "Failed to decode data from Keychain."
            }
        }
    }

    /// Saves data with detailed error reporting
    /// - Parameters:
    ///   - key: The key to store the value under
    ///   - value: The string value to store
    /// - Throws: KeychainError if the operation fails
    func saveWithError(key: String, value: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.encodingFailed
        }

        // Delete any existing item first
        delete(key: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        let status = SecItemAdd(query as CFDictionary, nil)

        switch status {
        case errSecSuccess:
            return
        case errSecDuplicateItem:
            throw KeychainError.duplicateItem
        default:
            throw KeychainError.unexpectedStatus(status)
        }
    }

    /// Retrieves data with detailed error reporting
    /// - Parameter key: The key to retrieve
    /// - Returns: The stored string value
    /// - Throws: KeychainError if the operation fails
    func retrieveWithError(key: String) throws -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        switch status {
        case errSecSuccess:
            guard let data = result as? Data,
                  let value = String(data: data, encoding: .utf8) else {
                throw KeychainError.decodingFailed
            }
            return value
        case errSecItemNotFound:
            throw KeychainError.itemNotFound
        default:
            throw KeychainError.unexpectedStatus(status)
        }
    }
}
