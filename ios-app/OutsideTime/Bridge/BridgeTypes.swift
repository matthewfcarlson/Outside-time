import Foundation

/// Swift representations of the core event/session types.
/// These mirror the TypeScript types in packages/core and are used for JSON decoding
/// from the JSC bridge.

// MARK: - Session (decoded from JS reconstructSessions)

struct Session: Codable, Identifiable, Equatable {
    let id: String
    let startedAt: Int      // Unix timestamp (seconds)
    let endedAt: Int        // Unix timestamp (seconds)
    let durationMinutes: Int
    let source: String      // "timer" | "manual"

    var startDate: Date { Date(timeIntervalSince1970: TimeInterval(startedAt)) }
    var endDate: Date { Date(timeIntervalSince1970: TimeInterval(endedAt)) }

    var formattedDuration: String {
        let h = durationMinutes / 60
        let m = durationMinutes % 60
        if h == 0 { return "\(m)m" }
        if m == 0 { return "\(h)h" }
        return "\(h)h \(m)m"
    }
}

// MARK: - Goal (decoded from JS reconstructGoals)

struct Goal: Codable, Identifiable, Equatable {
    let id: String
    let targetMinutes: Int
    let period: String      // "day" | "week" | "month" | "year"
    let createdAt: Int      // Unix timestamp (seconds)

    var periodLabel: String {
        switch period {
        case "day": return "Daily"
        case "week": return "Weekly"
        case "month": return "Monthly"
        case "year": return "Yearly"
        default: return period
        }
    }
}

// MARK: - Timer Start Event (for active timer tracking)

struct TimerStartEvent: Codable, Equatable {
    let id: String
    let ts: Int             // Unix timestamp (seconds)

    var startDate: Date { Date(timeIntervalSince1970: TimeInterval(ts)) }

    func asJSON() -> String {
        let encoder = JSONEncoder()
        // Include the "type" field that the core expects
        struct Full: Encodable {
            let type = "timer_start"
            let id: String
            let ts: Int
        }
        let full = Full(id: id, ts: ts)
        guard let data = try? encoder.encode(full),
              let json = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return json
    }
}

// MARK: - Summary

struct DaySummary {
    let sessionCount: Int
    let totalMinutes: Int

    var formattedTotal: String {
        let h = totalMinutes / 60
        let m = totalMinutes % 60
        if totalMinutes == 0 { return "0m" }
        if h == 0 { return "\(m)m" }
        if m == 0 { return "\(h)h" }
        return "\(h)h \(m)m"
    }
}
