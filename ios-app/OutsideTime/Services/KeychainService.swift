import Foundation
import Security

/// Wraps iOS Keychain for secure storage of the Ed25519 secret key.
/// Unlike localStorage on the web, Keychain data persists across app reinstalls
/// (when using the correct access group) and is protected by the Secure Enclave.
final class KeychainService {
    private let service = "com.outsidetime.identity"
    private let account = "ed25519-secret-key"

    /// Save the base64-encoded secret key to Keychain.
    func saveSecretKey(_ base64: String) {
        guard let data = base64.data(using: .utf8) else { return }

        // Delete any existing key first
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        // Add the new key
        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(addQuery as CFDictionary, nil)
    }

    /// Load the base64-encoded secret key from Keychain.
    func loadSecretKey() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let base64 = String(data: data, encoding: .utf8) else {
            return nil
        }
        return base64
    }

    /// Delete the secret key from Keychain.
    func deleteSecretKey() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
