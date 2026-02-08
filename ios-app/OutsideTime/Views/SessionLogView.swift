import SwiftUI

/// Scrollable list of past outdoor sessions.
struct SessionLogView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationStack {
            Group {
                if appState.sessions.isEmpty {
                    ContentUnavailableView(
                        "No sessions yet",
                        systemImage: "leaf",
                        description: Text("Start your first outdoor session from the Home tab.")
                    )
                } else {
                    List {
                        ForEach(groupedByDate, id: \.0) { dateString, sessions in
                            Section(dateString) {
                                ForEach(sessions) { session in
                                    SessionRow(session: session)
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Sessions")
            .refreshable {
                await appState.syncAll()
            }
        }
    }

    /// Group sessions by date for section headers.
    private var groupedByDate: [(String, [Session])] {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none

        let grouped = Dictionary(grouping: appState.sessions) { session in
            formatter.string(from: session.startDate)
        }

        return grouped.sorted { a, b in
            // Most recent date first
            guard let aFirst = a.value.first, let bFirst = b.value.first else { return false }
            return aFirst.startedAt > bFirst.startedAt
        }
    }
}

// MARK: - Session Row

struct SessionRow: View {
    let session: Session

    private var timeRange: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        let start = formatter.string(from: session.startDate)
        let end = formatter.string(from: session.endDate)
        return "\(start) – \(end)"
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(timeRange)
                    .font(.body)

                Text(session.source == "timer" ? "Timer" : "Manual")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Text(session.formattedDuration)
                .font(.headline)
                .foregroundStyle(Color("AccentGreen"))
        }
        .padding(.vertical, 4)
    }
}
