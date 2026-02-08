import SwiftUI

/// Large start/stop timer button with elapsed time display.
struct TimerView: View {
    @EnvironmentObject var appState: AppState
    @State private var elapsed: TimeInterval = 0
    @State private var timer: Timer?

    private var isRunning: Bool {
        appState.activeTimer != nil
    }

    var body: some View {
        VStack(spacing: 16) {
            // Elapsed time display
            Text(formattedElapsed)
                .font(.system(size: 48, weight: .light, design: .monospaced))
                .foregroundStyle(isRunning ? .primary : .secondary)

            // Start/Stop button
            Button {
                Task {
                    if isRunning {
                        await appState.stopTimer()
                        stopTicking()
                    } else {
                        await appState.startTimer()
                        startTicking()
                    }
                }
            } label: {
                Circle()
                    .fill(isRunning ? Color.red.opacity(0.9) : Color("AccentGreen"))
                    .frame(width: 120, height: 120)
                    .overlay {
                        Image(systemName: isRunning ? "stop.fill" : "play.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(.white)
                    }
                    .shadow(color: isRunning ? .red.opacity(0.3) : Color("AccentGreen").opacity(0.3),
                            radius: 12, y: 4)
            }

            Text(isRunning ? "Tap to stop" : "Tap to start")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .onAppear {
            if isRunning {
                startTicking()
            }
        }
        .onDisappear {
            stopTicking()
        }
    }

    private var formattedElapsed: String {
        let total = Int(elapsed)
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }

    private func startTicking() {
        updateElapsed()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            updateElapsed()
        }
    }

    private func stopTicking() {
        timer?.invalidate()
        timer = nil
        elapsed = 0
    }

    private func updateElapsed() {
        guard let active = appState.activeTimer else {
            elapsed = 0
            return
        }
        elapsed = Date().timeIntervalSince1970 - TimeInterval(active.ts)
    }
}
