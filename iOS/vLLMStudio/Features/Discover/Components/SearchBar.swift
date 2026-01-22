import SwiftUI
import Combine

// MARK: - Search Bar

struct SearchBar: View {
    @Binding var text: String
    var placeholder: String = "Search models..."
    var onSearch: ((String) -> Void)?

    @State private var isEditing = false
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: .spacing.sm) {
            // Search icon
            Image(systemName: "magnifyingglass")
                .font(.system(size: .iconSize.md))
                .foregroundColor(isFocused ? Color.theme.primary : Color.theme.mutedForeground)

            // Text field
            TextField(placeholder, text: $text)
                .font(.theme.body)
                .foregroundColor(Color.theme.foreground)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .focused($isFocused)
                .submitLabel(.search)
                .onSubmit {
                    onSearch?(text)
                }

            // Clear button
            if !text.isEmpty {
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        text = ""
                    }
                    onSearch?("")
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: .iconSize.md))
                        .foregroundColor(Color.theme.mutedForeground)
                }
                .buttonStyle(.plain)
                .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.horizontal, .spacing.md)
        .padding(.vertical, .spacing.sm + 2)
        .background(
            RoundedRectangle(cornerRadius: .radius.md)
                .fill(Color.theme.backgroundSecondary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: .radius.md)
                .stroke(
                    isFocused ? Color.theme.primary : Color.theme.border,
                    lineWidth: isFocused ? 2 : 1
                )
        )
        .animation(.easeInOut(duration: 0.2), value: isFocused)
    }
}

// MARK: - Debounced Search Bar

struct DebouncedSearchBar: View {
    @Binding var text: String
    var placeholder: String = "Search models..."
    var debounceInterval: TimeInterval = 0.3
    var onSearch: ((String) -> Void)?

    @State private var localText: String = ""
    @State private var debounceTask: Task<Void, Never>?

    var body: some View {
        SearchBar(
            text: $localText,
            placeholder: placeholder,
            onSearch: { _ in
                // Immediate search on submit
                text = localText
                onSearch?(localText)
            }
        )
        .onAppear {
            localText = text
        }
        .onChange(of: localText) { _, newValue in
            // Cancel previous debounce task
            debounceTask?.cancel()

            // Start new debounce task
            debounceTask = Task {
                try? await Task.sleep(nanoseconds: UInt64(debounceInterval * 1_000_000_000))

                if !Task.isCancelled {
                    await MainActor.run {
                        text = newValue
                        onSearch?(newValue)
                    }
                }
            }
        }
    }
}

// MARK: - Compact Search Bar (for toolbar)

struct CompactSearchBar: View {
    @Binding var isExpanded: Bool
    @Binding var text: String
    var placeholder: String = "Search..."
    var onSearch: ((String) -> Void)?

    @FocusState private var isFocused: Bool
    @Namespace private var animation

    var body: some View {
        HStack(spacing: .spacing.sm) {
            if isExpanded {
                HStack(spacing: .spacing.sm) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: .iconSize.sm))
                        .foregroundColor(Color.theme.mutedForeground)
                        .matchedGeometryEffect(id: "searchIcon", in: animation)

                    TextField(placeholder, text: $text)
                        .font(.theme.body)
                        .foregroundColor(Color.theme.foreground)
                        .focused($isFocused)
                        .submitLabel(.search)
                        .onSubmit {
                            onSearch?(text)
                        }

                    if !text.isEmpty {
                        Button {
                            text = ""
                            onSearch?("")
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: .iconSize.sm))
                                .foregroundColor(Color.theme.mutedForeground)
                        }
                        .buttonStyle(.plain)
                    }

                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            isExpanded = false
                            text = ""
                        }
                        onSearch?("")
                    } label: {
                        Text("Cancel")
                            .font(.theme.body)
                            .foregroundColor(Color.theme.primary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, .spacing.md)
                .padding(.vertical, .spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: .radius.md)
                        .fill(Color.theme.backgroundSecondary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: .radius.md)
                        .stroke(Color.theme.border, lineWidth: 1)
                )
                .transition(.asymmetric(
                    insertion: .move(edge: .trailing).combined(with: .opacity),
                    removal: .move(edge: .trailing).combined(with: .opacity)
                ))
            } else {
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        isExpanded = true
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        isFocused = true
                    }
                } label: {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: .iconSize.md))
                        .foregroundColor(Color.theme.foreground)
                        .matchedGeometryEffect(id: "searchIcon", in: animation)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Preview

#Preview("Standard Search Bar") {
    VStack(spacing: 20) {
        SearchBar(text: .constant(""), placeholder: "Search models...")
        SearchBar(text: .constant("llama"), placeholder: "Search models...")
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("Debounced Search Bar") {
    DebouncedSearchBar(
        text: .constant(""),
        placeholder: "Search with debounce..."
    ) { query in
        print("Searching: \(query)")
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("Compact Search Bar") {
    HStack {
        Spacer()
        CompactSearchBar(
            isExpanded: .constant(true),
            text: .constant(""),
            placeholder: "Search..."
        )
    }
    .padding()
    .background(Color.theme.background)
}
