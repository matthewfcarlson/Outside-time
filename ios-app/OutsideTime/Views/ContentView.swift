import SwiftUI

/// Root tab-based navigation matching the web app's bottom bar.
struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem {
                    Label("Home", systemImage: "sun.max")
                }
                .tag(0)

            SessionLogView()
                .tabItem {
                    Label("Sessions", systemImage: "list.bullet")
                }
                .tag(1)

            GoalsView()
                .tabItem {
                    Label("Goals", systemImage: "target")
                }
                .tag(2)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(3)
        }
        .tint(Color("AccentGreen"))
    }
}
