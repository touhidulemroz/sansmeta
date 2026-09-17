import SwiftUI
import AppKit
import UniformTypeIdentifiers

struct EngineResponse: Decodable, Sendable {
    var ok: Bool
    var summary: String
    var warning: Bool?
    var output: String?
    var text: String?
}

struct EngineResult: Sendable {
    let response: EngineResponse
    let details: String
}

enum Engine {
    static func run(_ payload: Data) throws -> EngineResult {
        let resources = Bundle.main.resourceURL!
        let candidates = ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"]
        guard let python = candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) else {
            throw NSError(domain: "Watermarks", code: 1, userInfo: [NSLocalizedDescriptionKey: "Python 3.10 or newer is required. Install Python, then reopen this app."])
        }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: python)
        process.arguments = [resources.appendingPathComponent("bridge.py").path]
        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
        environment["PYTHONDONTWRITEBYTECODE"] = "1"
        environment["PYTHONIOENCODING"] = "utf-8"
        process.environment = environment
        let input = Pipe()
        let output = Pipe()
        process.standardInput = input
        process.standardOutput = output
        // Keep stderr separate from the structured response; the adapter reports engine failures.
        process.standardError = FileHandle.nullDevice
        try process.run()
        try input.fileHandleForWriting.write(contentsOf: payload)
        try input.fileHandleForWriting.close()
        let data = output.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        guard process.terminationStatus == 0 else {
            throw NSError(domain: "Watermarks", code: 2, userInfo: [NSLocalizedDescriptionKey: "The cleaning engine could not start. This app requires Python 3.10 or newer."])
        }
        let response = try JSONDecoder().decode(EngineResponse.self, from: data)
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let report = object?["report"] ?? object ?? [:]
        let pretty = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys, .fragmentsAllowed])
        return EngineResult(response: response, details: String(decoding: pretty, as: UTF8.self))
    }
}

struct FileItem: Identifiable {
    let id = UUID()
    let url: URL
    var status = "Ready to inspect"
    var report = "Inspect this file to see what the engine finds."
    var output: URL?
    var warning = false
    var failed = false
}

@MainActor final class AppModel: ObservableObject {
    @Published var files: [FileItem] = []
    @Published var selection: UUID?
    @Published var busy = false
    @Published var progress = ""
    @Published var preserveMetadata = true
    @Published var sourceText = ""
    @Published var cleanedText = ""
    @Published var textStatus = ""
    @Published var message: String?
    @Published var mode = "files"
    @Published var stopRequested = false
    @Published var dropTarget = false
    @Published var showDetails = false

    func removeSelected() {
        guard !busy, let selection else { return }
        files.removeAll { $0.id == selection }
        self.selection = files.first?.id
    }

    func add(_ urls: [URL]) {
        guard !busy else { return }
        for url in urls where url.isFileURL {
            var isDirectory: ObjCBool = false
            guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory), !isDirectory.boolValue else { continue }
            if !files.contains(where: { $0.url.standardizedFileURL == url.standardizedFileURL }) {
                files.append(FileItem(url: url))
            }
        }
        if selection == nil { selection = files.first?.id }
        mode = "files"
    }

    func chooseFiles() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        panel.message = "Choose images, documents, audio, video, or text files."
        if panel.runModal() == .OK { add(panel.urls) }
    }

    func runFiles(clean: Bool) {
        guard !busy, !files.isEmpty else { return }
        var directory: String?
        if clean {
            let panel = NSOpenPanel()
            panel.canChooseDirectories = true
            panel.canChooseFiles = false
            panel.canCreateDirectories = true
            panel.prompt = "Save copies here"
            panel.message = "Originals are preserved. Existing cleaned copies are never overwritten."
            guard panel.runModal() == .OK, let url = panel.url else { return }
            directory = url.path
        }
        busy = true
        stopRequested = false
        let jobs = files.map { ($0.id, $0.url) }
        let preserve = preserveMetadata
        Task {
            for (position, job) in jobs.enumerated() {
                if stopRequested { break }
                progress = "\(clean ? "Cleaning" : "Inspecting") \(position + 1) of \(jobs.count) · \(job.1.lastPathComponent)"
                if let index = files.firstIndex(where: { $0.id == job.0 }) { files[index].status = clean ? "Cleaning…" : "Inspecting…" }
                var request: [String: Any] = ["action": clean ? "clean" : "inspect", "path": job.1.path, "preserveMetadata": preserve]
                if let directory { request["outputDirectory"] = directory }
                do {
                    let payload = try JSONSerialization.data(withJSONObject: request)
                    let result = try await Task.detached(priority: .userInitiated) { try Engine.run(payload) }.value
                    if let index = files.firstIndex(where: { $0.id == job.0 }) {
                        files[index].status = result.response.summary
                        files[index].report = result.details
                        files[index].failed = !result.response.ok
                        files[index].warning = result.response.warning ?? false
                        if let path = result.response.output { files[index].output = URL(fileURLWithPath: path) }
                    }
                } catch {
                    if let index = files.firstIndex(where: { $0.id == job.0 }) {
                        files[index].status = "Could not process"
                        files[index].report = error.localizedDescription
                        files[index].failed = true
                    }
                }
            }
            progress = stopRequested ? "Stopped after the current file." : "Finished processing \(jobs.count) file\(jobs.count == 1 ? "" : "s")."
            busy = false
        }
    }

    func cleanText() {
        guard !busy else { return }
        busy = true
        textStatus = "Cleaning…"
        let text = sourceText
        Task {
            do {
                let payload = try JSONSerialization.data(withJSONObject: ["action": "text", "text": text])
                let result = try await Task.detached(priority: .userInitiated) { try Engine.run(payload) }.value
                cleanedText = result.response.text ?? ""
                textStatus = result.response.summary
            } catch { textStatus = error.localizedDescription }
            busy = false
        }
    }
}

struct ContentView: View {
    @EnvironmentObject var model: AppModel
    private let accent = Color.teal

    var body: some View {
        HStack(spacing: 0) {
            sidebar
            Divider()
            VStack(spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 7) {
                    Text(model.mode == "files" ? "A fresh start for your files." : "Just your words.")
                        .font(.system(size: 27, weight: .semibold, design: .rounded))
                    Text(model.mode == "files" ? "Inspect hidden marks. Save a cleaner copy." : "Clear invisible characters from copied text.")
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Label("LOCAL ONLY", systemImage: "lock.shield")
                    .font(.system(size: 10, weight: .semibold)).tracking(1)
                    .foregroundStyle(accent).padding(.horizontal, 12).padding(.vertical, 8)
                    .background(accent.opacity(0.09), in: Capsule())
            }.padding(.horizontal, 28).padding(.top, 28).padding(.bottom, 8)
            if model.mode == "files" { filesView } else { textView }
            Divider()
            HStack {
                if model.busy { ProgressView().controlSize(.small) }
                Text(model.progress.isEmpty ? "Local processing · Original files stay intact" : model.progress)
                    .font(.caption).foregroundStyle(.secondary).lineLimit(1)
                Spacer()
                if model.busy && model.mode == "files" {
                    Button(model.stopRequested ? "Stopping…" : "Stop after this file") { model.stopRequested = true }.disabled(model.stopRequested)
                }
            }.padding(14)
            }
        }
        .frame(minWidth: 1020, minHeight: 700)
        .background(Color(nsColor: .windowBackgroundColor))
        .tint(accent)
        .onOpenURL { model.add([$0]) }
    }

    var sidebar: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 10) {
                if let logo = NSImage(contentsOf: Bundle.main.url(forResource: "AppIcon", withExtension: "png") ?? URL(fileURLWithPath: "")) {
                    Image(nsImage: logo).resizable().interpolation(.high).frame(width: 66, height: 66)
                }
                Text("Watermarks\nCleaner").font(.system(size: 21, weight: .semibold, design: .rounded)).lineSpacing(1)
                Text("Less hidden. More yours.").font(.caption).foregroundStyle(.secondary)
            }.padding(.bottom, 10)
            VStack(spacing: 6) {
                navigation("Files", subtitle: "Inspect & clean", icon: "doc.on.doc", mode: "files")
                navigation("Text", subtitle: "Paste & tidy up", icon: "text.alignleft", mode: "text")
            }
            Spacer()
            VStack(alignment: .leading, spacing: 10) {
                Label("Private by design", systemImage: "lock.shield").font(.caption.weight(.semibold))
                Text("Your files stay on this Mac. Originals are always preserved.")
                    .font(.caption).foregroundStyle(.secondary).lineSpacing(3)
            }.padding(14).background(accent.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
            Text("WATERMARKS CLEANER  /  1.0").font(.system(size: 8, weight: .medium)).tracking(1).foregroundStyle(.tertiary)
        }.padding(22).frame(width: 210).frame(maxHeight: .infinity)
            .background(.ultraThinMaterial)
    }

    func navigation(_ title: String, subtitle: String, icon: String, mode: String) -> some View {
        Button { model.mode = mode } label: {
            HStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 18)).frame(width: 24)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.system(size: 13, weight: .semibold))
                    Text(subtitle).font(.caption2).foregroundStyle(.secondary)
                }
                Spacer()
                if mode == "files", !model.files.isEmpty { Text("\(model.files.count)").font(.caption).monospacedDigit() }
            }.padding(12).contentShape(Rectangle())
                .foregroundStyle(model.mode == mode ? accent : .primary)
                .background(model.mode == mode ? accent.opacity(0.12) : .clear, in: RoundedRectangle(cornerRadius: 10))
        }.buttonStyle(.plain).disabled(model.busy)
    }

    var filesView: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Button(action: model.chooseFiles) { Label("Add files", systemImage: "plus") }.keyboardShortcut("o")
                if !model.files.isEmpty {
                    Menu {
                        Button("Remove selected file", action: model.removeSelected).disabled(model.selection == nil)
                        Button("Clear all files") { model.files.removeAll(); model.selection = nil; model.progress = "" }
                    } label: { Image(systemName: "ellipsis") }.menuStyle(.borderlessButton).frame(width: 24).help("Manage file list")
                }
                Spacer()
                Button("Inspect all") { model.runFiles(clean: false) }.disabled(model.files.isEmpty)
                Button("Clean & save copies…") { model.runFiles(clean: true) }.buttonStyle(.borderedProminent).disabled(model.files.isEmpty)
            }.disabled(model.busy)
            if model.files.isEmpty {
                VStack(spacing: 15) {
                    Image(systemName: "square.and.arrow.down.on.square").font(.system(size: 44, weight: .light)).foregroundStyle(accent)
                        .frame(width: 96, height: 96).background(accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 26))
                    Text(model.dropTarget ? "Release to add files" : "Drop files. Leave less behind.").font(.system(size: 22, weight: .medium, design: .rounded))
                    Text("Choose one file or bring a whole batch.").foregroundStyle(.secondary)
                    Button("Browse files…", action: model.chooseFiles).buttonStyle(.borderedProminent).controlSize(.large).padding(.top, 6)
                    HStack(spacing: 18) {
                        Label("Images", systemImage: "photo")
                        Label("Documents", systemImage: "doc.text")
                        Label("Media", systemImage: "play.rectangle")
                    }.font(.caption).foregroundStyle(.secondary).padding(.top, 12)
                }.frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(accent.opacity(model.dropTarget ? 0.12 : 0.04), in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(accent.opacity(0.25), style: StrokeStyle(lineWidth: 1, dash: [6])))
            } else {
                HSplitView {
                    List(selection: $model.selection) {
                        ForEach(model.files) { item in
                            HStack(spacing: 10) {
                                Image(nsImage: NSWorkspace.shared.icon(forFile: item.url.path)).resizable().frame(width: 28, height: 28)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(item.url.lastPathComponent).lineLimit(1)
                                    Text(item.status).font(.caption).foregroundStyle(item.failed ? Color.red : item.warning ? Color.orange : .secondary)
                                }
                                Spacer()
                            }.padding(.vertical, 5).tag(item.id)
                        }
                    }.frame(minWidth: 270, idealWidth: 320)
                    VStack(alignment: .leading, spacing: 14) {
                        if let item = model.files.first(where: { $0.id == model.selection }) {
                            Image(nsImage: NSWorkspace.shared.icon(forFile: item.url.path)).resizable().frame(width: 52, height: 52)
                            Text(item.url.lastPathComponent).font(.headline).textSelection(.enabled).lineLimit(2)
                            Label(item.status, systemImage: item.failed ? "xmark.circle.fill" : item.warning ? "exclamationmark.triangle.fill" : item.output != nil ? "checkmark.circle.fill" : "doc.text.magnifyingglass")
                                .font(.callout.weight(.medium)).foregroundStyle(item.failed ? .red : item.warning ? .orange : accent)
                            if item.failed {
                                Text(item.report).font(.caption).foregroundStyle(.secondary).lineLimit(4).textSelection(.enabled)
                            } else {
                                Text(item.output != nil ? "Your copy is ready. The original file is untouched." : item.status == "Marks found" ? "The engine found hidden marks. Save a cleaned copy to remove supported marks." : "Inspect for hidden metadata and text characters before saving a clean copy.")
                                    .font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                            }
                            if let output = item.output {
                                Button("Show saved copy in Finder") { NSWorkspace.shared.activateFileViewerSelecting([output]) }
                            }
                            Divider()
                            DisclosureGroup("Technical report", isExpanded: $model.showDetails) {
                              ScrollView {
                                Text(item.report).font(.system(size: 11, design: .monospaced)).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading)
                              }.frame(height: 140).padding(.top, 8)
                            }
                            Spacer(minLength: 0)
                        } else { Text("Select a file to see its report.").foregroundStyle(.secondary) }
                    }.padding(22).frame(minWidth: 300, maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }.background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 10))
            }
            HStack(spacing: 12) {
                Image(systemName: "slider.horizontal.3").foregroundStyle(accent)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Keep ordinary media metadata").font(.callout.weight(.medium))
                    Text("Preserve non-AI camera and media details where supported.").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Toggle("Keep ordinary media metadata", isOn: $model.preserveMetadata).labelsHidden().toggleStyle(.switch).disabled(model.busy)
            }.padding(14).background(Color.primary.opacity(0.035), in: RoundedRectangle(cornerRadius: 12))
            Text("Cleans hidden metadata and text marks, not visible logos or pixel-level watermarks. PDF results may need review.")
                .font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        }.padding(28)
        .onDrop(of: [UTType.fileURL.identifier], isTargeted: $model.dropTarget) { providers in
            guard !model.busy else { return false }
            for provider in providers {
                _ = provider.loadObject(ofClass: URL.self) { url, _ in
                    if let url { Task { @MainActor in model.add([url]) } }
                }
            }
            return true
        }
    }

    var textView: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Clean up invisible characters").font(.headline)
                Spacer()
                Button("Paste") { model.sourceText = NSPasteboard.general.string(forType: .string) ?? "" }.disabled(model.busy)
                Button("Clean text", action: model.cleanText).buttonStyle(.borderedProminent).disabled(model.sourceText.isEmpty || model.busy)
            }
            HStack(spacing: 18) {
                VStack(alignment: .leading) {
                    Text("ORIGINAL").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    TextEditor(text: $model.sourceText).font(.body).padding(8).background(Color(nsColor: .textBackgroundColor)).clipShape(RoundedRectangle(cornerRadius: 10)).disabled(model.busy)
                }
                VStack(alignment: .leading) {
                    HStack {
                        Text("CLEANED").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        Spacer()
                        Button("Copy") {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(model.cleanedText, forType: .string)
                            model.textStatus = "Copied cleaned text."
                        }.disabled(model.cleanedText.isEmpty)
                    }
                    ScrollView { Text(model.cleanedText.isEmpty ? "Your cleaned text will appear here." : model.cleanedText).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .topLeading).padding(12) }
                        .frame(maxWidth: .infinity, maxHeight: .infinity).background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 10))
                }
            }
            Text(model.textStatus).font(.callout).foregroundStyle(accent)
            Text("Removes hidden Unicode marks and normalizes unusual spaces. This does not rewrite wording or remove statistical AI text watermarks. Review the result before use.").font(.caption).foregroundStyle(.secondary)
        }.padding(22)
    }
}

@MainActor final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Set the running Dock icon explicitly, even when Launch Services has
        // cached the placeholder from an earlier local build.
        if let url = Bundle.main.url(forResource: "AppIcon", withExtension: "icns"),
           let icon = NSImage(contentsOf: url) {
            NSApplication.shared.applicationIconImage = icon
        }
    }
}

@main struct WatermarksApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var model = AppModel()
    var body: some Scene {
        WindowGroup {
            ContentView().environmentObject(model)
        }.defaultSize(width: 1180, height: 800)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("Add Files…", action: model.chooseFiles).keyboardShortcut("o").disabled(model.busy)
            }
            CommandGroup(replacing: .help) {
                Link("Original repository", destination: URL(string: "https://github.com/guillaumemeyer/watermarks-remover")!)
            }
        }
    }
}
