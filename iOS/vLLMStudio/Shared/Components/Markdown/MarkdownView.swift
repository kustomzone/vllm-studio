import SwiftUI

/// A markdown renderer using AttributedString
struct MarkdownView: View {
    let content: String
    var fontSize: CGFloat
    var textColor: Color

    @State private var attributedString: AttributedString = ""

    init(
        _ content: String,
        fontSize: CGFloat = 14,
        textColor: Color = Color.theme.foreground
    ) {
        self.content = content
        self.fontSize = fontSize
        self.textColor = textColor
    }

    var body: some View {
        Text(attributedString)
            .textSelection(.enabled)
            .onAppear {
                parseMarkdown()
            }
            .onChange(of: content) { _, _ in
                parseMarkdown()
            }
    }

    private func parseMarkdown() {
        do {
            var attributed = try AttributedString(markdown: content, options: .init(
                allowsExtendedAttributes: true,
                interpretedSyntax: .inlineOnlyPreservingWhitespace,
                failurePolicy: .returnPartiallyParsedIfPossible
            ))

            // Apply base styling
            attributed.font = .system(size: fontSize)
            attributed.foregroundColor = textColor

            // Style inline code
            for run in attributed.runs {
                if run.inlinePresentationIntent?.contains(.code) == true {
                    let range = run.range
                    attributed[range].font = .system(size: fontSize - 1, design: .monospaced)
                    attributed[range].backgroundColor = Color.theme.backgroundSecondary
                }

                // Style bold
                if run.inlinePresentationIntent?.contains(.stronglyEmphasized) == true {
                    let range = run.range
                    attributed[range].font = .system(size: fontSize, weight: .semibold)
                }

                // Style italic
                if run.inlinePresentationIntent?.contains(.emphasized) == true {
                    let range = run.range
                    attributed[range].font = .system(size: fontSize).italic()
                }

                // Style links
                if run.link != nil {
                    let range = run.range
                    attributed[range].foregroundColor = Color.theme.primary
                    attributed[range].underlineStyle = .single
                }
            }

            self.attributedString = attributed
        } catch {
            // Fallback to plain text if parsing fails
            var attributed = AttributedString(content)
            attributed.font = .system(size: fontSize)
            attributed.foregroundColor = textColor
            self.attributedString = attributed
        }
    }
}

// MARK: - Full Markdown View with Block Elements

/// A more complete markdown renderer that handles block elements
struct FullMarkdownView: View {
    let content: String
    var fontSize: CGFloat

    init(_ content: String, fontSize: CGFloat = 14) {
        self.content = content
        self.fontSize = fontSize
    }

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            ForEach(parseBlocks(), id: \.id) { block in
                renderBlock(block)
            }
        }
    }

    private func parseBlocks() -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        let lines = content.components(separatedBy: "\n")
        var currentCodeBlock: [String] = []
        var inCodeBlock = false
        var codeLanguage: String?

        for line in lines {
            if line.hasPrefix("```") {
                if inCodeBlock {
                    // End code block
                    blocks.append(.code(content: currentCodeBlock.joined(separator: "\n"), language: codeLanguage))
                    currentCodeBlock = []
                    inCodeBlock = false
                    codeLanguage = nil
                } else {
                    // Start code block
                    inCodeBlock = true
                    let lang = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                    codeLanguage = lang.isEmpty ? nil : lang
                }
            } else if inCodeBlock {
                currentCodeBlock.append(line)
            } else if line.hasPrefix("# ") {
                blocks.append(.heading(level: 1, text: String(line.dropFirst(2))))
            } else if line.hasPrefix("## ") {
                blocks.append(.heading(level: 2, text: String(line.dropFirst(3))))
            } else if line.hasPrefix("### ") {
                blocks.append(.heading(level: 3, text: String(line.dropFirst(4))))
            } else if line.hasPrefix("- ") || line.hasPrefix("* ") {
                blocks.append(.listItem(text: String(line.dropFirst(2))))
            } else if line.hasPrefix("> ") {
                blocks.append(.blockquote(text: String(line.dropFirst(2))))
            } else if line.hasPrefix("---") || line.hasPrefix("***") {
                blocks.append(.divider)
            } else if !line.trimmingCharacters(in: .whitespaces).isEmpty {
                blocks.append(.paragraph(text: line))
            }
        }

        return blocks
    }

    @ViewBuilder
    private func renderBlock(_ block: MarkdownBlock) -> some View {
        switch block {
        case .heading(let level, let text):
            Text(text)
                .font(headingFont(level: level))
                .fontWeight(.semibold)
                .foregroundColor(Color.theme.foreground)
                .padding(.top, level == 1 ? .spacing.md : .spacing.sm)

        case .paragraph(let text):
            MarkdownView(text, fontSize: fontSize)

        case .code(let content, let language):
            CodeBlockView(code: content, language: language)

        case .listItem(let text):
            HStack(alignment: .top, spacing: .spacing.sm) {
                Text("\u{2022}")
                    .font(.system(size: fontSize))
                    .foregroundColor(Color.theme.mutedForeground)

                MarkdownView(text, fontSize: fontSize)
            }
            .padding(.leading, .spacing.sm)

        case .blockquote(let text):
            HStack(spacing: 0) {
                Rectangle()
                    .fill(Color.theme.primary)
                    .frame(width: 3)

                MarkdownView(text, fontSize: fontSize, textColor: Color.theme.mutedForeground)
                    .padding(.leading, .spacing.md)
            }
            .padding(.vertical, .spacing.xs)

        case .divider:
            Divider()
                .background(Color.theme.border)
                .padding(.vertical, .spacing.sm)
        }
    }

    private func headingFont(level: Int) -> Font {
        switch level {
        case 1: return .theme.title
        case 2: return .theme.title2
        case 3: return .theme.headline
        default: return .theme.body
        }
    }
}

// MARK: - Markdown Block Types

enum MarkdownBlock: Identifiable {
    case heading(level: Int, text: String)
    case paragraph(text: String)
    case code(content: String, language: String?)
    case listItem(text: String)
    case blockquote(text: String)
    case divider

    var id: String {
        switch self {
        case .heading(_, let text): return "h-\(text.hashValue)"
        case .paragraph(let text): return "p-\(text.hashValue)"
        case .code(let content, _): return "code-\(content.hashValue)"
        case .listItem(let text): return "li-\(text.hashValue)"
        case .blockquote(let text): return "bq-\(text.hashValue)"
        case .divider: return "div-\(UUID().uuidString)"
        }
    }
}

// MARK: - Code Block View

struct CodeBlockView: View {
    let code: String
    let language: String?
    @State private var isCopied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header with language and copy button
            HStack {
                if let language = language {
                    Text(language)
                        .font(.theme.caption)
                        .foregroundColor(Color.theme.mutedForeground)
                }

                Spacer()

                Button {
                    copyToClipboard()
                } label: {
                    HStack(spacing: .spacing.xs) {
                        Image(systemName: isCopied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 12))
                        Text(isCopied ? "Copied" : "Copy")
                            .font(.theme.caption)
                    }
                    .foregroundColor(isCopied ? Color.theme.success : Color.theme.mutedForeground)
                }
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .background(Color.theme.backgroundTertiary)

            // Code content
            ScrollView(.horizontal, showsIndicators: false) {
                Text(code)
                    .font(.theme.code)
                    .foregroundColor(Color.theme.foreground)
                    .padding(.spacing.md)
            }
        }
        .background(Color.theme.card)
        .cornerRadius(.radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: .radius.md)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }

    private func copyToClipboard() {
        UIPasteboard.general.string = code
        isCopied = true

        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            isCopied = false
        }
    }
}

// MARK: - Inline Code View

struct InlineCodeView: View {
    let code: String

    var body: some View {
        Text(code)
            .font(.theme.code)
            .foregroundColor(Color.theme.foreground)
            .padding(.horizontal, .spacing.xs)
            .padding(.vertical, 2)
            .background(Color.theme.backgroundSecondary)
            .cornerRadius(.radius.sm)
    }
}

// MARK: - Previews

#Preview("Markdown View") {
    ScrollView {
        VStack(alignment: .leading, spacing: 16) {
            MarkdownView("This is **bold** and this is *italic* and this is `code`.")

            MarkdownView("Here's a [link](https://example.com) to click.")

            MarkdownView("Multiple **bold words** and *italic words* in one line.")
        }
        .padding()
    }
    .background(Color.theme.background)
}

#Preview("Full Markdown") {
    ScrollView {
        FullMarkdownView("""
        # Heading 1

        This is a paragraph with **bold** and *italic* text.

        ## Heading 2

        - List item one
        - List item two
        - List item three

        > This is a blockquote with some text.

        ### Code Example

        ```swift
        func hello() {
            print("Hello, World!")
        }
        ```

        ---

        That's all!
        """)
        .padding()
    }
    .background(Color.theme.background)
}

#Preview("Code Block") {
    CodeBlockView(
        code: """
        func calculateSum(_ numbers: [Int]) -> Int {
            return numbers.reduce(0, +)
        }
        """,
        language: "swift"
    )
    .padding()
    .background(Color.theme.background)
}
