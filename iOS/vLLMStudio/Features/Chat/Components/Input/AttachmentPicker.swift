import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

/// File and image picker for chat attachments
struct AttachmentPicker: View {
    @Binding var isPresented: Bool
    var onImageSelected: (UIImage) -> Void
    var onFileSelected: (URL) -> Void

    @State private var showPhotoPicker = false
    @State private var showCamera = false
    @State private var showFilePicker = false
    @State private var selectedPhotoItem: PhotosPickerItem?

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Add Attachment")
                    .font(.theme.headline)
                    .foregroundStyle(Color.theme.foreground)

                Spacer()

                Button {
                    isPresented = false
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(Color.theme.mutedForeground)
                }
            }
            .padding(.spacing.md)
            .background(Color.theme.backgroundSecondary)

            // Options
            VStack(spacing: .spacing.sm) {
                // Photo Library
                AttachmentOption(
                    icon: "photo.on.rectangle",
                    title: "Photo Library",
                    subtitle: "Choose from your photos",
                    action: { showPhotoPicker = true }
                )

                // Camera
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    AttachmentOption(
                        icon: "camera",
                        title: "Camera",
                        subtitle: "Take a new photo",
                        action: { showCamera = true }
                    )
                }

                // Files
                AttachmentOption(
                    icon: "folder",
                    title: "Files",
                    subtitle: "Browse documents",
                    action: { showFilePicker = true }
                )
            }
            .padding(.spacing.md)
        }
        .background(Color.theme.background)
        .clipShape(RoundedRectangle(cornerRadius: .radius.xl))
        .photosPicker(
            isPresented: $showPhotoPicker,
            selection: $selectedPhotoItem,
            matching: .images
        )
        .onChange(of: selectedPhotoItem) { _, newItem in
            Task {
                if let newItem = newItem {
                    await loadImage(from: newItem)
                }
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPickerView { image in
                onImageSelected(image)
                isPresented = false
            }
            .ignoresSafeArea()
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [.image, .pdf, .text, .plainText],
            allowsMultipleSelection: false
        ) { result in
            handleFileSelection(result)
        }
    }

    private func loadImage(from item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data) else {
            return
        }

        await MainActor.run {
            onImageSelected(image)
            isPresented = false
            selectedPhotoItem = nil
        }
    }

    private func handleFileSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }

            // Check if it's an image
            if let data = try? Data(contentsOf: url),
               let image = UIImage(data: data) {
                onImageSelected(image)
            } else {
                onFileSelected(url)
            }

            isPresented = false

        case .failure(let error):
            print("File selection error: \(error.localizedDescription)")
        }
    }
}

// MARK: - Attachment Option Button

private struct AttachmentOption: View {
    let icon: String
    let title: String
    let subtitle: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: .spacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 24))
                    .foregroundStyle(Color.theme.primary)
                    .frame(width: 44, height: 44)
                    .background(Color.theme.primary.opacity(0.15))
                    .clipShape(RoundedRectangle(cornerRadius: .radius.md))

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.theme.body.weight(.medium))
                        .foregroundStyle(Color.theme.foreground)

                    Text(subtitle)
                        .font(.theme.caption)
                        .foregroundStyle(Color.theme.mutedForeground)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.theme.mutedForeground)
            }
            .padding(.spacing.md)
            .background(Color.theme.card)
            .clipShape(RoundedRectangle(cornerRadius: .radius.md))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Camera Picker View

struct CameraPickerView: UIViewControllerRepresentable {
    let onImageCaptured: (UIImage) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onImageCaptured: onImageCaptured)
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onImageCaptured: (UIImage) -> Void

        init(onImageCaptured: @escaping (UIImage) -> Void) {
            self.onImageCaptured = onImageCaptured
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage {
                onImageCaptured(image)
            }
            picker.dismiss(animated: true)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
        }
    }
}

// MARK: - Compact Attachment Button

struct CompactAttachmentButton: View {
    @Binding var showPicker: Bool

    var body: some View {
        Button {
            showPicker = true
        } label: {
            Image(systemName: "plus.circle.fill")
                .font(.system(size: 28))
                .foregroundStyle(Color.theme.mutedForeground)
        }
    }
}

// MARK: - Inline Attachment Menu

struct InlineAttachmentMenu: View {
    var onPhotoLibrary: () -> Void
    var onCamera: () -> Void
    var onFiles: () -> Void

    var body: some View {
        Menu {
            Button(action: onPhotoLibrary) {
                Label("Photo Library", systemImage: "photo.on.rectangle")
            }

            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                Button(action: onCamera) {
                    Label("Camera", systemImage: "camera")
                }
            }

            Button(action: onFiles) {
                Label("Files", systemImage: "folder")
            }
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(Color.theme.mutedForeground)
                .frame(width: 36, height: 36)
                .background(Color.theme.backgroundTertiary)
                .clipShape(Circle())
        }
    }
}

// MARK: - Preview

#Preview("Attachment Picker") {
    ZStack {
        Color.theme.background.ignoresSafeArea()

        AttachmentPicker(
            isPresented: .constant(true),
            onImageSelected: { _ in },
            onFileSelected: { _ in }
        )
        .padding()
    }
}

#Preview("Inline Menu") {
    HStack {
        InlineAttachmentMenu(
            onPhotoLibrary: {},
            onCamera: {},
            onFiles: {}
        )
    }
    .padding()
    .background(Color.theme.background)
}
