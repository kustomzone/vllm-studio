//
//  APIClient.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation

/// Thread-safe API client for making HTTP requests to the vLLM Studio backend.
/// Uses async/await with automatic retry logic and exponential backoff.
actor APIClient {

    // MARK: - Singleton

    /// Shared instance of the API client
    static let shared = APIClient()

    // MARK: - Properties

    /// URL session for making requests
    private let session: URLSession

    /// JSON decoder with custom date decoding
    private let decoder: JSONDecoder

    /// JSON encoder for request bodies
    private let encoder: JSONEncoder

    /// Maximum number of retry attempts
    private let maxRetries: Int = 3

    /// Base delay for exponential backoff (in seconds)
    private let baseRetryDelay: TimeInterval = 1.0

    // MARK: - Initialization

    private init() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 300
        configuration.waitsForConnectivity = true

        self.session = URLSession(configuration: configuration)

        self.decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        self.encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.keyEncodingStrategy = .convertToSnakeCase
    }

    // MARK: - Base URL

    /// Gets the current base URL from user defaults
    private var baseURL: URL {
        get throws {
            let urlString = UserDefaultsManager.shared.serverURL
            guard let url = URL(string: urlString) else {
                throw NetworkError.invalidURL(urlString)
            }
            return url
        }
    }

    /// Gets the current API key from keychain
    private var apiKey: String? {
        KeychainManager.shared.getAPIKey()
    }

    // MARK: - Request Methods

    /// Performs a request and decodes the response
    /// - Parameters:
    ///   - endpoint: The API endpoint to call
    ///   - body: Optional request body (will be encoded as JSON)
    /// - Returns: Decoded response of type T
    func request<T: Decodable>(
        _ endpoint: APIEndpoint,
        body: (any Encodable)? = nil
    ) async throws -> T {
        let bodyData: Data?
        if let body = body {
            bodyData = try encoder.encode(body)
        } else {
            bodyData = nil
        }

        let request = try endpoint.request(
            baseURL: try baseURL,
            apiKey: apiKey,
            body: bodyData
        )

        return try await performRequest(request, retries: maxRetries)
    }

    /// Performs a request without expecting a response body
    /// - Parameters:
    ///   - endpoint: The API endpoint to call
    ///   - body: Optional request body
    func requestNoContent(
        _ endpoint: APIEndpoint,
        body: (any Encodable)? = nil
    ) async throws {
        let bodyData: Data?
        if let body = body {
            bodyData = try encoder.encode(body)
        } else {
            bodyData = nil
        }

        let request = try endpoint.request(
            baseURL: try baseURL,
            apiKey: apiKey,
            body: bodyData
        )

        let (_, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw NetworkError.from(statusCode: httpResponse.statusCode)
        }
    }

    /// Performs a streaming request using Server-Sent Events
    /// - Parameters:
    ///   - endpoint: The API endpoint to call
    ///   - body: Request body
    /// - Returns: AsyncThrowingStream of SSE events
    func stream(
        _ endpoint: APIEndpoint,
        body: (any Encodable)? = nil
    ) async throws -> AsyncThrowingStream<SSEEvent, Error> {
        guard endpoint.supportsStreaming else {
            throw NetworkError.custom("Endpoint does not support streaming")
        }

        let bodyData: Data?
        if let body = body {
            bodyData = try encoder.encode(body)
        } else {
            bodyData = nil
        }

        var request = try endpoint.request(
            baseURL: try baseURL,
            apiKey: apiKey,
            body: bodyData
        )
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")

        let (bytes, response) = try await session.bytes(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw NetworkError.from(statusCode: httpResponse.statusCode)
        }

        return AsyncThrowingStream { continuation in
            Task {
                var buffer = ""

                do {
                    for try await byte in bytes {
                        let char = Character(UnicodeScalar(byte))
                        buffer.append(char)

                        // Check for complete SSE event (ends with double newline)
                        while let range = buffer.range(of: "\n\n") {
                            let eventString = String(buffer[..<range.lowerBound])
                            buffer = String(buffer[range.upperBound...])

                            if let event = SSEEvent.parse(eventString) {
                                if event.event == "done" || event.data == "[DONE]" {
                                    continuation.finish()
                                    return
                                }
                                continuation.yield(event)
                            }
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    // MARK: - Private Methods

    /// Performs a request with retry logic
    private func performRequest<T: Decodable>(
        _ request: URLRequest,
        retries: Int
    ) async throws -> T {
        var lastError: Error?

        for attempt in 0..<retries {
            do {
                let (data, response) = try await session.data(for: request)

                guard let httpResponse = response as? HTTPURLResponse else {
                    throw NetworkError.invalidResponse
                }

                guard (200...299).contains(httpResponse.statusCode) else {
                    let error = NetworkError.from(statusCode: httpResponse.statusCode, data: data)

                    // Don't retry non-retryable errors
                    if !error.isRetryable {
                        throw error
                    }

                    lastError = error
                    continue
                }

                // Handle empty response
                if data.isEmpty {
                    if T.self == EmptyResponse.self {
                        return EmptyResponse() as! T
                    }
                    throw NetworkError.emptyResponse
                }

                return try decoder.decode(T.self, from: data)

            } catch let urlError as URLError {
                let networkError = NetworkError.from(urlError: urlError)

                // Don't retry non-retryable errors
                if !networkError.isRetryable {
                    throw networkError
                }

                lastError = networkError
            } catch let decodingError as DecodingError {
                throw NetworkError.decodingError(decodingError)
            } catch let networkError as NetworkError {
                if !networkError.isRetryable {
                    throw networkError
                }
                lastError = networkError
            } catch {
                lastError = error
            }

            // Exponential backoff before retry
            if attempt < retries - 1 {
                let delay = baseRetryDelay * pow(2, Double(attempt))
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            }
        }

        throw lastError ?? NetworkError.unknown(nil)
    }

    // MARK: - Health Check

    /// Checks if the server is reachable
    func healthCheck() async -> Bool {
        do {
            let _: HealthResponse = try await request(.health)
            return true
        } catch {
            return false
        }
    }
}

// MARK: - Supporting Types

/// Empty response placeholder
struct EmptyResponse: Decodable {}

/// Health check response
struct HealthResponse: Decodable {
    let status: String
}

/// Server-Sent Event
struct SSEEvent {
    let event: String?
    let data: String
    let id: String?

    /// Parses an SSE event from a string
    static func parse(_ string: String) -> SSEEvent? {
        var event: String?
        var data: String = ""
        var id: String?

        for line in string.components(separatedBy: "\n") {
            if line.hasPrefix("event:") {
                event = String(line.dropFirst(6)).trimmingCharacters(in: .whitespaces)
            } else if line.hasPrefix("data:") {
                let dataLine = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                if !data.isEmpty {
                    data += "\n"
                }
                data += dataLine
            } else if line.hasPrefix("id:") {
                id = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
            }
        }

        guard !data.isEmpty else { return nil }

        return SSEEvent(event: event, data: data, id: id)
    }
}

// MARK: - Convenience Extensions

extension APIClient {

    /// Fetches GPU metrics
    func fetchGPUMetrics() async throws -> [GPUMetric] {
        try await request(.gpus)
    }

    /// Fetches server status
    func fetchStatus() async throws -> ServerStatusResponse {
        try await request(.status)
    }

    /// Fetches all recipes
    func fetchRecipes() async throws -> [Recipe] {
        try await request(.recipes)
    }

    /// Launches a model from a recipe
    func launchModel(recipeId: String) async throws -> LaunchResponse {
        try await request(.launch(recipeId: recipeId))
    }

    /// Evicts the current model
    func evictModel() async throws {
        try await requestNoContent(.evict)
    }
}

// MARK: - Response Types

/// Server status response
struct ServerStatusResponse: Decodable {
    let status: String
    let modelLoaded: Bool
    let activeModel: String?
    let uptime: TimeInterval?
}

/// Model launch response
struct LaunchResponse: Decodable {
    let success: Bool
    let modelId: String?
    let message: String?
}
