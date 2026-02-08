import SwiftUI

/// Small sync status indicator shown on the home screen.
struct SyncStatusView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        HStack(spacing: 6) {
            switch appState.syncState {
            case .idle:
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                Text("Synced")
                    .foregroundStyle(.secondary)
            case .syncing:
                ProgressView()
                    .controlSize(.small)
                Text("Syncing...")
                    .foregroundStyle(.secondary)
            case .error(let msg):
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                Text(msg)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .font(.caption)
    }
}
