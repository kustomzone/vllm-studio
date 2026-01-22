//
//  NetworkError.swift
//  vLLMStudio
//
//  Created for vLLM Studio iOS
//  Comprehensive network error types for the application
//

import Foundation

/// Comprehensive error types for network operations
public enum NetworkError: Error, LocalizedError, Equatable, Sendable {
    // MARK: - Request Errors

    /// Invalid URL construction
    case invalidURL(String)

    /// Request encoding failed
    case encodingFailed(String)

    /// Missing required authentication token
    case missingAuthToken

    /// Invalid request configuration
    case invalidRequest(String)

    // MARK: - Response Errors

    /// Server returned an error status code
    case serverError(statusCode: Int, message: String?)

    /// Unauthorized access (401)
    case unauthorized

    /// Forbidden access (403)
    case forbidden

    /// Resource not found (404)
    case notFound(resource: String)

    /// Rate limited (429)
    case rateLimited(retryAfter: TimeInterval?)

    /// Server unavailable (503)
    case serviceUnavailable

    /// Decoding response failed
    case decodingFailed(String)

    /// Empty response when data was expected
    case emptyResponse

    /// Invalid response format
    case invalidResponse(String)

    // MARK: - Connection Errors

    /// No network connection available
    case noConnection

    /// Request timed out
    case timeout

    /// Connection was cancelled
    case cancelled

    /// SSL/TLS certificate error
    case sslError(String)

    /// DNS resolution failed
    case dnsLookupFailed

    /// Connection refused by server
    case connectionRefused

    // MARK: - Streaming Errors

    /// SSE connection failed
    case sseConnectionFailed(String)

    /// SSE stream terminated unexpectedly
    case sseStreamTerminated

    /// SSE event parsing failed
    case sseParsingFailed(String)

    /// WebSocket connection failed
    case webSocketConnectionFailed(String)

    /// WebSocket disconnected unexpectedly
    case webSocketDisconnected(code: Int?, reason: String?)

    /// WebSocket message sending failed
    case webSocketSendFailed(String)

    // MARK: - Retry Errors

    /// Maximum retry attempts exceeded
    case maxRetriesExceeded(attempts: Int, lastError: String)

    // MARK: - Unknown Errors

    /// Unknown or unexpected error
    case unknown(String)

    // MARK: - LocalizedError Implementation

    public var errorDescription: String? {
        switch self {
        case .invalidURL(let url):
            return "Invalid URL: \(url)"

        case .encodingFailed(let reason):
            return "Failed to encode request: \(reason)"

        case .missingAuthToken:
            return "Authentication token is missing. Please configure your API key."

        case .invalidRequest(let reason):
            return "Invalid request: \(reason)"

        case .serverError(let statusCode, let message):
            if let message = message {
                return "Server error (\(statusCode)): \(message)"
            }
            return "Server error (\(statusCode))"

        case .unauthorized:
            return "Unauthorized. Please check your API key."

        case .forbidden:
            return "Access forbidden. You don't have permission to access this resource."

        case .notFound(let resource):
            return "Resource not found: \(resource)"

        case .rateLimited(let retryAfter):
            if let retryAfter = retryAfter {
                return "Rate limited. Please retry after \(Int(retryAfter)) seconds."
            }
            return "Rate limited. Please try again later."

        case .serviceUnavailable:
            return "Service temporarily unavailable. Please try again later."

        case .decodingFailed(let reason):
            return "Failed to decode response: \(reason)"

        case .emptyResponse:
            return "Received empty response from server"

        case .invalidResponse(let reason):
            return "Invalid response: \(reason)"

        case .noConnection:
            return "No network connection. Please check your internet connection."

        case .timeout:
            return "Request timed out. Please try again."

        case .cancelled:
            return "Request was cancelled."

        case .sslError(let reason):
            return "SSL/TLS error: \(reason)"

        case .dnsLookupFailed:
            return "Could not resolve server address. Please check the server URL."

        case .connectionRefused:
            return "Connection refused by server. Please ensure the server is running."

        case .sseConnectionFailed(let reason):
            return "SSE connection failed: \(reason)"

        case .sseStreamTerminated:
            return "Streaming connection terminated unexpectedly."

        case .sseParsingFailed(let reason):
            return "Failed to parse streaming event: \(reason)"

        case .webSocketConnectionFailed(let reason):
            return "WebSocket connection failed: \(reason)"

        case .webSocketDisconnected(let code, let reason):
            var message = "WebSocket disconnected"
            if let code = code {
                message += " (code: \(code))"
            }
            if let reason = reason {
                message += ": \(reason)"
            }
            return message

        case .webSocketSendFailed(let reason):
            return "Failed to send WebSocket message: \(reason)"

        case .maxRetriesExceeded(let attempts, let lastError):
            return "Request failed after \(attempts) attempts. Last error: \(lastError)"

        case .unknown(let description):
            return "An unexpected error occurred: \(description)"
        }
    }

    public var failureReason: String? {
        errorDescription
    }

    public var recoverySuggestion: String? {
        switch self {
        case .missingAuthToken, .unauthorized:
            return "Go to Settings and enter your API key."

        case .noConnection:
            return "Check your Wi-Fi or cellular connection."

        case .timeout, .serviceUnavailable:
            return "Wait a moment and try again."

        case .rateLimited:
            return "Wait for the rate limit to reset before retrying."

        case .connectionRefused:
            return "Verify the server URL in Settings and ensure the server is running."

        case .sslError:
            return "Check the server's SSL certificate configuration."

        default:
            return nil
        }
    }

    // MARK: - Equatable

    public static func == (lhs: NetworkError, rhs: NetworkError) -> Bool {
        switch (lhs, rhs) {
        case (.invalidURL(let a), .invalidURL(let b)):
            return a == b
        case (.encodingFailed(let a), .encodingFailed(let b)):
            return a == b
        case (.missingAuthToken, .missingAuthToken):
            return true
        case (.invalidRequest(let a), .invalidRequest(let b)):
            return a == b
        case (.serverError(let aCode, let aMsg), .serverError(let bCode, let bMsg)):
            return aCode == bCode && aMsg == bMsg
        case (.unauthorized, .unauthorized):
            return true
        case (.forbidden, .forbidden):
            return true
        case (.notFound(let a), .notFound(let b)):
            return a == b
        case (.rateLimited(let a), .rateLimited(let b)):
            return a == b
        case (.serviceUnavailable, .serviceUnavailable):
            return true
        case (.decodingFailed(let a), .decodingFailed(let b)):
            return a == b
        case (.emptyResponse, .emptyResponse):
            return true
        case (.invalidResponse(let a), .invalidResponse(let b)):
            return a == b
        case (.noConnection, .noConnection):
            return true
        case (.timeout, .timeout):
            return true
        case (.cancelled, .cancelled):
            return true
        case (.sslError(let a), .sslError(let b)):
            return a == b
        case (.dnsLookupFailed, .dnsLookupFailed):
            return true
        case (.connectionRefused, .connectionRefused):
            return true
        case (.sseConnectionFailed(let a), .sseConnectionFailed(let b)):
            return a == b
        case (.sseStreamTerminated, .sseStreamTerminated):
            return true
        case (.sseParsingFailed(let a), .sseParsingFailed(let b)):
            return a == b
        case (.webSocketConnectionFailed(let a), .webSocketConnectionFailed(let b)):
            return a == b
        case (.webSocketDisconnected(let aCode, let aReason), .webSocketDisconnected(let bCode, let bReason)):
            return aCode == bCode && aReason == bReason
        case (.webSocketSendFailed(let a), .webSocketSendFailed(let b)):
            return a == b
        case (.maxRetriesExceeded(let aAttempts, let aError), .maxRetriesExceeded(let bAttempts, let bError)):
            return aAttempts == bAttempts && aError == bError
        case (.unknown(let a), .unknown(let b)):
            return a == b
        default:
            return false
        }
    }

    // MARK: - Helpers

    /// Whether this error is recoverable through retry
    public var isRetryable: Bool {
        switch self {
        case .timeout, .serviceUnavailable, .noConnection, .sseStreamTerminated:
            return true
        case .rateLimited:
            return true
        case .serverError(let statusCode, _):
            return statusCode >= 500
        default:
            return false
        }
    }

    /// Whether this error requires user action to resolve
    public var requiresUserAction: Bool {
        switch self {
        case .missingAuthToken, .unauthorized, .forbidden:
            return true
        case .connectionRefused, .sslError, .dnsLookupFailed:
            return true
        default:
            return false
        }
    }

    /// Create a NetworkError from a URLError
    public static func from(urlError: URLError) -> NetworkError {
        switch urlError.code {
        case .notConnectedToInternet, .networkConnectionLost:
            return .noConnection
        case .timedOut:
            return .timeout
        case .cancelled:
            return .cancelled
        case .cannotFindHost:
            return .dnsLookupFailed
        case .cannotConnectToHost:
            return .connectionRefused
        case .secureConnectionFailed, .serverCertificateHasBadDate,
             .serverCertificateUntrusted, .serverCertificateHasUnknownRoot,
             .serverCertificateNotYetValid, .clientCertificateRejected:
            return .sslError(urlError.localizedDescription)
        default:
            return .unknown(urlError.localizedDescription)
        }
    }

    /// Create a NetworkError from an HTTP status code
    public static func from(statusCode: Int, data: Data? = nil) -> NetworkError {
        let message = data.flatMap { String(data: $0, encoding: .utf8) }

        switch statusCode {
        case 401:
            return .unauthorized
        case 403:
            return .forbidden
        case 404:
            return .notFound(resource: "Unknown")
        case 429:
            return .rateLimited(retryAfter: nil)
        case 503:
            return .serviceUnavailable
        case 400..<500:
            return .serverError(statusCode: statusCode, message: message)
        case 500..<600:
            return .serverError(statusCode: statusCode, message: message)
        default:
            return .serverError(statusCode: statusCode, message: message)
        }
    }

    /// Create a NetworkError from any Error
    public static func from(error: Error) -> NetworkError {
        if let networkError = error as? NetworkError {
            return networkError
        }
        if let urlError = error as? URLError {
            return from(urlError: urlError)
        }
        return .unknown(error.localizedDescription)
    }
}

// MARK: - Error Response Model

/// Standard error response from the API
public struct APIErrorResponse: Codable, Sendable {
    public let error: String?
    public let message: String?
    public let code: String?
    public let details: [String: String]?

    public var displayMessage: String {
        message ?? error ?? "An unknown error occurred"
    }
}
