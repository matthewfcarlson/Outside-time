import Foundation
import Combine

/// Central app state — owns the CoreBridge, identity, sessions, and sync status.
/// SwiftUI views observe this via @EnvironmentObject.
final class AppState: ObservableObject {
    // MARK: - Published state

    @Published var sessions: [Session] = []
    @Published var goals: [Goal] = []
    @Published var activeTimer: TimerStartEvent?
    @Published var syncState: SyncState = .idle
    @Published var lastSyncAt: Date?
    @Published var isLoaded = false

    // MARK: - Dependencies

    let bridge: CoreBridge
    let keychain: KeychainService

    private var identityBase64: String?

    // MARK: - Init

    init() {
        self.keychain = KeychainService()
        self.bridge = CoreBridge()

        Task { @MainActor in
            await bootstrap()
        }
    }

    // MARK: - Bootstrap

    @MainActor
    func bootstrap() async {
        // Try to load existing identity from Keychain
        if let savedKey = keychain.loadSecretKey() {
            identityBase64 = savedKey
            bridge.restoreIdentity(secretKeyBase64: savedKey)
        } else {
            // Generate a fresh identity
            let newKey = bridge.generateIdentity()
            keychain.saveSecretKey(newKey)
            identityBase64 = newKey
        }

        // Load local events and reconstruct sessions
        refreshFromLocalEvents()
        isLoaded = true

        // Sync with server
        await syncAll()
    }

    // MARK: - Timer

    @MainActor
    func startTimer() async {
        let event = bridge.createTimerStart()
        activeTimer = event
        bridge.appendLocalEvent(event.asJSON())
        refreshFromLocalEvents()
        await pushEvent(event.asJSON())
    }

    @MainActor
    func stopTimer() async {
        guard let active = activeTimer else { return }
        let event = bridge.createTimerStop(startEventId: active.id, startTs: active.ts)
        activeTimer = nil
        bridge.appendLocalEvent(event)
        refreshFromLocalEvents()
        await pushEvent(event)
    }

    // MARK: - Manual Entry

    @MainActor
    func addManualEntry(startedAt: Date, endedAt: Date) async {
        let event = bridge.createManualEntry(
            startedAt: Int(startedAt.timeIntervalSince1970),
            endedAt: Int(endedAt.timeIntervalSince1970)
        )
        bridge.appendLocalEvent(event)
        refreshFromLocalEvents()
        await pushEvent(event)
    }

    // MARK: - Goals

    @MainActor
    func setGoal(targetMinutes: Int, period: String) async {
        let event = bridge.createGoalSet(targetMinutes: targetMinutes, period: period)
        bridge.appendLocalEvent(event)
        refreshFromLocalEvents()
        await pushEvent(event)
    }

    @MainActor
    func deleteGoal(goalEventId: String) async {
        let event = bridge.createGoalDelete(goalEventId: goalEventId)
        bridge.appendLocalEvent(event)
        refreshFromLocalEvents()
        await pushEvent(event)
    }

    // MARK: - Sync

    @MainActor
    func syncAll() async {
        syncState = .syncing
        do {
            try await bridge.syncAll()
            refreshFromLocalEvents()
            lastSyncAt = Date()
            syncState = .idle
        } catch {
            syncState = .error(error.localizedDescription)
        }
    }

    @MainActor
    private func pushEvent(_ eventJSON: String) async {
        syncState = .syncing
        do {
            try await bridge.pushEvent(eventJSON)
            lastSyncAt = Date()
            syncState = .idle
        } catch {
            // Event is saved locally; will sync later
            syncState = .error(error.localizedDescription)
        }
    }

    @MainActor
    func refreshFromLocalEvents() {
        sessions = bridge.reconstructSessions()
        goals = bridge.reconstructGoals()
        activeTimer = bridge.findActiveTimerStart()
    }

    // MARK: - Identity

    @MainActor
    func importIdentity(secretKeyBase64: String) async {
        bridge.restoreIdentity(secretKeyBase64: secretKeyBase64)
        keychain.saveSecretKey(secretKeyBase64)
        identityBase64 = secretKeyBase64
        refreshFromLocalEvents()
        await syncAll()
    }

    var publicKeyHex: String {
        bridge.getPublicKeyHex()
    }

    var secretKeyBase64: String? {
        identityBase64
    }
}

// MARK: - Supporting Types

enum SyncState: Equatable {
    case idle
    case syncing
    case error(String)
}
