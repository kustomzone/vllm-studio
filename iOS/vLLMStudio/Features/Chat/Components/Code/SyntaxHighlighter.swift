import SwiftUI

// MARK: - Language Definition

/// Supported programming languages for syntax highlighting
enum SyntaxLanguage: String, CaseIterable, Identifiable {
    case swift
    case python
    case javascript
    case typescript
    case json
    case html
    case css
    case bash
    case shell
    case sql
    case rust
    case go
    case java
    case kotlin
    case ruby
    case php
    case csharp = "c#"
    case cpp = "c++"
    case c
    case markdown
    case yaml
    case xml
    case plaintext

    var id: String { rawValue }

    /// Display name for the language
    var displayName: String {
        switch self {
        case .swift: return "Swift"
        case .python: return "Python"
        case .javascript: return "JavaScript"
        case .typescript: return "TypeScript"
        case .json: return "JSON"
        case .html: return "HTML"
        case .css: return "CSS"
        case .bash, .shell: return "Shell"
        case .sql: return "SQL"
        case .rust: return "Rust"
        case .go: return "Go"
        case .java: return "Java"
        case .kotlin: return "Kotlin"
        case .ruby: return "Ruby"
        case .php: return "PHP"
        case .csharp: return "C#"
        case .cpp: return "C++"
        case .c: return "C"
        case .markdown: return "Markdown"
        case .yaml: return "YAML"
        case .xml: return "XML"
        case .plaintext: return "Plain Text"
        }
    }

    /// Initialize from a language string (handles various aliases)
    init?(from string: String) {
        let normalized = string.lowercased().trimmingCharacters(in: .whitespaces)
        switch normalized {
        case "swift": self = .swift
        case "python", "py": self = .python
        case "javascript", "js": self = .javascript
        case "typescript", "ts": self = .typescript
        case "json": self = .json
        case "html": self = .html
        case "css": self = .css
        case "bash", "sh", "zsh": self = .bash
        case "shell": self = .shell
        case "sql": self = .sql
        case "rust", "rs": self = .rust
        case "go", "golang": self = .go
        case "java": self = .java
        case "kotlin", "kt": self = .kotlin
        case "ruby", "rb": self = .ruby
        case "php": self = .php
        case "c#", "csharp": self = .csharp
        case "c++", "cpp": self = .cpp
        case "c": self = .c
        case "markdown", "md": self = .markdown
        case "yaml", "yml": self = .yaml
        case "xml": self = .xml
        case "text", "plaintext", "": self = .plaintext
        default: return nil
        }
    }
}

// MARK: - Syntax Colors

/// Color scheme for syntax highlighting (matching web app dark theme)
struct SyntaxColors {
    // Base colors
    let background = Color(hex: "#1a1a1a")
    let text = Color(hex: "#e8e6e3")
    let lineNumber = Color(hex: "#6b7280")

    // Token colors
    let keyword = Color(hex: "#c678dd")       // Purple - keywords
    let string = Color(hex: "#98c379")        // Green - strings
    let number = Color(hex: "#d19a66")        // Orange - numbers
    let comment = Color(hex: "#5c6370")       // Gray - comments
    let function = Color(hex: "#61afef")      // Blue - functions
    let type = Color(hex: "#e5c07b")          // Yellow - types
    let variable = Color(hex: "#e06c75")      // Red - variables
    let property = Color(hex: "#e06c75")      // Red - properties
    let `operator` = Color(hex: "#56b6c2")    // Cyan - operators
    let punctuation = Color(hex: "#abb2bf")   // Light gray - punctuation
    let attribute = Color(hex: "#d19a66")     // Orange - attributes
    let constant = Color(hex: "#56b6c2")      // Cyan - constants
    let tag = Color(hex: "#e06c75")           // Red - HTML/XML tags
    let attributeName = Color(hex: "#d19a66") // Orange - attribute names
    let attributeValue = Color(hex: "#98c379") // Green - attribute values

    static let shared = SyntaxColors()
}

// MARK: - Token Type

/// Types of tokens for syntax highlighting
enum TokenType {
    case text
    case keyword
    case string
    case number
    case comment
    case function
    case type
    case variable
    case property
    case `operator`
    case punctuation
    case attribute
    case constant
    case tag
    case attributeName
    case attributeValue

    var color: Color {
        let colors = SyntaxColors.shared
        switch self {
        case .text: return colors.text
        case .keyword: return colors.keyword
        case .string: return colors.string
        case .number: return colors.number
        case .comment: return colors.comment
        case .function: return colors.function
        case .type: return colors.type
        case .variable: return colors.variable
        case .property: return colors.property
        case .operator: return colors.operator
        case .punctuation: return colors.punctuation
        case .attribute: return colors.attribute
        case .constant: return colors.constant
        case .tag: return colors.tag
        case .attributeName: return colors.attributeName
        case .attributeValue: return colors.attributeValue
        }
    }
}

// MARK: - Token

/// A single syntax token
struct SyntaxToken {
    let text: String
    let type: TokenType
}

// MARK: - Syntax Highlighter

/// Main syntax highlighter class that produces AttributedString output
final class SyntaxHighlighter {

    // MARK: - Language Keywords

    private static let swiftKeywords: Set<String> = [
        "actor", "any", "as", "associatedtype", "async", "await", "break", "case",
        "catch", "class", "continue", "convenience", "default", "defer", "deinit",
        "didSet", "do", "dynamic", "else", "enum", "extension", "fallthrough",
        "false", "fileprivate", "final", "for", "func", "get", "guard", "if",
        "import", "in", "indirect", "infix", "init", "inout", "internal", "is",
        "isolated", "lazy", "let", "mutating", "nil", "nonisolated", "nonmutating",
        "open", "operator", "optional", "override", "postfix", "precedencegroup",
        "prefix", "private", "protocol", "public", "repeat", "required", "rethrows",
        "return", "self", "Self", "set", "some", "static", "struct", "subscript",
        "super", "switch", "throw", "throws", "true", "try", "typealias", "unowned",
        "var", "weak", "where", "while", "willSet"
    ]

    private static let pythonKeywords: Set<String> = [
        "False", "None", "True", "and", "as", "assert", "async", "await", "break",
        "class", "continue", "def", "del", "elif", "else", "except", "finally",
        "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal",
        "not", "or", "pass", "raise", "return", "try", "while", "with", "yield"
    ]

    private static let jsKeywords: Set<String> = [
        "async", "await", "break", "case", "catch", "class", "const", "continue",
        "debugger", "default", "delete", "do", "else", "export", "extends", "false",
        "finally", "for", "function", "if", "import", "in", "instanceof", "let",
        "new", "null", "of", "return", "static", "super", "switch", "this", "throw",
        "true", "try", "typeof", "undefined", "var", "void", "while", "with", "yield"
    ]

    private static let rustKeywords: Set<String> = [
        "as", "async", "await", "break", "const", "continue", "crate", "dyn", "else",
        "enum", "extern", "false", "fn", "for", "if", "impl", "in", "let", "loop",
        "match", "mod", "move", "mut", "pub", "ref", "return", "self", "Self",
        "static", "struct", "super", "trait", "true", "type", "unsafe", "use",
        "where", "while"
    ]

    private static let goKeywords: Set<String> = [
        "break", "case", "chan", "const", "continue", "default", "defer", "else",
        "fallthrough", "for", "func", "go", "goto", "if", "import", "interface",
        "map", "package", "range", "return", "select", "struct", "switch", "type",
        "var"
    ]

    private static let sqlKeywords: Set<String> = [
        "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "UPDATE", "SET",
        "DELETE", "CREATE", "TABLE", "ALTER", "DROP", "INDEX", "JOIN", "LEFT",
        "RIGHT", "INNER", "OUTER", "ON", "AND", "OR", "NOT", "IN", "IS", "NULL",
        "ORDER", "BY", "GROUP", "HAVING", "LIMIT", "OFFSET", "AS", "DISTINCT",
        "COUNT", "SUM", "AVG", "MAX", "MIN", "LIKE", "BETWEEN", "EXISTS", "CASE",
        "WHEN", "THEN", "ELSE", "END", "PRIMARY", "KEY", "FOREIGN", "REFERENCES"
    ]

    private static let operators: Set<String> = [
        "+", "-", "*", "/", "%", "=", "==", "===", "!=", "!==", "<", ">", "<=",
        ">=", "&&", "||", "!", "&", "|", "^", "~", "<<", ">>", "?", ":", ".",
        "->", "=>", "..", "...", "??", "?.", "::", "@"
    ]

    private static let punctuation: Set<String> = [
        "(", ")", "[", "]", "{", "}", ",", ";", ":"
    ]

    // MARK: - Public API

    /// Highlight code and return AttributedString
    static func highlight(_ code: String, language: SyntaxLanguage) -> AttributedString {
        let tokens = tokenize(code, language: language)
        return attributedString(from: tokens)
    }

    /// Highlight code with line numbers
    static func highlightWithLineNumbers(_ code: String, language: SyntaxLanguage) -> [(lineNumber: Int, content: AttributedString)] {
        let lines = code.components(separatedBy: "\n")
        return lines.enumerated().map { index, line in
            let tokens = tokenize(line, language: language)
            return (index + 1, attributedString(from: tokens))
        }
    }

    // MARK: - Private Methods

    private static func tokenize(_ code: String, language: SyntaxLanguage) -> [SyntaxToken] {
        switch language {
        case .swift:
            return tokenizeSwift(code)
        case .python:
            return tokenizePython(code)
        case .javascript, .typescript:
            return tokenizeJavaScript(code)
        case .json:
            return tokenizeJSON(code)
        case .html, .xml:
            return tokenizeHTML(code)
        case .css:
            return tokenizeCSS(code)
        case .bash, .shell:
            return tokenizeBash(code)
        case .sql:
            return tokenizeSQL(code)
        case .rust:
            return tokenizeRust(code)
        case .go:
            return tokenizeGo(code)
        case .java, .kotlin, .csharp, .cpp, .c:
            return tokenizeCLike(code)
        default:
            return [SyntaxToken(text: code, type: .text)]
        }
    }

    // MARK: - Swift Tokenizer

    private static func tokenizeSwift(_ code: String) -> [SyntaxToken] {
        var tokens: [SyntaxToken] = []
        var index = code.startIndex

        while index < code.endIndex {
            let remaining = String(code[index...])

            // Check for comments
            if remaining.hasPrefix("//") {
                let endIndex = remaining.firstIndex(of: "\n") ?? remaining.endIndex
                let comment = String(remaining[..<endIndex])
                tokens.append(SyntaxToken(text: comment, type: .comment))
                index = code.index(index, offsetBy: comment.count)
                continue
            }

            // Check for multi-line comments
            if remaining.hasPrefix("/*") {
                if let endRange = remaining.range(of: "*/") {
                    let endOffset = remaining.distance(from: remaining.startIndex, to: endRange.upperBound)
                    let comment = String(remaining.prefix(endOffset))
                    tokens.append(SyntaxToken(text: comment, type: .comment))
                    index = code.index(index, offsetBy: endOffset)
                    continue
                }
            }

            // Check for strings
            if remaining.hasPrefix("\"") {
                if let stringToken = extractString(from: remaining, delimiter: "\"") {
                    tokens.append(SyntaxToken(text: stringToken, type: .string))
                    index = code.index(index, offsetBy: stringToken.count)
                    continue
                }
            }

            // Check for numbers
            if let numberToken = extractNumber(from: remaining) {
                tokens.append(SyntaxToken(text: numberToken, type: .number))
                index = code.index(index, offsetBy: numberToken.count)
                continue
            }

            // Check for identifiers/keywords
            if let word = extractWord(from: remaining) {
                let type: TokenType
                if swiftKeywords.contains(word) {
                    type = .keyword
                } else if word.first?.isUppercase == true {
                    type = .type
                } else {
                    type = .text
                }
                tokens.append(SyntaxToken(text: word, type: type))
                index = code.index(index, offsetBy: word.count)
                continue
            }

            // Check for operators and punctuation
            if let opToken = extractOperator(from: remaining) {
                tokens.append(SyntaxToken(text: opToken, type: .operator))
                index = code.index(index, offsetBy: opToken.count)
                continue
            }

            // Single character
            tokens.append(SyntaxToken(text: String(code[index]), type: .text))
            index = code.index(after: index)
        }

        return tokens
    }

    // MARK: - Python Tokenizer

    private static func tokenizePython(_ code: String) -> [SyntaxToken] {
        var tokens: [SyntaxToken] = []
        var index = code.startIndex

        while index < code.endIndex {
            let remaining = String(code[index...])

            // Check for comments
            if remaining.hasPrefix("#") {
                let endIndex = remaining.firstIndex(of: "\n") ?? remaining.endIndex
                let comment = String(remaining[..<endIndex])
                tokens.append(SyntaxToken(text: comment, type: .comment))
                index = code.index(index, offsetBy: comment.count)
                continue
            }

            // Check for triple-quoted strings
            if remaining.hasPrefix("\"\"\"") || remaining.hasPrefix("'''") {
                let delimiter = String(remaining.prefix(3))
                if let stringToken = extractTripleString(from: remaining, delimiter: delimiter) {
                    tokens.append(SyntaxToken(text: stringToken, type: .string))
                    index = code.index(index, offsetBy: stringToken.count)
                    continue
                }
            }

            // Check for strings
            if remaining.hasPrefix("\"") || remaining.hasPrefix("'") {
                let delimiter = String(remaining.first!)
                if let stringToken = extractString(from: remaining, delimiter: delimiter) {
                    tokens.append(SyntaxToken(text: stringToken, type: .string))
                    index = code.index(index, offsetBy: stringToken.count)
                    continue
                }
            }

            // Check for numbers
            if let numberToken = extractNumber(from: remaining) {
                tokens.append(SyntaxToken(text: numberToken, type: .number))
                index = code.index(index, offsetBy: numberToken.count)
                continue
            }

            // Check for identifiers/keywords
            if let word = extractWord(from: remaining) {
                let type: TokenType
                if pythonKeywords.contains(word) {
                    type = .keyword
                } else if word.first?.isUppercase == true {
                    type = .type
                } else if remaining.dropFirst(word.count).first == "(" {
                    type = .function
                } else {
                    type = .text
                }
                tokens.append(SyntaxToken(text: word, type: type))
                index = code.index(index, offsetBy: word.count)
                continue
            }

            // Check for operators
            if let opToken = extractOperator(from: remaining) {
                tokens.append(SyntaxToken(text: opToken, type: .operator))
                index = code.index(index, offsetBy: opToken.count)
                continue
            }

            // Single character
            tokens.append(SyntaxToken(text: String(code[index]), type: .text))
            index = code.index(after: index)
        }

        return tokens
    }

    // MARK: - JavaScript Tokenizer

    private static func tokenizeJavaScript(_ code: String) -> [SyntaxToken] {
        var tokens: [SyntaxToken] = []
        var index = code.startIndex

        while index < code.endIndex {
            let remaining = String(code[index...])

            // Check for comments
            if remaining.hasPrefix("//") {
                let endIndex = remaining.firstIndex(of: "\n") ?? remaining.endIndex
                let comment = String(remaining[..<endIndex])
                tokens.append(SyntaxToken(text: comment, type: .comment))
                index = code.index(index, offsetBy: comment.count)
                continue
            }

            if remaining.hasPrefix("/*") {
                if let endRange = remaining.range(of: "*/") {
                    let endOffset = remaining.distance(from: remaining.startIndex, to: endRange.upperBound)
                    let comment = String(remaining.prefix(endOffset))
                    tokens.append(SyntaxToken(text: comment, type: .comment))
                    index = code.index(index, offsetBy: endOffset)
                    continue
                }
            }

            // Check for template literals
            if remaining.hasPrefix("`") {
                if let stringToken = extractString(from: remaining, delimiter: "`") {
                    tokens.append(SyntaxToken(text: stringToken, type: .string))
                    index = code.index(index, offsetBy: stringToken.count)
                    continue
                }
            }

            // Check for strings
            if remaining.hasPrefix("\"") || remaining.hasPrefix("'") {
                let delimiter = String(remaining.first!)
                if let stringToken = extractString(from: remaining, delimiter: delimiter) {
                    tokens.append(SyntaxToken(text: stringToken, type: .string))
                    index = code.index(index, offsetBy: stringToken.count)
                    continue
                }
            }

            // Check for numbers
            if let numberToken = extractNumber(from: remaining) {
                tokens.append(SyntaxToken(text: numberToken, type: .number))
                index = code.index(index, offsetBy: numberToken.count)
                continue
            }

            // Check for identifiers/keywords
            if let word = extractWord(from: remaining) {
                let type: TokenType
                if jsKeywords.contains(word) {
                    type = .keyword
                } else if word.first?.isUppercase == true {
                    type = .type
                } else if remaining.dropFirst(word.count).first == "(" {
                    type = .function
                } else {
                    type = .text
                }
                tokens.append(SyntaxToken(text: word, type: type))
                index = code.index(index, offsetBy: word.count)
                continue
            }

            // Arrow function
            if remaining.hasPrefix("=>") {
                tokens.append(SyntaxToken(text: "=>", type: .operator))
                index = code.index(index, offsetBy: 2)
                continue
            }

            // Check for operators
            if let opToken = extractOperator(from: remaining) {
                tokens.append(SyntaxToken(text: opToken, type: .operator))
                index = code.index(index, offsetBy: opToken.count)
                continue
            }

            // Single character
            tokens.append(SyntaxToken(text: String(code[index]), type: .text))
            index = code.index(after: index)
        }

        return tokens
    }

    // MARK: - JSON Tokenizer

    private static func tokenizeJSON(_ code: String) -> [SyntaxToken] {
        var tokens: [SyntaxToken] = []
        var index = code.startIndex
        var expectingKey = true

        while index < code.endIndex {
            let remaining = String(code[index...])

            // Check for strings (keys or values)
            if remaining.hasPrefix("\"") {
                if let stringToken = extractString(from: remaining, delimiter: "\"") {
                    let type: TokenType = expectingKey ? .property : .string
                    tokens.append(SyntaxToken(text: stringToken, type: type))
                    index = code.index(index, offsetBy: stringToken.count)
                    continue
                }
            }

            // Check for numbers
            if let numberToken = extractNumber(from: remaining) {
                tokens.append(SyntaxToken(text: numberToken, type: .number))
                index = code.index(index, offsetBy: numberToken.count)
                expectingKey = false
                continue
            }

            // Check for keywords (true, false, null)
            if let word = extractWord(from: remaining) {
                let type: TokenType
                if ["true", "false", "null"].contains(word) {
                    type = .keyword
                } else {
                    type = .text
                }
                tokens.append(SyntaxToken(text: word, type: type))
                index = code.index(index, offsetBy: word.count)
                expectingKey = false
                continue
            }

            // Track state for key vs value
            let char = code[index]
            if char == ":" {
                expectingKey = false
            } else if char == "," || char == "{" || char == "[" {
                expectingKey = (char == "," || char == "{")
            }

            tokens.append(SyntaxToken(text: String(char), type: .punctuation))
            index = code.index(after: index)
        }

        return tokens
    }

    // MARK: - HTML Tokenizer

    private static func tokenizeHTML(_ code: String) -> [SyntaxToken] {
        var tokens: [SyntaxToken] = []
        var index = code.startIndex

        while index < code.endIndex {
            let remaining = String(code[index...])

            // Check for comments
            if remaining.hasPrefix("<!--") {
                if let endRange = remaining.range(of: "-->") {
                    let endOffset = remaining.distance(from: remaining.startIndex, to: endRange.upperBound)
                    let comment = String(remaining.prefix(endOffset))
                    tokens.append(SyntaxToken(text: comment, type: .comment))
                    index = code.index(index, offsetBy: endOffset)
                    continue
                }
            }

            // Check for tags
            if remaining.hasPrefix("<") {
                if let tagToken = extractHTMLTag(from: remaining) {
                    let tagTokens = tokenizeHTMLTag(tagToken)
                    tokens.append(contentsOf: tagTokens)
                    index = code.index(index, offsetBy: tagToken.count)
                    continue
                }
            }

            // Regular text
            if let textEnd = remaining.firstIndex(of: "<") {
                let text = String(remaining[..<textEnd])
                if !text.isEmpty {
                    tokens.append(SyntaxToken(text: text, type: .text))
                    index = code.index(index, offsetBy: text.count)
                    continue
                }
            }

            // Single character
            tokens.append(SyntaxToken(text: String(code[index]), type: .text))
            index = code.index(after: index)
        }

        return tokens
    }

    private static func tokenizeHTMLTag(_ tag: String) -> [SyntaxToken] {
        var tokens: [SyntaxToken] = []
        var index = tag.startIndex

        // Opening bracket
        tokens.append(SyntaxToken(text: "<", type: .punctuation))
        index = tag.index(after: index)

        // Check for closing tag
        if index < tag.endIndex && tag[index] == "/" {
            tokens.append(SyntaxToken(text: "/", type: .punctuation))
            index = tag.index(after: index)
        }

        // Tag name
        let remaining = String(tag[index...])
        if let tagName = extractWord(from: remaining) {
            tokens.append(SyntaxToken(text: tagName, type: .tag))
            index = tag.index(index, offsetBy: tagName.count)
        }

        // Attributes
        while index < tag.endIndex {
            let char = tag[index]

            if char == ">" || (char == "/" && tag.index(after: index) < tag.endIndex && tag[tag.index(after: index)] == ">") {
                break
            }

            if char.isWhitespace {
                tokens.append(SyntaxToken(text: String(char), type: .text))
                index = tag.index(after: index)
                continue
            }

            // Attribute name
            let attrRemaining = String(tag[index...])
            if let attrName = extractWord(from: attrRemaining) {
                tokens.append(SyntaxToken(text: attrName, type: .attributeName))
                index = tag.index(index, offsetBy: attrName.count)

                // Check for =
                if index < tag.endIndex && tag[index] == "=" {
                    tokens.append(SyntaxToken(text: "=", type: .punctuation))
                    index = tag.index(after: index)

                    // Attribute value
                    let valueRemaining = String(tag[index...])
                    if valueRemaining.hasPrefix("\"") {
                        if let value = extractString(from: valueRemaining, delimiter: "\"") {
                            tokens.append(SyntaxToken(text: value, type: .attributeValue))
                            index = tag.index(index, offsetBy: value.count)
                            continue
                        }
                    } else if valueRemaining.hasPrefix("'") {
                        if let value = extractString(from: valueRemaining, delimiter: "'") {
                            tokens.append(SyntaxToken(text: value, type: .attributeValue))
                            index = tag.index(index, offsetBy: value.count)
                            continue
                        }
                    }
                }
                continue
            }

            tokens.append(SyntaxToken(text: String(char), type: .text))
            index = tag.index(after: index)
        }

        // Self-closing
        if index < tag.endIndex && tag[index] == "/" {
            tokens.append(SyntaxToken(text: "/", type: .punctuation))
            index = tag.index(after: index)
        }

        // Closing bracket
        if index < tag.endIndex && tag[index] == ">" {
            tokens.append(SyntaxToken(text: ">", type: .punctuation))
        }

        return tokens
    }

    // MARK: - CSS Tokenizer

    private static func tokenizeCSS(_ code: String) -> [SyntaxToken] {
        var tokens: [SyntaxToken] = []
        var index = code.startIndex

        while index < code.endIndex {
            let remaining = String(code[index...])

            // Check for comments
            if remaining.hasPrefix("/*") {
                if let endRange = remaining.range(of: "*/") {
                    let endOffset = remaining.distance(from: remaining.startIndex, to: endRange.upperBound)
                    let comment = String(remaining.prefix(endOffset))
                    tokens.append(SyntaxToken(text: comment, type: .comment))
                    index = code.index(index, offsetBy: endOffset)
                    continue
                }
            }

            // Check for strings
            if remaining.hasPrefix("\"") || remaining.hasPrefix("'") {
                let delimiter = String(remaining.first!)
                if let stringToken = extractString(from: remaining, delimiter: delimiter) {
                    tokens.append(SyntaxToken(text: stringToken, type: .string))
                    index = code.index(index, offsetBy: stringToken.count)
                    continue
                }
            }

            // Check for numbers (including units)
            if let numberToken = extractCSSNumber(from: remaining) {
                tokens.append(SyntaxToken(text: numberToken, type: .number))
                index = code.index(index, offsetBy: numberToken.count)
                continue
            }

            // Check for selectors and properties
            if let word = extractCSSWord(from: remaining) {
                tokens.append(SyntaxToken(text: word, type: .property))
                index = code.index(index, offsetBy: word.count)
                continue
            }

            // Punctuation
            let char = code[index]
            if ["{", "}", ":", ";", ",", "(", ")", "[", "]"].contains(String(char)) {
                tokens.append(SyntaxToken(text: String(char), type: .punctuation))
            } else {
                tokens.append(SyntaxToken(text: String(char), type: .text))
            }
            index = code.index(after: index)
        }

        return tokens
    }

    // MARK: - Bash Tokenizer

    private static func tokenizeBash(_ code: String) -> [SyntaxToken] {
        var tokens: [SyntaxToken] = []
        var index = code.startIndex
        var isFirstWord = true

        while index < code.endIndex {
            let remaining = String(code[index...])

            // Check for comments
            if remaining.hasPrefix("#") && (index == code.startIndex || code[code.index(before: index)].isWhitespace || code[code.index(before: index)] == "\n") {
                let endIndex = remaining.firstIndex(of: "\n") ?? remaining.endIndex
                let comment = String(remaining[..<endIndex])
                tokens.append(SyntaxToken(text: comment, type: .comment))
                index = code.index(index, offsetBy: comment.count)
                isFirstWord = true
                continue
            }

            // Check for strings
            if remaining.hasPrefix("\"") || remaining.hasPrefix("'") {
                let delimiter = String(remaining.first!)
                if let stringToken = extractString(from: remaining, delimiter: delimiter) {
                    tokens.append(SyntaxToken(text: stringToken, type: .string))
                    index = code.index(index, offsetBy: stringToken.count)
                    isFirstWord = false
                    continue
                }
            }

            // Check for variables
            if remaining.hasPrefix("$") {
                if let varToken = extractBashVariable(from: remaining) {
                    tokens.append(SyntaxToken(text: varToken, type: .variable))
                    index = code.index(index, offsetBy: varToken.count)
                    isFirstWord = false
                    continue
                }
            }

            // Check for words
            if let word = extractWord(from: remaining) {
                let type: TokenType
                if isFirstWord && ["if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case", "esac", "function", "return", "exit", "export", "local", "readonly"].contains(word) {
                    type = .keyword
                } else if isFirstWord {
                    type = .function
                } else {
                    type = .text
                }
                tokens.append(SyntaxToken(text: word, type: type))
                index = code.index(index, offsetBy: word.count)
                isFirstWord = false
                continue
            }

            // Track line start
            let char = code[index]
            if char == "\n" || char == ";" || char == "|" || char == "&" {
                isFirstWord = true
            }

            tokens.append(SyntaxToken(text: String(char), type: .text))
            index = code.index(after: index)
        }

        return tokens
    }

    // MARK: - SQL Tokenizer

    private static func tokenizeSQL(_ code: String) -> [SyntaxToken] {
        var tokens: [SyntaxToken] = []
        var index = code.startIndex

        while index < code.endIndex {
            let remaining = String(code[index...])

            // Check for comments
            if remaining.hasPrefix("--") {
                let endIndex = remaining.firstIndex(of: "\n") ?? remaining.endIndex
                let comment = String(remaining[..<endIndex])
                tokens.append(SyntaxToken(text: comment, type: .comment))
                index = code.index(index, offsetBy: comment.count)
                continue
            }

            if remaining.hasPrefix("/*") {
                if let endRange = remaining.range(of: "*/") {
                    let endOffset = remaining.distance(from: remaining.startIndex, to: endRange.upperBound)
                    let comment = String(remaining.prefix(endOffset))
                    tokens.append(SyntaxToken(text: comment, type: .comment))
                    index = code.index(index, offsetBy: endOffset)
                    continue
                }
            }

            // Check for strings
            if remaining.hasPrefix("'") {
                if let stringToken = extractString(from: remaining, delimiter: "'") {
                    tokens.append(SyntaxToken(text: stringToken, type: .string))
                    index = code.index(index, offsetBy: stringToken.count)
                    continue
                }
            }

            // Check for numbers
            if let numberToken = extractNumber(from: remaining) {
                tokens.append(SyntaxToken(text: numberToken, type: .number))
                index = code.index(index, offsetBy: numberToken.count)
                continue
            }

            // Check for words
            if let word = extractWord(from: remaining) {
                let type: TokenType
                if sqlKeywords.contains(word.uppercased()) {
                    type = .keyword
                } else {
                    type = .text
                }
                tokens.append(SyntaxToken(text: word, type: type))
                index = code.index(index, offsetBy: word.count)
                continue
            }

            // Single character
            tokens.append(SyntaxToken(text: String(code[index]), type: .text))
            index = code.index(after: index)
        }

        return tokens
    }

    // MARK: - Rust Tokenizer

    private static func tokenizeRust(_ code: String) -> [SyntaxToken] {
        var tokens: [SyntaxToken] = []
        var index = code.startIndex

        while index < code.endIndex {
            let remaining = String(code[index...])

            // Check for comments
            if remaining.hasPrefix("//") {
                let endIndex = remaining.firstIndex(of: "\n") ?? remaining.endIndex
                let comment = String(remaining[..<endIndex])
                tokens.append(SyntaxToken(text: comment, type: .comment))
                index = code.index(index, offsetBy: comment.count)
                continue
            }

            if remaining.hasPrefix("/*") {
                if let endRange = remaining.range(of: "*/") {
                    let endOffset = remaining.distance(from: remaining.startIndex, to: endRange.upperBound)
                    let comment = String(remaining.prefix(endOffset))
                    tokens.append(SyntaxToken(text: comment, type: .comment))
                    index = code.index(index, offsetBy: endOffset)
                    continue
                }
            }

            // Check for strings
            if remaining.hasPrefix("\"") {
                if let stringToken = extractString(from: remaining, delimiter: "\"") {
                    tokens.append(SyntaxToken(text: stringToken, type: .string))
                    index = code.index(index, offsetBy: stringToken.count)
                    continue
                }
            }

            // Check for lifetime annotations
            if remaining.hasPrefix("'") && remaining.count > 1 {
                let afterQuote = remaining.dropFirst()
                if let word = extractWord(from: String(afterQuote)) {
                    let lifetime = "'" + word
                    tokens.append(SyntaxToken(text: lifetime, type: .attribute))
                    index = code.index(index, offsetBy: lifetime.count)
                    continue
                }
            }

            // Check for numbers
            if let numberToken = extractNumber(from: remaining) {
                tokens.append(SyntaxToken(text: numberToken, type: .number))
                index = code.index(index, offsetBy: numberToken.count)
                continue
            }

            // Check for macros
            if let word = extractWord(from: remaining) {
                let afterWord = remaining.dropFirst(word.count)
                let type: TokenType
                if rustKeywords.contains(word) {
                    type = .keyword
                } else if afterWord.first == "!" {
                    type = .function
                } else if word.first?.isUppercase == true {
                    type = .type
                } else if afterWord.first == "(" {
                    type = .function
                } else {
                    type = .text
                }
                tokens.append(SyntaxToken(text: word, type: type))
                index = code.index(index, offsetBy: word.count)
                continue
            }

            // Check for operators
            if let opToken = extractOperator(from: remaining) {
                tokens.append(SyntaxToken(text: opToken, type: .operator))
                index = code.index(index, offsetBy: opToken.count)
                continue
            }

            // Single character
            tokens.append(SyntaxToken(text: String(code[index]), type: .text))
            index = code.index(after: index)
        }

        return tokens
    }

    // MARK: - Go Tokenizer

    private static func tokenizeGo(_ code: String) -> [SyntaxToken] {
        var tokens: [SyntaxToken] = []
        var index = code.startIndex

        while index < code.endIndex {
            let remaining = String(code[index...])

            // Check for comments
            if remaining.hasPrefix("//") {
                let endIndex = remaining.firstIndex(of: "\n") ?? remaining.endIndex
                let comment = String(remaining[..<endIndex])
                tokens.append(SyntaxToken(text: comment, type: .comment))
                index = code.index(index, offsetBy: comment.count)
                continue
            }

            if remaining.hasPrefix("/*") {
                if let endRange = remaining.range(of: "*/") {
                    let endOffset = remaining.distance(from: remaining.startIndex, to: endRange.upperBound)
                    let comment = String(remaining.prefix(endOffset))
                    tokens.append(SyntaxToken(text: comment, type: .comment))
                    index = code.index(index, offsetBy: endOffset)
                    continue
                }
            }

            // Check for strings
            if remaining.hasPrefix("\"") {
                if let stringToken = extractString(from: remaining, delimiter: "\"") {
                    tokens.append(SyntaxToken(text: stringToken, type: .string))
                    index = code.index(index, offsetBy: stringToken.count)
                    continue
                }
            }

            // Check for raw strings
            if remaining.hasPrefix("`") {
                if let stringToken = extractString(from: remaining, delimiter: "`") {
                    tokens.append(SyntaxToken(text: stringToken, type: .string))
                    index = code.index(index, offsetBy: stringToken.count)
                    continue
                }
            }

            // Check for numbers
            if let numberToken = extractNumber(from: remaining) {
                tokens.append(SyntaxToken(text: numberToken, type: .number))
                index = code.index(index, offsetBy: numberToken.count)
                continue
            }

            // Check for words
            if let word = extractWord(from: remaining) {
                let afterWord = remaining.dropFirst(word.count)
                let type: TokenType
                if goKeywords.contains(word) {
                    type = .keyword
                } else if word.first?.isUppercase == true {
                    type = .type
                } else if afterWord.first == "(" {
                    type = .function
                } else {
                    type = .text
                }
                tokens.append(SyntaxToken(text: word, type: type))
                index = code.index(index, offsetBy: word.count)
                continue
            }

            // Check for operators
            if let opToken = extractOperator(from: remaining) {
                tokens.append(SyntaxToken(text: opToken, type: .operator))
                index = code.index(index, offsetBy: opToken.count)
                continue
            }

            // Single character
            tokens.append(SyntaxToken(text: String(code[index]), type: .text))
            index = code.index(after: index)
        }

        return tokens
    }

    // MARK: - C-Like Tokenizer

    private static func tokenizeCLike(_ code: String) -> [SyntaxToken] {
        let cKeywords: Set<String> = [
            "auto", "break", "case", "char", "const", "continue", "default", "do",
            "double", "else", "enum", "extern", "float", "for", "goto", "if", "int",
            "long", "register", "return", "short", "signed", "sizeof", "static",
            "struct", "switch", "typedef", "union", "unsigned", "void", "volatile",
            "while", "class", "public", "private", "protected", "virtual", "override",
            "final", "abstract", "interface", "extends", "implements", "new", "delete",
            "this", "super", "null", "true", "false", "try", "catch", "throw", "throws",
            "finally", "import", "package", "namespace", "using", "template", "typename"
        ]

        var tokens: [SyntaxToken] = []
        var index = code.startIndex

        while index < code.endIndex {
            let remaining = String(code[index...])

            // Comments
            if remaining.hasPrefix("//") {
                let endIndex = remaining.firstIndex(of: "\n") ?? remaining.endIndex
                let comment = String(remaining[..<endIndex])
                tokens.append(SyntaxToken(text: comment, type: .comment))
                index = code.index(index, offsetBy: comment.count)
                continue
            }

            if remaining.hasPrefix("/*") {
                if let endRange = remaining.range(of: "*/") {
                    let endOffset = remaining.distance(from: remaining.startIndex, to: endRange.upperBound)
                    let comment = String(remaining.prefix(endOffset))
                    tokens.append(SyntaxToken(text: comment, type: .comment))
                    index = code.index(index, offsetBy: endOffset)
                    continue
                }
            }

            // Strings
            if remaining.hasPrefix("\"") {
                if let stringToken = extractString(from: remaining, delimiter: "\"") {
                    tokens.append(SyntaxToken(text: stringToken, type: .string))
                    index = code.index(index, offsetBy: stringToken.count)
                    continue
                }
            }

            // Char literals
            if remaining.hasPrefix("'") {
                if let charToken = extractString(from: remaining, delimiter: "'") {
                    tokens.append(SyntaxToken(text: charToken, type: .string))
                    index = code.index(index, offsetBy: charToken.count)
                    continue
                }
            }

            // Numbers
            if let numberToken = extractNumber(from: remaining) {
                tokens.append(SyntaxToken(text: numberToken, type: .number))
                index = code.index(index, offsetBy: numberToken.count)
                continue
            }

            // Words
            if let word = extractWord(from: remaining) {
                let afterWord = remaining.dropFirst(word.count)
                let type: TokenType
                if cKeywords.contains(word) {
                    type = .keyword
                } else if word.first?.isUppercase == true {
                    type = .type
                } else if afterWord.first == "(" {
                    type = .function
                } else {
                    type = .text
                }
                tokens.append(SyntaxToken(text: word, type: type))
                index = code.index(index, offsetBy: word.count)
                continue
            }

            // Operators
            if let opToken = extractOperator(from: remaining) {
                tokens.append(SyntaxToken(text: opToken, type: .operator))
                index = code.index(index, offsetBy: opToken.count)
                continue
            }

            // Single character
            tokens.append(SyntaxToken(text: String(code[index]), type: .text))
            index = code.index(after: index)
        }

        return tokens
    }

    // MARK: - Helper Methods

    private static func extractString(from code: String, delimiter: String) -> String? {
        guard code.hasPrefix(delimiter) else { return nil }

        var index = code.index(after: code.startIndex)
        var escaped = false

        while index < code.endIndex {
            let char = code[index]

            if escaped {
                escaped = false
            } else if char == "\\" {
                escaped = true
            } else if String(char) == delimiter {
                return String(code[...index])
            } else if char == "\n" && delimiter != "`" {
                return nil
            }

            index = code.index(after: index)
        }

        return nil
    }

    private static func extractTripleString(from code: String, delimiter: String) -> String? {
        guard code.hasPrefix(delimiter) else { return nil }

        let searchStart = code.index(code.startIndex, offsetBy: delimiter.count)
        if let endRange = code.range(of: delimiter, range: searchStart..<code.endIndex) {
            return String(code[..<endRange.upperBound])
        }

        return nil
    }

    private static func extractNumber(from code: String) -> String? {
        guard let first = code.first, first.isNumber || (first == "." && code.dropFirst().first?.isNumber == true) || first == "-" else {
            return nil
        }

        var index = code.startIndex

        // Handle negative sign
        if code[index] == "-" {
            index = code.index(after: index)
            guard index < code.endIndex && (code[index].isNumber || code[index] == ".") else {
                return nil
            }
        }

        // Handle hex/octal/binary
        if code[index] == "0" && code.index(after: index) < code.endIndex {
            let next = code[code.index(after: index)]
            if next == "x" || next == "X" || next == "o" || next == "O" || next == "b" || next == "B" {
                index = code.index(index, offsetBy: 2)
                while index < code.endIndex && (code[index].isHexDigit || code[index] == "_") {
                    index = code.index(after: index)
                }
                return String(code[..<index])
            }
        }

        var hasDecimal = false
        var hasExponent = false

        while index < code.endIndex {
            let char = code[index]

            if char.isNumber || char == "_" {
                index = code.index(after: index)
            } else if char == "." && !hasDecimal && !hasExponent {
                hasDecimal = true
                index = code.index(after: index)
            } else if (char == "e" || char == "E") && !hasExponent {
                hasExponent = true
                index = code.index(after: index)
                if index < code.endIndex && (code[index] == "+" || code[index] == "-") {
                    index = code.index(after: index)
                }
            } else {
                break
            }
        }

        // Handle suffixes like f, F, L, etc.
        if index < code.endIndex {
            let char = code[index]
            if ["f", "F", "l", "L", "u", "U", "d", "D"].contains(String(char)) {
                index = code.index(after: index)
            }
        }

        let result = String(code[..<index])
        return result.isEmpty || result == "-" || result == "." ? nil : result
    }

    private static func extractWord(from code: String) -> String? {
        guard let first = code.first, first.isLetter || first == "_" else {
            return nil
        }

        var index = code.startIndex
        while index < code.endIndex {
            let char = code[index]
            if char.isLetter || char.isNumber || char == "_" {
                index = code.index(after: index)
            } else {
                break
            }
        }

        let result = String(code[..<index])
        return result.isEmpty ? nil : result
    }

    private static func extractOperator(from code: String) -> String? {
        // Check for multi-character operators first
        let twoChar = String(code.prefix(2))
        if operators.contains(twoChar) {
            return twoChar
        }

        let oneChar = String(code.prefix(1))
        if operators.contains(oneChar) {
            return oneChar
        }

        return nil
    }

    private static func extractHTMLTag(from code: String) -> String? {
        guard code.hasPrefix("<") else { return nil }

        var depth = 0
        var index = code.startIndex

        while index < code.endIndex {
            let char = code[index]

            if char == "<" {
                depth += 1
            } else if char == ">" {
                depth -= 1
                if depth == 0 {
                    return String(code[...index])
                }
            }

            index = code.index(after: index)
        }

        return nil
    }

    private static func extractBashVariable(from code: String) -> String? {
        guard code.hasPrefix("$") else { return nil }

        var index = code.index(after: code.startIndex)

        // Handle ${...}
        if index < code.endIndex && code[index] == "{" {
            if let endIndex = code.firstIndex(of: "}") {
                return String(code[...endIndex])
            }
            return nil
        }

        // Handle $VAR_NAME
        while index < code.endIndex {
            let char = code[index]
            if char.isLetter || char.isNumber || char == "_" {
                index = code.index(after: index)
            } else {
                break
            }
        }

        let result = String(code[..<index])
        return result.count > 1 ? result : nil
    }

    private static func extractCSSNumber(from code: String) -> String? {
        guard let first = code.first, first.isNumber || first == "." || first == "-" || first == "#" else {
            return nil
        }

        // Handle hex colors
        if code.hasPrefix("#") {
            var index = code.index(after: code.startIndex)
            while index < code.endIndex && code[index].isHexDigit {
                index = code.index(after: index)
            }
            let result = String(code[..<index])
            return result.count > 1 ? result : nil
        }

        // Handle numbers with units
        var index = code.startIndex

        if code[index] == "-" {
            index = code.index(after: index)
        }

        var hasDecimal = false
        while index < code.endIndex {
            let char = code[index]
            if char.isNumber {
                index = code.index(after: index)
            } else if char == "." && !hasDecimal {
                hasDecimal = true
                index = code.index(after: index)
            } else {
                break
            }
        }

        // Extract unit
        while index < code.endIndex && code[index].isLetter {
            index = code.index(after: index)
        }

        // Handle percentages
        if index < code.endIndex && code[index] == "%" {
            index = code.index(after: index)
        }

        let result = String(code[..<index])
        return result.isEmpty || result == "-" ? nil : result
    }

    private static func extractCSSWord(from code: String) -> String? {
        guard let first = code.first, first.isLetter || first == "-" || first == "_" || first == "." || first == "#" || first == "@" else {
            return nil
        }

        var index = code.startIndex
        while index < code.endIndex {
            let char = code[index]
            if char.isLetter || char.isNumber || char == "-" || char == "_" {
                index = code.index(after: index)
            } else {
                break
            }
        }

        let result = String(code[..<index])
        return result.isEmpty ? nil : result
    }

    // MARK: - AttributedString Generation

    private static func attributedString(from tokens: [SyntaxToken]) -> AttributedString {
        var result = AttributedString()

        for token in tokens {
            var attributed = AttributedString(token.text)
            attributed.foregroundColor = token.type.color
            attributed.font = .system(size: 13, weight: .regular, design: .monospaced)
            result.append(attributed)
        }

        return result
    }
}

// MARK: - Preview Support

#if DEBUG
struct SyntaxHighlighter_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Swift")
                    .font(.headline)
                Text(SyntaxHighlighter.highlight(swiftSample, language: .swift))
                    .padding()
                    .background(SyntaxColors.shared.background)
                    .cornerRadius(8)

                Text("Python")
                    .font(.headline)
                Text(SyntaxHighlighter.highlight(pythonSample, language: .python))
                    .padding()
                    .background(SyntaxColors.shared.background)
                    .cornerRadius(8)

                Text("JavaScript")
                    .font(.headline)
                Text(SyntaxHighlighter.highlight(jsSample, language: .javascript))
                    .padding()
                    .background(SyntaxColors.shared.background)
                    .cornerRadius(8)
            }
            .padding()
        }
        .background(Color.theme.background)
        .preferredColorScheme(.dark)
    }

    static let swiftSample = """
    import SwiftUI

    struct ContentView: View {
        @State private var count = 0

        var body: some View {
            VStack {
                Text("Count: \\(count)")
                Button("Increment") {
                    count += 1
                }
            }
        }
    }
    """

    static let pythonSample = """
    def fibonacci(n):
        \"\"\"Calculate fibonacci number\"\"\"
        if n <= 1:
            return n
        return fibonacci(n-1) + fibonacci(n-2)

    # Test the function
    result = fibonacci(10)
    print(f"Result: {result}")
    """

    static let jsSample = """
    const fetchData = async (url) => {
        try {
            const response = await fetch(url);
            return response.json();
        } catch (error) {
            console.error('Failed:', error);
        }
    };
    """
}
#endif
