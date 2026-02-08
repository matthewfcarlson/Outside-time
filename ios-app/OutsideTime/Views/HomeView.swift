import SwiftUI

/// Main screen: timer + today's summary.
struct HomeView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                // Timer circle
                TimerView()

                // Today's summary
                SummaryView()

                Spacer()

                // Sync status
                SyncStatusView()
            }
            .padding()
            .navigationTitle("Outside Time")
            .refreshable {
                await appState.syncAll()
            }
        }
    }
}
