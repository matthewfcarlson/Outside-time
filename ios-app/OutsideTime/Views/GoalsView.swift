import SwiftUI

/// Goal management and progress tracking.
struct GoalsView: View {
    @EnvironmentObject var appState: AppState
    @State private var showingAddGoal = false

    var body: some View {
        NavigationStack {
            Group {
                if appState.goals.isEmpty {
                    ContentUnavailableView(
                        "No goals set",
                        systemImage: "target",
                        description: Text("Set a goal to track your outdoor time progress.")
                    )
                } else {
                    List {
                        ForEach(appState.goals) { goal in
                            GoalRow(goal: goal, sessions: appState.sessions)
                        }
                        .onDelete { indexSet in
                            Task {
                                for index in indexSet {
                                    let goal = appState.goals[index]
                                    await appState.deleteGoal(goalEventId: goal.id)
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Goals")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingAddGoal = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingAddGoal) {
                AddGoalSheet()
            }
        }
    }
}

// MARK: - Goal Row

struct GoalRow: View {
    let goal: Goal
    let sessions: [Session]

    private var progress: (current: Int, percentage: Int) {
        // Compute progress for the current period
        let calendar = Calendar.current
        let now = Date()
        var periodStart: Date
        var periodEnd: Date

        switch goal.period {
        case "day":
            periodStart = calendar.startOfDay(for: now)
            periodEnd = calendar.date(byAdding: .day, value: 1, to: periodStart)!
        case "week":
            let weekday = calendar.component(.weekday, from: now)
            periodStart = calendar.date(byAdding: .day, value: -(weekday - 1), to: calendar.startOfDay(for: now))!
            periodEnd = calendar.date(byAdding: .day, value: 7, to: periodStart)!
        case "month":
            periodStart = calendar.date(from: calendar.dateComponents([.year, .month], from: now))!
            periodEnd = calendar.date(byAdding: .month, value: 1, to: periodStart)!
        case "year":
            periodStart = calendar.date(from: calendar.dateComponents([.year], from: now))!
            periodEnd = calendar.date(byAdding: .year, value: 1, to: periodStart)!
        default:
            periodStart = calendar.startOfDay(for: now)
            periodEnd = calendar.date(byAdding: .day, value: 1, to: periodStart)!
        }

        let periodSessions = sessions.filter { s in
            s.startDate >= periodStart && s.startDate < periodEnd
        }
        let current = periodSessions.reduce(0) { $0 + $1.durationMinutes }
        let pct = goal.targetMinutes > 0
            ? min(100, Int(Double(current) / Double(goal.targetMinutes) * 100))
            : 0
        return (current, pct)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(goal.periodLabel)
                    .font(.headline)
                Spacer()
                Text("\(progress.current)m / \(goal.targetMinutes)m")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            ProgressView(value: Double(progress.percentage), total: 100)
                .tint(progress.percentage >= 100 ? .green : Color("AccentGreen"))

            Text("\(progress.percentage)%")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Add Goal Sheet

struct AddGoalSheet: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var targetMinutes = 60
    @State private var period = "day"

    private let periods = ["day", "week", "month", "year"]
    private let periodLabels = ["Daily", "Weekly", "Monthly", "Yearly"]

    var body: some View {
        NavigationStack {
            Form {
                Picker("Period", selection: $period) {
                    ForEach(Array(zip(periods, periodLabels)), id: \.0) { value, label in
                        Text(label).tag(value)
                    }
                }

                Stepper("Target: \(targetMinutes) min", value: $targetMinutes, in: 5...1440, step: 5)
            }
            .navigationTitle("New Goal")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            await appState.setGoal(targetMinutes: targetMinutes, period: period)
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}
