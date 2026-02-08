import XCTest
@testable import OutsideTime

final class BridgeTests: XCTestCase {

    func testCoreBridgeLoads() throws {
        // Verify the JSC context initializes and OutsideTimeCore is available
        let bridge = CoreBridge()
        let pubKey = bridge.getPublicKeyHex()
        // After generateIdentity, pubKey should be empty until restoreIdentity is called
        // This test just verifies the bridge doesn't crash on init
        XCTAssertNotNil(bridge)
        _ = pubKey
    }

    func testGenerateIdentity() throws {
        let bridge = CoreBridge()
        let secretKeyBase64 = bridge.generateIdentity()
        XCTAssertFalse(secretKeyBase64.isEmpty, "Generated identity should produce a non-empty secret key")

        // Restore and verify we get a public key
        bridge.restoreIdentity(secretKeyBase64: secretKeyBase64)
        let pubKey = bridge.getPublicKeyHex()
        XCTAssertEqual(pubKey.count, 64, "Public key hex should be 64 characters")
    }

    func testSessionReconstruction() throws {
        let bridge = CoreBridge()
        let secretKeyBase64 = bridge.generateIdentity()
        bridge.restoreIdentity(secretKeyBase64: secretKeyBase64)

        // Initially no sessions
        let sessions = bridge.reconstructSessions()
        XCTAssertTrue(sessions.isEmpty)

        // Add a manual entry event
        let event = bridge.createManualEntry(
            startedAt: 1700000000,
            endedAt: 1700003600
        )
        bridge.appendLocalEvent(event)

        // Should now have one session
        let updatedSessions = bridge.reconstructSessions()
        XCTAssertEqual(updatedSessions.count, 1)
        XCTAssertEqual(updatedSessions.first?.durationMinutes, 60)
    }
}
