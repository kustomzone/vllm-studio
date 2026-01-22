//
//  String+Extensions.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation

// MARK: - Validation

extension String {

    /// Whether the string is empty or contains only whitespace
    var isBlank: Bool {
        trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Whether the string contains a valid URL
    var isValidURL: Bool {
        guard let url = URL(string: self) else { return false }
        return url.scheme != nil && url.host != nil
    }

    /// Whether the string appears to be a valid API key
    var isValidAPIKeyFormat: Bool {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.count >= 8 && !trimmed.contains(" ")
    }
}

// MARK: - Truncation

extension String {

    /// Truncates the string to a maximum length with ellipsis
    /// - Parameters:
    ///   - length: Maximum length
    ///   - trailing: Trailing string (default: "...")
    func truncated(to length: Int, trailing: String = "...") -> String {
        if self.count > length {
            return String(self.prefix(length - trailing.count)) + trailing
        }
        return self
    }

    /// Truncates from the middle of the string
    /// - Parameter length: Maximum length
    func truncatedMiddle(to length: Int) -> String {
        guard self.count > length else { return self }

        let halfLength = (length - 3) / 2
        let start = String(self.prefix(halfLength))
        let end = String(self.suffix(halfLength))

        return "\(start)...\(end)"
    }
}

// MARK: - Formatting

extension String {

    /// Capitalizes only the first letter
    var capitalizedFirst: String {
        guard let first = first else { return self }
        return String(first).uppercased() + dropFirst()
    }

    /// Converts camelCase to Title Case
    var camelCaseToTitleCase: String {
        let pattern = "([a-z])([A-Z])"
        let regex = try? NSRegularExpression(pattern: pattern, options: [])
        let range = NSRange(location: 0, length: self.count)
        let result = regex?.stringByReplacingMatches(
            in: self,
            options: [],
            range: range,
            withTemplate: "$1 $2"
        ) ?? self
        return result.capitalizedFirst
    }

    /// Converts snake_case to Title Case
    var snakeCaseToTitleCase: String {
        replacingOccurrences(of: "_", with: " ").capitalized
    }

    /// Converts to snake_case
    var snakeCased: String {
        let pattern = "([a-z0-9])([A-Z])"
        let regex = try? NSRegularExpression(pattern: pattern, options: [])
        let range = NSRange(location: 0, length: self.count)
        let result = regex?.stringByReplacingMatches(
            in: self,
            options: [],
            range: range,
            withTemplate: "$1_$2"
        ) ?? self
        return result.lowercased()
    }
}

// MARK: - Code Parsing

extension String {

    /// Extracts code blocks from markdown
    var codeBlocks: [(language: String?, code: String)] {
        var blocks: [(language: String?, code: String)] = []
        let pattern = "```([\\w]*)?\\n([\\s\\S]*?)```"

        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return blocks
        }

        let range = NSRange(location: 0, length: self.utf16.count)
        let matches = regex.matches(in: self, options: [], range: range)

        for match in matches {
            var language: String?
            var code = ""

            if let langRange = Range(match.range(at: 1), in: self) {
                let lang = String(self[langRange])
                if !lang.isEmpty {
                    language = lang
                }
            }

            if let codeRange = Range(match.range(at: 2), in: self) {
                code = String(self[codeRange])
            }

            blocks.append((language, code))
        }

        return blocks
    }

    /// Extracts thinking blocks from text
    var thinkingBlocks: [String] {
        var blocks: [String] = []
        let pattern = "<thinking>([\\s\\S]*?)</thinking>"

        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return blocks
        }

        let range = NSRange(location: 0, length: self.utf16.count)
        let matches = regex.matches(in: self, options: [], range: range)

        for match in matches {
            if let range = Range(match.range(at: 1), in: self) {
                blocks.append(String(self[range]))
            }
        }

        return blocks
    }

    /// Removes thinking blocks from text
    var withoutThinkingBlocks: String {
        let pattern = "<thinking>[\\s\\S]*?</thinking>"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return self
        }
        let range = NSRange(location: 0, length: self.utf16.count)
        return regex.stringByReplacingMatches(in: self, options: [], range: range, withTemplate: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

// MARK: - JSON

extension String {

    /// Attempts to pretty-print JSON
    var prettyPrintedJSON: String? {
        guard let data = self.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data),
              let prettyData = try? JSONSerialization.data(withJSONObject: json, options: .prettyPrinted),
              let prettyString = String(data: prettyData, encoding: .utf8) else {
            return nil
        }
        return prettyString
    }

    /// Whether the string is valid JSON
    var isValidJSON: Bool {
        guard let data = self.data(using: .utf8) else { return false }
        return (try? JSONSerialization.jsonObject(with: data)) != nil
    }
}

// MARK: - Localization

extension String {

    /// Returns the localized version of the string
    var localized: String {
        NSLocalizedString(self, comment: "")
    }

    /// Returns the localized version with arguments
    func localized(with arguments: CVarArg...) -> String {
        String(format: localized, arguments: arguments)
    }
}

// MARK: - Token Estimation

extension String {

    /// Rough estimate of token count (words / 0.75)
    var estimatedTokenCount: Int {
        let words = components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .count
        return Int(Double(words) / 0.75)
    }
}
