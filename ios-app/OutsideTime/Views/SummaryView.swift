import SwiftUI

/// Today's outdoor time summary card.
struct SummaryView: View {
    @EnvironmentObject var appState: AppState

    private var todaySessions: [Session] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: today)!
        return appState.sessions.filter { session in
            session.startDate >= today && session.startDate < tomorrow
        }
    }

    private var totalMinutes: Int {
        todaySessions.reduce(0) { $0 + $1.durationMinutes }
    }

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Today")
                        .font(.headline)
                        .foregroundStyle(.secondary)

                    Text(formattedDuration(totalMinutes))
                        .font(.system(size: 32, weight: .semibold))
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text("Sessions")
                        .font(.headline)
                        .foregroundStyle(.secondary)

                    Text("\(todaySessions.count)")
                        .font(.system(size: 32, weight: .semibold))
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(16)
    }

    private func formattedDuration(_ minutes: Int) -> String {
        if minutes == 0 { return "0m" }
        let h = minutes / 60
        let m = minutes % 60
        if h == 0 { return "\(m)m" }
        if m == 0 { return "\(h)h" }
        return "\(h)h \(m)m"
    }
}
