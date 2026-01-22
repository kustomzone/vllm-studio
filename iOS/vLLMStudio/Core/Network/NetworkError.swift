//
//  NetworkError.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation

/// Comprehensive error types for network operations
enum NetworkError: LocalizedError {

    // MARK: - Connection Errors

    /// No internet connection available
    case noConnection

    /// Connection timed out
    case timeout

    /// Server is unreachable
    case serverUnreachable

    /// SSL/TLS certificate error
    case sslError(String)

    // MARK: - Authentication Errors

    /// Missing API key
    case missingAPIKey

    /// Invalid or expired API key
    case unauthorized

    /// Insufficient permissions
    case forbidden

    // MARK: - Request Errors

    /// Invalid URL
    case invalidURL(String)

    /// Invalid request parameters
    case invalidRequest(String)

    /// Request encoding failed
    case encodingError(Error)

    // MARK: - Response Errors

    /// Server returned an error status code
    case httpError(statusCode: Int, message: String?)

    /// Response decoding failed
    case decodingError(Error)

    /// Empty response when data was expected
    case emptyResponse

    /// Invalid response format
    case invalidResponse

    // MARK: - Server Errors

    /// Server internal error
    case serverError(String)

    /// Service unavailable
    case serviceUnavailable

    /// Rate limited
    case rateLimited(retryAfter: TimeInterval?)

    // MARK: - Streaming Errors

    /// SSE connection failed
    case sseConnectionFailed(String)

    /// SSE parsing error
    case sseParsingError(String)

    /// Stream was cancelled
    case streamCancelled

    // MARK: - WebSocket Errors

    /// WebSocket connection failed
    case webSocketConnectionFailed(String)

    /// WebSocket was disconnected unexpectedly
    case webSocketDisconnected

    // MARK: - Generic Errors

    /// Unknown error
    case unknown(Error?)

    /// Custom error with message
    case custom(String)

    // MARK: - LocalizedError

    var errorDescription: String? {
        switch self {
        case .noConnection:
            return "No internet connection. Please check your network settings."
        case .timeout:
            return "The request timed out. Please try again."
        case .serverUnreachable:
            return "Unable to reach the server. Please check the server URL in settings."
        case .sslError(let message):
            return "SSL Error: \(message)"
        case .missingAPIKey:
            return "API key is required. Please add your API key in settings."
        case .unauthorized:
            return "Invalid or expired API key. Please check your API key in settings."
        case .forbidden:
            return "You don't have permission to perform this action."
        case .invalidURL(let url):
            return "Invalid URL: \(url)"
        case .invalidRequest(let message):
            return "Invalid request: \(message)"
        case .encodingError(let error):
            return "Failed to encode request: \(error.localizedDescription)"
        case .httpError(let statusCode, let message):
            if let message = message {
                return "HTTP Error \(statusCode): \(message)"
            }
            return "HTTP Error \(statusCode)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .emptyResponse:
            return "Server returned an empty response."
        case .invalidResponse:
            return "Invalid response from server."
        case .serverError(let message):
            return "Server error: \(message)"
        case .serviceUnavailable:
            return "Service is temporarily unavailable. Please try again later."
        case .rateLimited(let retryAfter):
            if let seconds = retryAfter {
                return "Rate limited. Please try again in \(Int(seconds)) seconds."
            }
            return "Rate limited. Please try again later."
        case .sseConnectionFailed(let message):
            return "Failed to establish streaming connection: \(message)"
        case .sseParsingError(let message):
            return "Error parsing stream data: \(message)"
        case .streamCancelled:
            return "Stream was cancelled."
        case .webSocketConnectionFailed(let message):
            return "WebSocket connection failed: \(message)"
        case .webSocketDisconnected:
            return "WebSocket connection was lost."
        case .unknown(let error):
            if let error = error {
                return "An unknown error occurred: \(error.localizedDescription)"
            }
            return "An unknown error occurred."
        case .custom(let message):
            return message
        }
    }

    var failureReason: String? {
        errorDescription
    }

    var recoverySuggestion: String? {
        switch self {
        case .noConnection:
            return "Check your Wi-Fi or cellular connection."
        case .timeout, .serverUnreachable:
            return "Make sure the vLLM server is running and accessible."
        case .missingAPIKey, .unauthorized:
            return "Go to Settings and enter a valid API key."
        case .rateLimited:
            return "Wait before making another request."
        default:
            return nil
        }
    }

    // MARK: - Convenience Properties

    /// Whether this error is recoverable by retrying
    var isRetryable: Bool {
        switch self {
        case .timeout, .serverUnreachable, .serviceUnavailable, .rateLimited:
            return true
        case .httpError(let statusCode, _):
            return statusCode >= 500 || statusCode == 429
        default:
            return false
        }
    }

    /// Whether this error requires user authentication action
    var requiresAuthentication: Bool {
        switch self {
        case .missingAPIKey, .unauthorized, .forbidden:
            return true
        default:
            return false
        }
    }

    // MARK: - Factory Methods

    /// Creates a NetworkError from an HTTP status code
    static func from(statusCode: Int, data: Data? = nil) -> NetworkError {
        var message: String?
        if let data = data {
            message = String(data: data, encoding: .utf8)
        }

        switch statusCode {
        case 401:
            return .unauthorized
        case 403:
            return .forbidden
        case 404:
            return .httpError(statusCode: 404, message: "Resource not found")
        case 429:
            return .rateLimited(retryAfter: nil)
        case 500...599:
            return .serverError(message ?? "Internal server error")
        default:
            return .httpError(statusCode: statusCode, message: message)
        }
    }

    /// Creates a NetworkError from a URLError
    static func from(urlError: URLError) -> NetworkError {
        switch urlError.code {
        case .notConnectedToInternet, .networkConnectionLost:
            return .noConnection
        case .timedOut:
            return .timeout
        case .cannotFindHost, .cannotConnectToHost:
            return .serverUnreachable
        case .serverCertificateUntrusted, .serverCertificateHasBadDate:
            return .sslError(urlError.localizedDescription)
        case .cancelled:
            return .streamCancelled
        default:
            return .unknown(urlError)
        }
    }
}

// MARK: - API Error Response

/// Standard error response format from the API
struct APIErrorResponse: Codable {
    let error: String?
    let message: String?
    let statusCode: Int?
    let details: [String: String]?

    var displayMessage: String {
        message ?? error ?? "Unknown error"
    }
}
