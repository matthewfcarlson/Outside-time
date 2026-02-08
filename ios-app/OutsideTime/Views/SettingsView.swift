import SwiftUI

/// Settings screen: identity management, key backup/restore, sync controls.
struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var showingExport = false
    @State private var showingImport = false
    @State private var importKeyText = ""
    @State private var showingImportError = false

    var body: some View {
        NavigationStack {
            Form {
                // Identity section
                Section("Identity") {
                    LabeledContent("Public Key") {
                        Text(truncatedKey)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }

                    Button("Export Secret Key") {
                        showingExport = true
                    }

                    Button("Import Secret Key") {
                        showingImport = true
                    }
                }

                // Sync section
                Section("Sync") {
                    LabeledContent("Status") {
                        switch appState.syncState {
                        case .idle:
                            Label("Synced", systemImage: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                        case .syncing:
                            HStack(spacing: 4) {
                                ProgressView()
                                Text("Syncing...")
                            }
                        case .error(let msg):
                            Label(msg, systemImage: "exclamationmark.triangle.fill")
                                .foregroundStyle(.orange)
                        }
                    }

                    if let lastSync = appState.lastSyncAt {
                        LabeledContent("Last Sync") {
                            Text(lastSync, style: .relative)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Button("Sync Now") {
                        Task { await appState.syncAll() }
                    }
                }

                // About section
                Section("About") {
                    LabeledContent("Version", value: "0.1.0")
                    LabeledContent("Architecture", value: "Zero-knowledge")
                }
            }
            .navigationTitle("Settings")
            .alert("Export Key", isPresented: $showingExport) {
                Button("Copy to Clipboard") {
                    if let key = appState.secretKeyBase64 {
                        UIPasteboard.general.string = key
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Your secret key controls all your data. Keep it safe and never share it with anyone you don't trust.")
            }
            .alert("Import Key", isPresented: $showingImport) {
                TextField("Paste base64 secret key", text: $importKeyText)
                Button("Import") {
                    Task {
                        await appState.importIdentity(secretKeyBase64: importKeyText)
                        importKeyText = ""
                    }
                }
                Button("Cancel", role: .cancel) { importKeyText = "" }
            } message: {
                Text("Paste a base64-encoded secret key to restore your identity. This will replace your current identity.")
            }
        }
    }

    private var truncatedKey: String {
        let key = appState.publicKeyHex
        if key.count > 16 {
            let start = key.prefix(8)
            let end = key.suffix(8)
            return "\(start)...\(end)"
        }
        return key
    }
}
