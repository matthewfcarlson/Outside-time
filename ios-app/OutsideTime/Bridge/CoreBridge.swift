import JavaScriptCore
import Security

/// Bridge between native Swift and the shared TypeScript core running in JavaScriptCore.
///
/// The core.bundle.js (built from packages/core via esbuild) is loaded into a JSContext.
/// All business logic — crypto, event creation, session reconstruction, sync — runs in JS.
/// This class provides a typed Swift interface over the JS functions.
final class CoreBridge {
    private let context: JSContext
    private let core: JSValue  // The OutsideTimeCore global

    init() {
        guard let context = JSContext() else {
            fatalError("Failed to create JSContext")
        }
        self.context = context

        // Install console.log/warn/error for debugging
        let consoleLog: @convention(block) (String) -> Void = { msg in
            print("[JSC] \(msg)")
        }
        let consoleObj = JSValue(newObjectIn: context)!
        consoleObj.setObject(consoleLog, forKeyedSubscript: "log" as NSString)
        consoleObj.setObject(consoleLog, forKeyedSubscript: "warn" as NSString)
        consoleObj.setObject(consoleLog, forKeyedSubscript: "error" as NSString)
        context.setObject(consoleObj, forKeyedSubscript: "console" as NSString)

        // Install crypto polyfills (JSC doesn't have Web Crypto API)
        // tweetnacl needs self.crypto.getRandomValues for its PRNG
        // events.ts needs crypto.randomUUID
        let cryptoObj = JSValue(newObjectIn: context)!
        let randomUUID: @convention(block) () -> String = {
            UUID().uuidString.lowercased()
        }
        let getRandomValues: @convention(block) (JSValue) -> JSValue = { buf in
            let length = Int(buf.objectForKeyedSubscript("length")!.toInt32())
            var bytes = [UInt8](repeating: 0, count: length)
            _ = SecRandomCopyBytes(kSecRandomDefault, length, &bytes)
            for i in 0..<length {
                buf.setObject(NSNumber(value: bytes[i]), atIndexedSubscript: i)
            }
            return buf
        }
        cryptoObj.setObject(randomUUID, forKeyedSubscript: "randomUUID" as NSString)
        cryptoObj.setObject(getRandomValues, forKeyedSubscript: "getRandomValues" as NSString)
        context.setObject(cryptoObj, forKeyedSubscript: "crypto" as NSString)

        // tweetnacl looks for self.crypto.getRandomValues
        let selfObj = JSValue(newObjectIn: context)!
        selfObj.setObject(cryptoObj, forKeyedSubscript: "crypto" as NSString)
        context.setObject(selfObj, forKeyedSubscript: "self" as NSString)

        // Install atob/btoa (tweetnacl-util uses these in browser mode)
        context.evaluateScript("""
            var atob = function(s) {
                var e = {}, i, k, v = [], r = '', w = String.fromCharCode;
                var n = [[65,91],[97,123],[48,58],[43,44],[47,48]];
                for (var z in n) { for (i = n[z][0]; i < n[z][1]; i++) v.push(w(i)); }
                for (i = 0; i < 64; i++) e[v[i]] = i;
                for (i = 0; i < s.length; i += 72) {
                    var b = 0, c, x, l = 0, o = s.substring(i, Math.min(i+72, s.length));
                    for (x = 0; x < o.length; x++) {
                        if (o.charAt(x) === '=') break;
                        b = (b << 6) + e[o.charAt(x)]; l += 6;
                        if (l >= 8) { l -= 8; r += w((b >>> l) & 0xff); }
                    }
                }
                return r;
            };
            var btoa = function(s) {
                var v = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var r = '', p = '';
                var c = s.length % 3;
                if (c > 0) { for (; c < 3; c++) { p += '='; s += '\\0'; } }
                for (c = 0; c < s.length; c += 3) {
                    var n = (s.charCodeAt(c) << 16) + (s.charCodeAt(c+1) << 8) + s.charCodeAt(c+2);
                    r += v.charAt((n >>> 18) & 63) + v.charAt((n >>> 12) & 63) +
                         v.charAt((n >>> 6) & 63) + v.charAt(n & 63);
                }
                return r.substring(0, r.length - p.length) + p;
            };
        """)

        // Install fetch polyfill (delegated to native URLSession)
        installFetchPolyfill(in: context)

        // Load the bundled core.js
        guard let bundlePath = Bundle.main.path(forResource: "core.bundle", ofType: "js"),
              let bundleSource = try? String(contentsOfFile: bundlePath, encoding: .utf8) else {
            fatalError("core.bundle.js not found in app bundle")
        }
        context.evaluateScript(bundleSource)

        // Check for JS errors
        if let exception = context.exception {
            fatalError("JS load error: \(exception)")
        }

        guard let coreValue = context.objectForKeyedSubscript("OutsideTimeCore"),
              !coreValue.isUndefined else {
            fatalError("OutsideTimeCore not found in JS context")
        }
        self.core = coreValue
    }

    // MARK: - Identity

    /// Generate a new identity and return the secret key as base64.
    func generateIdentity() -> String {
        let result = core.invokeMethod("generateIdentity", withArguments: [])!
        let secretKey = result.objectForKeyedSubscript("signingKeyPair")!
            .objectForKeyedSubscript("secretKey")!
        let exportFn = core.objectForKeyedSubscript("encodeBase64")!
        return exportFn.call(withArguments: [secretKey])!.toString()
    }

    /// Restore an identity from a base64-encoded secret key.
    func restoreIdentity(secretKeyBase64: String) {
        context.evaluateScript("""
            var __identity = OutsideTimeCore.importSecretKey('\(escapeJS(secretKeyBase64))');
        """)
    }

    /// Get the current identity's public key hex string.
    func getPublicKeyHex() -> String {
        return context.evaluateScript("__identity ? __identity.publicKeyHex : ''")!.toString()
    }

    // MARK: - Event Creation

    func createTimerStart() -> TimerStartEvent {
        let result = core.invokeMethod("createTimerStart", withArguments: [])!
        return TimerStartEvent(
            id: result.objectForKeyedSubscript("id")!.toString(),
            ts: Int(result.objectForKeyedSubscript("ts")!.toInt32())
        )
    }

    func createTimerStop(startEventId: String, startTs: Int) -> String {
        let js = """
            JSON.stringify(OutsideTimeCore.createTimerStop({
                type: 'timer_start',
                id: '\(escapeJS(startEventId))',
                ts: \(startTs)
            }))
        """
        return context.evaluateScript(js)!.toString()
    }

    func createManualEntry(startedAt: Int, endedAt: Int) -> String {
        let js = "JSON.stringify(OutsideTimeCore.createManualEntry(\(startedAt), \(endedAt)))"
        return context.evaluateScript(js)!.toString()
    }

    func createGoalSet(targetMinutes: Int, period: String) -> String {
        let js = "JSON.stringify(OutsideTimeCore.createGoalSet(\(targetMinutes), '\(escapeJS(period))'))"
        return context.evaluateScript(js)!.toString()
    }

    func createGoalDelete(goalEventId: String) -> String {
        let js = "JSON.stringify(OutsideTimeCore.createGoalDelete('\(escapeJS(goalEventId))'))"
        return context.evaluateScript(js)!.toString()
    }

    // MARK: - Local Event Storage

    /// Store a JSON event string in the JS-side local event array.
    func appendLocalEvent(_ eventJSON: String) {
        context.evaluateScript("""
            if (!globalThis.__localEvents) globalThis.__localEvents = [];
            globalThis.__localEvents.push(JSON.parse(\(jsStringLiteral(eventJSON))));
        """)
    }

    // MARK: - Session Reconstruction

    func reconstructSessions() -> [Session] {
        let js = """
            (function() {
                var events = globalThis.__localEvents || [];
                var sessions = OutsideTimeCore.reconstructSessions(events);
                return JSON.stringify(sessions);
            })()
        """
        guard let jsonString = context.evaluateScript(js)?.toString(),
              let data = jsonString.data(using: .utf8),
              let sessions = try? JSONDecoder().decode([Session].self, from: data) else {
            return []
        }
        return sessions
    }

    func reconstructGoals() -> [Goal] {
        let js = """
            (function() {
                var events = globalThis.__localEvents || [];
                var goals = OutsideTimeCore.reconstructGoals(events);
                return JSON.stringify(goals);
            })()
        """
        guard let jsonString = context.evaluateScript(js)?.toString(),
              let data = jsonString.data(using: .utf8),
              let goals = try? JSONDecoder().decode([Goal].self, from: data) else {
            return []
        }
        return goals
    }

    func findActiveTimerStart() -> TimerStartEvent? {
        let js = """
            (function() {
                var events = globalThis.__localEvents || [];
                var active = OutsideTimeCore.findActiveTimerStart(events);
                return active ? JSON.stringify(active) : 'null';
            })()
        """
        guard let jsonString = context.evaluateScript(js)?.toString(),
              jsonString != "null",
              let data = jsonString.data(using: .utf8),
              let event = try? JSONDecoder().decode(TimerStartEvent.self, from: data) else {
            return nil
        }
        return event
    }

    // MARK: - Sync (async via native fetch)

    func pushEvent(_ eventJSON: String) async throws {
        // Encryption and signing happen in JS; the fetch polyfill handles HTTP
        let js = """
            (async function() {
                var event = JSON.parse(\(jsStringLiteral(eventJSON)));
                var plaintext = OutsideTimeCore.encodeEvent(event);
                var ciphertext = OutsideTimeCore.encryptEvent(plaintext, __identity);
                var ciphertextBase64 = OutsideTimeCore.encodeBase64(ciphertext);
                var signature = OutsideTimeCore.signForAppend(
                    __identity.publicKeyHex, ciphertextBase64,
                    __identity.signingKeyPair.secretKey
                );
                var res = await fetch(__apiBase + '/api/log/' + __identity.publicKeyHex, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Signature': signature },
                    body: JSON.stringify({ ciphertext: ciphertextBase64 })
                });
                if (!res.ok) throw new Error('Push failed: ' + res.status);
                return await res.json();
            })()
        """
        let promise = context.evaluateScript(js)!
        // In production, the fetch polyfill resolves promises via callbacks.
        // For now, this is a placeholder — real async bridging requires a run loop.
        if let exception = context.exception {
            throw BridgeError.jsError(exception.toString())
        }
        _ = promise
    }

    func syncAll() async throws {
        // Pull is a server fetch — handled by the native fetch polyfill
        // This is a simplified version; full implementation would use SyncEngine
        try await pullEvents()
    }

    private func pullEvents() async throws {
        // Placeholder — full implementation uses SyncEngine in JS
        // with the native fetch polyfill handling HTTP calls
    }

    // MARK: - Config

    func setApiBase(_ url: String) {
        context.evaluateScript("var __apiBase = '\(escapeJS(url))';")
    }

    // MARK: - Helpers

    private func escapeJS(_ s: String) -> String {
        s.replacingOccurrences(of: "\\", with: "\\\\")
         .replacingOccurrences(of: "'", with: "\\'")
         .replacingOccurrences(of: "\n", with: "\\n")
    }

    private func jsStringLiteral(_ s: String) -> String {
        let escaped = s.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\n", with: "\\n")
        return "'\(escaped)'"
    }
}

// MARK: - Fetch Polyfill

/// Installs a minimal `fetch()` in the JSContext backed by URLSession.
/// This allows the JS sync engine to make HTTP calls without a WebView.
private func installFetchPolyfill(in context: JSContext) {
    // The fetch polyfill is installed as a global function.
    // It returns a JS Promise-like object. For initial scaffolding,
    // we use a synchronous approach. A production implementation would
    // use JSValue callbacks with proper async bridging.
    let fetchFn: @convention(block) (String, JSValue?) -> JSValue = { urlString, options in
        let method = options?.objectForKeyedSubscript("method")?.toString() ?? "GET"
        let body = options?.objectForKeyedSubscript("body")?.toString()
        let headers = options?.objectForKeyedSubscript("headers")

        guard let url = URL(string: urlString) else {
            return JSValue(undefinedIn: context)
        }

        var request = URLRequest(url: url)
        request.httpMethod = method

        if let body = body {
            request.httpBody = body.data(using: .utf8)
        }

        if let headers = headers, !headers.isUndefined {
            // Extract headers via JSON round-trip
            let headersJSON = context.evaluateScript("JSON.stringify(\(headers))")?.toString() ?? "{}"
            if let data = headersJSON.data(using: .utf8),
               let dict = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
                for (key, value) in dict {
                    request.setValue(value, forHTTPHeaderField: key)
                }
            }
        }

        // Create a Promise-like result object
        let resultObj = JSValue(newObjectIn: context)!
        resultObj.setObject(true, forKeyedSubscript: "ok" as NSString)
        resultObj.setObject(200, forKeyedSubscript: "status" as NSString)

        // Synchronous for scaffolding — production should use async callbacks
        let semaphore = DispatchSemaphore(value: 0)
        var responseData: Data?
        var responseCode: Int = 0
        var responseHeaders: [AnyHashable: Any] = [:]

        URLSession.shared.dataTask(with: request) { data, response, _ in
            responseData = data
            if let httpResponse = response as? HTTPURLResponse {
                responseCode = httpResponse.statusCode
                responseHeaders = httpResponse.allHeaderFields
            }
            semaphore.signal()
        }.resume()

        semaphore.wait()

        resultObj.setObject(responseCode >= 200 && responseCode < 300,
                           forKeyedSubscript: "ok" as NSString)
        resultObj.setObject(responseCode, forKeyedSubscript: "status" as NSString)

        // response.headers.get(name)
        let headersObj = JSValue(newObjectIn: context)!
        let getFn: @convention(block) (String) -> String? = { name in
            responseHeaders[name] as? String
        }
        headersObj.setObject(getFn, forKeyedSubscript: "get" as NSString)
        resultObj.setObject(headersObj, forKeyedSubscript: "headers" as NSString)

        // response.json()
        let jsonFn: @convention(block) () -> JSValue = {
            guard let data = responseData,
                  let str = String(data: data, encoding: .utf8) else {
                return JSValue(undefinedIn: context)
            }
            return context.evaluateScript("(\(str))")!
        }
        resultObj.setObject(jsonFn, forKeyedSubscript: "json" as NSString)

        // response.text()
        let textFn: @convention(block) () -> String = {
            guard let data = responseData else { return "" }
            return String(data: data, encoding: .utf8) ?? ""
        }
        resultObj.setObject(textFn, forKeyedSubscript: "text" as NSString)

        return resultObj
    }

    context.setObject(fetchFn, forKeyedSubscript: "fetch" as NSString)
}

// MARK: - Errors

enum BridgeError: LocalizedError {
    case jsError(String)

    var errorDescription: String? {
        switch self {
        case .jsError(let msg): return "JavaScript error: \(msg)"
        }
    }
}
