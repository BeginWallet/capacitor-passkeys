# Capacitor Passkeys Plugin — Implementation Tasks

Generated: 2026-02-05

## Summary

The plugin skeleton is in place with:
- ✅ TypeScript interfaces fully defined (`definitions.ts`)
- ✅ Web implementation complete (`web.ts`) — can be used as reference
- ⏳ iOS implementation — skeleton with TODOs
- ⏳ Android implementation — skeleton with TODOs

---

## Task Breakdown

### Legend
- **Difficulty:** 🟢 Easy | 🟡 Medium | 🔴 Hard
- **Assignee:** Opus (complex) | Kimi (straightforward)
- **Status:** ⬜ Not Started | 🔄 In Progress | ✅ Done

---

## iOS Tasks

### iOS-1: Implement `create()` — Passkey Registration
**Difficulty:** 🔴 Hard | **Assignee:** Opus | **Priority:** P0

**File:** `ios/Sources/PasskeysPlugin/PasskeysPlugin.swift`

**What's Already Done:**
- Parameter extraction and validation
- Base64URL decoding of challenge/userId
- Error rejection for missing params

**What Needs Implementing:**
1. Create `ASAuthorizationPlatformPublicKeyCredentialProvider` with `rpId`
2. Call `provider.createCredentialRegistrationRequest(challenge:name:userID:)`
3. Handle optional `authenticatorSelection`:
   - Map `userVerification` → `request.userVerificationPreference`
   - (Note: iOS doesn't expose attestation preference directly)
4. Create `ASAuthorizationController` with the request
5. Set `controller.delegate = self`
6. Set `controller.presentationContextProvider = self`
7. Store `currentCall` for async delegate callback
8. Call `controller.performRequests()`

**Code Location (line ~50-105):** Replace the TODO block after parameter validation

**Edge Cases:**
- User cancellation mid-flow
- Biometric failure
- Device not enrolled in Face ID/Touch ID
- Network timeout for attestation

**Dependencies:** None (foundational task)

---

### iOS-2: Implement `get()` — Passkey Authentication
**Difficulty:** 🔴 Hard | **Assignee:** Opus | **Priority:** P0

**File:** `ios/Sources/PasskeysPlugin/PasskeysPlugin.swift`

**What's Already Done:**
- Parameter extraction and validation
- Base64URL decoding of challenge

**What Needs Implementing:**
1. Create `ASAuthorizationPlatformPublicKeyCredentialProvider` with `rpId`
2. Call `provider.createCredentialAssertionRequest(challenge:)`
3. Handle optional `allowCredentials` array:
   ```swift
   if let allowCredentials = call.getArray("allowCredentials") {
       request.allowedCredentials = allowCredentials.compactMap { item in
           guard let dict = item as? [String: Any],
                 let idB64 = dict["id"] as? String,
                 let idData = base64UrlDecode(idB64) else { return nil }
           return ASAuthorizationPlatformPublicKeyCredentialDescriptor(credentialID: idData)
       }
   }
   ```
4. Handle optional `userVerification` preference
5. Create `ASAuthorizationController` with the request
6. Set delegates, store `currentCall`, perform requests

**Code Location (line ~107-160):** Replace the TODO block

**Edge Cases:**
- No credentials found for RP
- All allowed credentials deleted
- Conditional UI (iOS 17.4+) — optional enhancement

**Dependencies:** None (foundational task)

---

### iOS-3: Implement Delegate — Handle Registration Success
**Difficulty:** 🟡 Medium | **Assignee:** Opus | **Priority:** P0

**File:** `ios/Sources/PasskeysPlugin/PasskeysPlugin.swift`

**What Needs Implementing:**
In `authorizationController(didCompleteWithAuthorization:)`:

```swift
if let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration {
    guard let attestationObject = credential.rawAttestationObject else {
        currentCall?.reject("Missing attestation object", "unknownError")
        currentCall = nil
        return
    }
    
    let result: [String: Any] = [
        "id": base64UrlEncode(credential.credentialID),
        "rawId": base64UrlEncode(credential.credentialID),
        "type": "public-key",
        "response": [
            "clientDataJSON": base64UrlEncode(credential.rawClientDataJSON),
            "attestationObject": base64UrlEncode(attestationObject)
        ],
        "authenticatorAttachment": "platform"
    ]
    currentCall?.resolve(result)
    currentCall = nil
}
```

**Code Location (line ~185-210):** Inside the delegate method

**Dependencies:** iOS-1 (needs create() to trigger this path)

---

### iOS-4: Implement Delegate — Handle Authentication Success
**Difficulty:** 🟡 Medium | **Assignee:** Opus | **Priority:** P0

**File:** `ios/Sources/PasskeysPlugin/PasskeysPlugin.swift`

**What Needs Implementing:**
In `authorizationController(didCompleteWithAuthorization:)`:

```swift
if let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion {
    var response: [String: Any] = [
        "clientDataJSON": base64UrlEncode(credential.rawClientDataJSON),
        "authenticatorData": base64UrlEncode(credential.rawAuthenticatorData),
        "signature": base64UrlEncode(credential.signature)
    ]
    
    if let userHandle = credential.userID {
        response["userHandle"] = base64UrlEncode(userHandle)
    }
    
    let result: [String: Any] = [
        "id": base64UrlEncode(credential.credentialID),
        "rawId": base64UrlEncode(credential.credentialID),
        "type": "public-key",
        "response": response
    ]
    currentCall?.resolve(result)
    currentCall = nil
}
```

**Code Location (line ~185-210):** Inside the delegate method (after registration handling)

**Dependencies:** iOS-2 (needs get() to trigger this path)

---

### iOS-5: Verify Presentation Context Provider
**Difficulty:** 🟢 Easy | **Assignee:** Kimi | **Priority:** P1

**File:** `ios/Sources/PasskeysPlugin/PasskeysPlugin.swift`

**Current Code (line ~235):**
```swift
return self.bridge?.webView?.window ?? UIWindow()
```

**Tasks:**
1. Add nil-check logging for debugging
2. Consider using `UIApplication.shared.windows.first { $0.isKeyWindow }` as fallback
3. Test that authorization UI presents correctly

**Dependencies:** iOS-1 or iOS-2 (needs actual flow to test)

---

### iOS-6: Add Timeout Support
**Difficulty:** 🟢 Easy | **Assignee:** Kimi | **Priority:** P2

**What Needs Implementing:**
iOS's `ASAuthorizationController` doesn't have a direct timeout property. Options:
1. Document that timeout is platform-managed on iOS
2. Implement a manual timeout using `DispatchQueue.main.asyncAfter`

**Location:** Add note in create()/get() or implement timer

**Dependencies:** iOS-1, iOS-2

---

## Android Tasks

### Android-1: Implement `create()` — Passkey Registration
**Difficulty:** 🔴 Hard | **Assignee:** Opus | **Priority:** P0

**File:** `android/src/main/kotlin/io/beginwallet/passkeys/PasskeysPlugin.kt`

**What's Already Done:**
- Parameter extraction and validation
- CredentialManager initialization
- Base64URL helpers
- Error mapping

**What Needs Implementing:**

1. Build WebAuthn-compatible JSON request:
```kotlin
val pubKeyCredParams = call.getArray("pubKeyCredParams")?.let { arr ->
    JSONArray().apply {
        for (i in 0 until arr.length()) {
            val param = arr.getJSONObject(i)
            put(JSONObject().apply {
                put("type", param.getString("type"))
                put("alg", param.getInt("alg"))
            })
        }
    }
} ?: JSONArray().apply {
    put(JSONObject().put("type", "public-key").put("alg", -7))  // ES256
    put(JSONObject().put("type", "public-key").put("alg", -257)) // RS256
}

val authenticatorSelection = call.getObject("authenticatorSelection")?.let { sel ->
    JSONObject().apply {
        sel.getString("authenticatorAttachment")?.let { put("authenticatorAttachment", it) }
        sel.getString("residentKey")?.let { put("residentKey", it) }
        sel.getString("userVerification")?.let { put("userVerification", it) }
    }
} ?: JSONObject().apply {
    put("authenticatorAttachment", "platform")
    put("residentKey", "required")
    put("userVerification", "required")
}

val requestJson = JSONObject().apply {
    put("challenge", challenge)
    put("rp", JSONObject().apply {
        put("id", rpId)
        put("name", rpName)
    })
    put("user", JSONObject().apply {
        put("id", userId)
        put("name", userName)
        put("displayName", displayName)
    })
    put("pubKeyCredParams", pubKeyCredParams)
    put("authenticatorSelection", authenticatorSelection)
    call.getString("attestation")?.let { put("attestation", it) }
    call.getInt("timeout")?.let { put("timeout", it) }
}
```

2. Create and execute request:
```kotlin
val request = CreatePublicKeyCredentialRequest(
    requestJson = requestJson.toString()
)

scope.launch {
    try {
        val result = credentialManager.createCredential(
            context = activity,
            request = request
        )
        val responseJson = JSONObject(result.data.getString("androidx.credentials.BUNDLE_KEY_REGISTRATION_RESPONSE_JSON"))
        // Parse and resolve
    } catch (e: CreateCredentialException) {
        val (code, message) = mapCreateError(e)
        call.reject(message, code)
    }
}
```

3. Parse response and build result:
```kotlin
val resultObj = JSObject().apply {
    put("id", responseJson.getString("id"))
    put("rawId", responseJson.getString("rawId"))
    put("type", "public-key")
    put("response", JSObject().apply {
        val resp = responseJson.getJSONObject("response")
        put("clientDataJSON", resp.getString("clientDataJSON"))
        put("attestationObject", resp.getString("attestationObject"))
    })
    put("authenticatorAttachment", "platform")
}
call.resolve(resultObj)
```

**Code Location (line ~50-115):** Replace the TODO block

**Edge Cases:**
- Google Play Services not available
- No biometric enrolled
- User cancellation
- Credential already exists

**Dependencies:** None (foundational task)

---

### Android-2: Implement `get()` — Passkey Authentication
**Difficulty:** 🔴 Hard | **Assignee:** Opus | **Priority:** P0

**File:** `android/src/main/kotlin/io/beginwallet/passkeys/PasskeysPlugin.kt`

**What Needs Implementing:**

1. Build WebAuthn-compatible JSON request:
```kotlin
val requestJson = JSONObject().apply {
    put("challenge", challenge)
    put("rpId", rpId)
    put("userVerification", call.getString("userVerification") ?: "required")
    
    call.getArray("allowCredentials")?.let { arr ->
        val credArray = JSONArray()
        for (i in 0 until arr.length()) {
            val cred = arr.getJSONObject(i)
            credArray.put(JSONObject().apply {
                put("type", cred.getString("type"))
                put("id", cred.getString("id"))
                cred.getJSONArray("transports")?.let { put("transports", it) }
            })
        }
        put("allowCredentials", credArray)
    }
    
    call.getInt("timeout")?.let { put("timeout", it) }
}
```

2. Create and execute request:
```kotlin
val getRequest = GetCredentialRequest(
    credentialOptions = listOf(
        GetPublicKeyCredentialOption(requestJson.toString())
    )
)

scope.launch {
    try {
        val result = credentialManager.getCredential(
            context = activity,
            request = getRequest
        )
        // Parse PublicKeyCredential from result
    } catch (e: GetCredentialException) {
        val (code, message) = mapGetError(e)
        call.reject(message, code)
    }
}
```

3. Parse response and build result:
```kotlin
val credential = result.credential as? PublicKeyCredential
val responseJson = JSONObject(credential.authenticationResponseJson)

val resultObj = JSObject().apply {
    put("id", responseJson.getString("id"))
    put("rawId", responseJson.getString("rawId"))
    put("type", "public-key")
    put("response", JSObject().apply {
        val resp = responseJson.getJSONObject("response")
        put("clientDataJSON", resp.getString("clientDataJSON"))
        put("authenticatorData", resp.getString("authenticatorData"))
        put("signature", resp.getString("signature"))
        resp.optString("userHandle")?.takeIf { it.isNotEmpty() }?.let {
            put("userHandle", it)
        }
    })
}
call.resolve(resultObj)
```

**Code Location (line ~117-170):** Replace the TODO block

**Edge Cases:**
- No credentials for RP
- AllowCredentials filtering returns empty
- Timeout during biometric

**Dependencies:** None (foundational task)

---

### Android-3: Improve `isSupported()` — Check Play Services
**Difficulty:** 🟡 Medium | **Assignee:** Kimi | **Priority:** P1

**File:** `android/src/main/kotlin/io/beginwallet/passkeys/PasskeysPlugin.kt`

**Current Code:** Only checks API level

**What Needs Implementing:**
```kotlin
@PluginMethod
fun isSupported(call: PluginCall) {
    val hasPlayServices = try {
        val availability = GoogleApiAvailability.getInstance()
        val resultCode = availability.isGooglePlayServicesAvailable(context)
        resultCode == ConnectionResult.SUCCESS
    } catch (e: Exception) {
        false
    }
    
    val apiLevelOk = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
    val supported = apiLevelOk && hasPlayServices
    
    val result = JSObject().apply {
        put("supported", supported)
        put("details", JSObject().apply {
            put("osVersion", Build.VERSION.RELEASE)
            put("apiLevel", Build.VERSION.SDK_INT)
            put("platformAuthenticatorAvailable", supported)
            put("hasPlayServices", hasPlayServices)
        })
    }
    call.resolve(result)
}
```

**Additional Import:**
```kotlin
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
```

**Dependencies:** None

---

### Android-4: Add Missing Exception Types
**Difficulty:** 🟢 Easy | **Assignee:** Kimi | **Priority:** P1

**File:** `android/src/main/kotlin/io/beginwallet/passkeys/PasskeysPlugin.kt`

**Current Error Mapping:** Limited exception types

**What Needs Adding:**
```kotlin
private fun mapCreateError(e: CreateCredentialException): Pair<String, String> {
    return when (e) {
        is CreateCredentialCancellationException -> "cancelled" to "User cancelled the operation"
        is CreateCredentialInterruptedException -> "cancelled" to "Operation was interrupted"
        is CreateCredentialProviderConfigurationException -> "notSupported" to "Credential provider not configured"
        is CreateCredentialUnknownException -> "unknownError" to (e.message ?: "Unknown error")
        is CreateCredentialCustomException -> "unknownError" to (e.message ?: "Custom error")
        else -> "unknownError" to (e.message ?: "Unknown error during credential creation")
    }
}

private fun mapGetError(e: GetCredentialException): Pair<String, String> {
    return when (e) {
        is GetCredentialCancellationException -> "cancelled" to "User cancelled the operation"
        is NoCredentialException -> "noCredentials" to "No matching credentials found"
        is GetCredentialInterruptedException -> "cancelled" to "Operation was interrupted"
        is GetCredentialProviderConfigurationException -> "notSupported" to "Credential provider not configured"
        is GetCredentialUnknownException -> "unknownError" to (e.message ?: "Unknown error")
        is GetCredentialCustomException -> "unknownError" to (e.message ?: "Custom error")
        else -> "unknownError" to (e.message ?: "Unknown error during credential retrieval")
    }
}
```

**Dependencies:** Android-1, Android-2

---

### Android-5: Add Domain Validation Error
**Difficulty:** 🟢 Easy | **Assignee:** Kimi | **Priority:** P2

**What Needs Implementing:**
Catch and map `SecurityException` for Digital Asset Links failures:

```kotlin
} catch (e: SecurityException) {
    call.reject("RP ID doesn't match Digital Asset Links configuration", "invalidDomain")
}
```

**Dependencies:** Android-1, Android-2

---

## Shared/Documentation Tasks

### Shared-1: Update README with Setup Instructions
**Difficulty:** 🟡 Medium | **Assignee:** Kimi | **Priority:** P1

**What Needs Documenting:**
1. iOS Associated Domains setup (`webcredentials:domain.com`)
2. `apple-app-site-association` file format
3. Android Digital Asset Links setup
4. `assetlinks.json` file format
5. Testing on real devices (simulators don't support passkeys)

**Dependencies:** All implementation tasks (for accurate docs)

---

### Shared-2: Add Example Usage
**Difficulty:** 🟢 Easy | **Assignee:** Kimi | **Priority:** P2

**File:** `README.md` or new `EXAMPLE.md`

```typescript
import { Passkeys } from 'capacitor-passkeys';

// Check support
const { supported } = await Passkeys.isSupported();

// Register
const credential = await Passkeys.create({
  challenge: serverChallenge,
  rp: { id: 'example.com', name: 'Example App' },
  user: { id: base64UserId, name: 'user@example.com', displayName: 'User' }
});

// Authenticate
const assertion = await Passkeys.get({
  challenge: serverChallenge,
  rpId: 'example.com'
});
```

**Dependencies:** None

---

### Shared-3: Add TypeScript Tests
**Difficulty:** 🟡 Medium | **Assignee:** Kimi | **Priority:** P2

**What Needs Implementing:**
- Unit tests for base64url encoding/decoding (in web.ts)
- Type tests for interface compatibility
- Mock tests for error handling

**Dependencies:** None

---

## Implementation Order

### Phase 1: Core Implementation (Opus)
1. **iOS-1** — Implement `create()` 
2. **iOS-2** — Implement `get()`
3. **iOS-3** — Handle registration delegate
4. **iOS-4** — Handle authentication delegate
5. **Android-1** — Implement `create()`
6. **Android-2** — Implement `get()`

### Phase 2: Polish (Kimi)
7. **Android-3** — Improve isSupported with Play Services check
8. **Android-4** — Add missing exception types
9. **iOS-5** — Verify presentation context
10. **Android-5** — Add domain validation error

### Phase 3: Documentation (Kimi)
11. **Shared-1** — README with setup instructions
12. **Shared-2** — Add example usage
13. **iOS-6** — Document timeout behavior
14. **Shared-3** — Add TypeScript tests

---

## Task Summary Table

| ID | Task | Platform | Difficulty | Assignee | Depends On |
|----|------|----------|------------|----------|------------|
| iOS-1 | Implement create() | iOS | 🔴 Hard | Opus | — |
| iOS-2 | Implement get() | iOS | 🔴 Hard | Opus | — |
| iOS-3 | Handle registration delegate | iOS | 🟡 Medium | Opus | iOS-1 |
| iOS-4 | Handle authentication delegate | iOS | 🟡 Medium | Opus | iOS-2 |
| iOS-5 | Verify presentation context | iOS | 🟢 Easy | Kimi | iOS-1/2 |
| iOS-6 | Add timeout support | iOS | 🟢 Easy | Kimi | iOS-1/2 |
| Android-1 | Implement create() | Android | 🔴 Hard | Opus | — |
| Android-2 | Implement get() | Android | 🔴 Hard | Opus | — |
| Android-3 | Check Play Services | Android | 🟡 Medium | Kimi | — |
| Android-4 | Add exception types | Android | 🟢 Easy | Kimi | Android-1/2 |
| Android-5 | Domain validation error | Android | 🟢 Easy | Kimi | Android-1/2 |
| Shared-1 | README setup docs | Shared | 🟡 Medium | Kimi | All impl |
| Shared-2 | Example usage | Shared | 🟢 Easy | Kimi | — |
| Shared-3 | TypeScript tests | Shared | 🟡 Medium | Kimi | — |

---

## Notes for Implementers

### For Opus (Hard Tasks)
- The web.ts implementation is a **complete reference** — follow the same patterns
- iOS uses delegates (async callback pattern), Android uses coroutines (suspend)
- Both platforms return JSON-like structures that map to the TypeScript interfaces
- Test on **real devices only** — simulators don't support passkeys

### For Kimi (Medium/Easy Tasks)
- Focus on edge cases, error handling, and documentation
- Android-3 requires adding Google Play Services dependency check
- Documentation should include both code snippets and config file examples
- Tests can mock the native layer and test the web implementation directly

### Testing Notes
- iOS: Requires iOS 16+ device with Face ID/Touch ID
- Android: Requires API 28+ device with fingerprint and Play Services
- Both: Requires associated domains/asset links configured
