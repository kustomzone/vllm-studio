import Foundation

/// Types of artifacts that can be generated in chat
enum ArtifactType: String, Codable, CaseIterable {
    case html
    case react
    case javascript
    case python
    case mermaid
    case svg
    case markdown
    case json
    case code

    var displayName: String {
        switch self {
        case .html: return "HTML"
        case .react: return "React Component"
        case .javascript: return "JavaScript"
        case .python: return "Python"
        case .mermaid: return "Mermaid Diagram"
        case .svg: return "SVG"
        case .markdown: return "Markdown"
        case .json: return "JSON"
        case .code: return "Code"
        }
    }

    var iconName: String {
        switch self {
        case .html: return "globe"
        case .react: return "atom"
        case .javascript: return "curlybraces"
        case .python: return "chevron.left.forwardslash.chevron.right"
        case .mermaid: return "chart.bar.doc.horizontal"
        case .svg: return "photo"
        case .markdown: return "doc.text"
        case .json: return "curlybraces.square"
        case .code: return "doc.text.fill"
        }
    }

    var canPreview: Bool {
        switch self {
        case .html, .svg, .mermaid, .markdown:
            return true
        default:
            return false
        }
    }

    var canExecute: Bool {
        switch self {
        case .javascript, .python:
            return true
        default:
            return false
        }
    }
}

/// Represents a code artifact generated in chat
struct Artifact: Codable, Identifiable, Hashable {
    let id: String
    let type: ArtifactType
    var title: String
    var code: String
    var language: String?
    var output: String?
    var error: String?
    var isRunning: Bool

    // Metadata
    var sessionId: String?
    var messageId: String?
    var createdAt: Date

    init(
        id: String = UUID().uuidString,
        type: ArtifactType,
        title: String,
        code: String,
        language: String? = nil,
        output: String? = nil,
        error: String? = nil,
        isRunning: Bool = false,
        sessionId: String? = nil,
        messageId: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.type = type
        self.title = title
        self.code = code
        self.language = language ?? type.rawValue
        self.output = output
        self.error = error
        self.isRunning = isRunning
        self.sessionId = sessionId
        self.messageId = messageId
        self.createdAt = createdAt
    }

    // MARK: - Hashable

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: Artifact, rhs: Artifact) -> Bool {
        lhs.id == rhs.id
    }

    // MARK: - Computed Properties

    var hasOutput: Bool {
        output != nil && !output!.isEmpty
    }

    var hasError: Bool {
        error != nil && !error!.isEmpty
    }

    var lineCount: Int {
        code.components(separatedBy: .newlines).count
    }

    var characterCount: Int {
        code.count
    }

    /// Get file extension for download
    var fileExtension: String {
        switch type {
        case .html: return "html"
        case .react: return "jsx"
        case .javascript: return "js"
        case .python: return "py"
        case .mermaid: return "mmd"
        case .svg: return "svg"
        case .markdown: return "md"
        case .json: return "json"
        case .code: return language ?? "txt"
        }
    }

    /// Get MIME type for sharing
    var mimeType: String {
        switch type {
        case .html: return "text/html"
        case .react, .javascript: return "text/javascript"
        case .python: return "text/x-python"
        case .mermaid, .markdown: return "text/markdown"
        case .svg: return "image/svg+xml"
        case .json: return "application/json"
        case .code: return "text/plain"
        }
    }
}

// MARK: - Artifact Extraction

extension Artifact {
    /// Extract artifacts from message content
    static func extractFromContent(_ content: String) -> [Artifact] {
        var artifacts: [Artifact] = []

        // Pattern for code blocks with optional artifact markers
        let codeBlockPattern = #"```(\w+)?(?:\s+artifact="([^"]+)")?\n([\s\S]*?)```"#

        guard let regex = try? NSRegularExpression(pattern: codeBlockPattern, options: []) else {
            return artifacts
        }

        let nsContent = content as NSString
        let matches = regex.matches(in: content, options: [], range: NSRange(location: 0, length: nsContent.length))

        for (index, match) in matches.enumerated() {
            let languageRange = match.range(at: 1)
            let titleRange = match.range(at: 2)
            let codeRange = match.range(at: 3)

            let language = languageRange.location != NSNotFound ? nsContent.substring(with: languageRange) : "code"
            let title = titleRange.location != NSNotFound ? nsContent.substring(with: titleRange) : "Code Block \(index + 1)"
            let code = codeRange.location != NSNotFound ? nsContent.substring(with: codeRange) : ""

            let type = ArtifactType(rawValue: language.lowercased()) ?? .code

            let artifact = Artifact(
                type: type,
                title: title,
                code: code.trimmingCharacters(in: .whitespacesAndNewlines),
                language: language
            )

            artifacts.append(artifact)
        }

        return artifacts
    }
}

// MARK: - Preview Helpers

extension Artifact {
    static var previewHTML: Artifact {
        Artifact(
            type: .html,
            title: "Hello World Page",
            code: """
            <!DOCTYPE html>
            <html>
            <head>
                <title>Hello World</title>
                <style>
                    body { font-family: system-ui; padding: 2rem; }
                    h1 { color: #d97706; }
                </style>
            </head>
            <body>
                <h1>Hello, World!</h1>
                <p>This is a sample HTML artifact.</p>
            </body>
            </html>
            """
        )
    }

    static var previewPython: Artifact {
        Artifact(
            type: .python,
            title: "Fibonacci Generator",
            code: """
            def fibonacci(n):
                \"\"\"Generate the first n Fibonacci numbers.\"\"\"
                fib = [0, 1]
                for i in range(2, n):
                    fib.append(fib[i-1] + fib[i-2])
                return fib[:n]

            # Generate first 10 Fibonacci numbers
            result = fibonacci(10)
            print(f"First 10 Fibonacci numbers: {result}")
            """,
            output: "First 10 Fibonacci numbers: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]"
        )
    }

    static var previewMermaid: Artifact {
        Artifact(
            type: .mermaid,
            title: "Flow Chart",
            code: """
            graph TD
                A[Start] --> B{Is it working?}
                B -->|Yes| C[Great!]
                B -->|No| D[Debug]
                D --> B
                C --> E[End]
            """
        )
    }

    static var previewList: [Artifact] {
        [previewHTML, previewPython, previewMermaid]
    }
}
