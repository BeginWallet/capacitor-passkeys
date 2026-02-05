package io.beginwallet.passkeys

import android.os.Build
import android.util.Base64
import androidx.credentials.CredentialManager
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.CreateCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/**
 * Capacitor plugin for native passkey (WebAuthn) authentication on Android.
 *
 * Uses Android's Credential Manager API (Jetpack).
 * Requires:
 * - Android 9+ (API 28)
 * - Google Play Services
 */
@CapacitorPlugin(name = "Passkeys")
class PasskeysPlugin : Plugin() {

    private lateinit var credentialManager: CredentialManager
    private val scope = CoroutineScope(Dispatchers.Main)

    override fun load() {
        super.load()
        credentialManager = CredentialManager.create(context)
    }

    /**
     * Check if passkeys are supported on this device.
     */
    @PluginMethod
    fun isSupported(call: PluginCall) {
        // Credential Manager requires Android 9+ (API 28)
        // and Google Play Services
        val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P

        val result = JSObject().apply {
            put("supported", supported)
            put("details", JSObject().apply {
                put("osVersion", Build.VERSION.RELEASE)
                put("apiLevel", Build.VERSION.SDK_INT)
                put("platformAuthenticatorAvailable", supported)
            })
        }
        call.resolve(result)
    }

    /**
     * Create a new passkey (registration).
     */
    @PluginMethod
    fun create(call: PluginCall) {
        // TODO: Implement full passkey creation
        //
        // Steps:
        // 1. Extract options from call and build request JSON:
        //    - challenge (base64url string)
        //    - rp.id, rp.name
        //    - user.id, user.name, user.displayName
        //    - pubKeyCredParams (optional, default ES256 + RS256)
        //    - authenticatorSelection (optional)
        //    - attestation (optional)
        //
        // 2. Build the WebAuthn-compatible JSON request:
        //    val requestJson = JSONObject().apply {
        //        put("challenge", challenge)
        //        put("rp", JSONObject().apply {
        //            put("id", rpId)
        //            put("name", rpName)
        //        })
        //        put("user", JSONObject().apply {
        //            put("id", userId)
        //            put("name", userName)
        //            put("displayName", displayName)
        //        })
        //        put("pubKeyCredParams", JSONArray().apply {
        //            put(JSONObject().put("type", "public-key").put("alg", -7))
        //            put(JSONObject().put("type", "public-key").put("alg", -257))
        //        })
        //        put("authenticatorSelection", JSONObject().apply {
        //            put("authenticatorAttachment", "platform")
        //            put("residentKey", "required")
        //            put("userVerification", "required")
        //        })
        //    }
        //
        // 3. Create the request:
        //    val request = CreatePublicKeyCredentialRequest(
        //        requestJson = requestJson.toString()
        //    )
        //
        // 4. Call Credential Manager:
        //    scope.launch {
        //        try {
        //            val result = credentialManager.createCredential(activity, request)
        //            // Parse result.data and return to JS
        //        } catch (e: CreateCredentialException) {
        //            // Handle errors
        //        }
        //    }
        //
        // 5. Parse the response and resolve with CreatePasskeyResult

        val challenge = call.getString("challenge")
        if (challenge == null) {
            call.reject("Missing required parameter: challenge", "invalidRequest")
            return
        }

        val rp = call.getObject("rp")
        val rpId = rp?.getString("id")
        val rpName = rp?.getString("name")
        if (rpId == null || rpName == null) {
            call.reject("Missing required parameters: rp.id, rp.name", "invalidRequest")
            return
        }

        val user = call.getObject("user")
        val userId = user?.getString("id")
        val userName = user?.getString("name")
        val displayName = user?.getString("displayName")
        if (userId == null || userName == null || displayName == null) {
            call.reject("Missing required parameters: user.id, user.name, user.displayName", "invalidRequest")
            return
        }

        // TODO: Complete implementation
        // For now, return a placeholder error with parsed options
        val errorData = JSObject().apply {
            put("rpId", rpId)
            put("userName", userName)
            put("displayName", displayName)
        }
        call.reject(
            "Passkey creation not yet implemented. See TODOs in PasskeysPlugin.kt",
            "notSupported",
            null,
            errorData
        )
    }

    /**
     * Authenticate with an existing passkey.
     */
    @PluginMethod
    fun get(call: PluginCall) {
        // TODO: Implement full passkey authentication
        //
        // Steps:
        // 1. Extract options from call:
        //    - challenge (base64url string)
        //    - rpId
        //    - allowCredentials (optional)
        //    - userVerification (optional)
        //
        // 2. Build the WebAuthn-compatible JSON request:
        //    val requestJson = JSONObject().apply {
        //        put("challenge", challenge)
        //        put("rpId", rpId)
        //        put("userVerification", userVerification ?: "required")
        //        if (allowCredentials != null) {
        //            put("allowCredentials", allowCredentialsArray)
        //        }
        //    }
        //
        // 3. Create the request:
        //    val getRequest = GetCredentialRequest(
        //        credentialOptions = listOf(
        //            GetPublicKeyCredentialOption(requestJson.toString())
        //        )
        //    )
        //
        // 4. Call Credential Manager:
        //    scope.launch {
        //        try {
        //            val result = credentialManager.getCredential(activity, getRequest)
        //            // Parse result and return to JS
        //        } catch (e: GetCredentialException) {
        //            // Handle errors
        //        }
        //    }
        //
        // 5. Parse the response and resolve with GetPasskeyResult

        val challenge = call.getString("challenge")
        if (challenge == null) {
            call.reject("Missing required parameter: challenge", "invalidRequest")
            return
        }

        val rpId = call.getString("rpId")
        if (rpId == null) {
            call.reject("Missing required parameter: rpId", "invalidRequest")
            return
        }

        // TODO: Complete implementation
        val errorData = JSObject().apply {
            put("rpId", rpId)
        }
        call.reject(
            "Passkey authentication not yet implemented. See TODOs in PasskeysPlugin.kt",
            "notSupported",
            null,
            errorData
        )
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Helper Methods
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Decode base64url string to ByteArray.
     */
    private fun base64UrlDecode(base64url: String): ByteArray {
        // Convert base64url to standard base64
        val base64 = base64url
            .replace('-', '+')
            .replace('_', '/')

        // Add padding if necessary
        val padded = when (base64.length % 4) {
            2 -> "$base64=="
            3 -> "$base64="
            else -> base64
        }

        return Base64.decode(padded, Base64.DEFAULT)
    }

    /**
     * Encode ByteArray to base64url string.
     */
    private fun base64UrlEncode(data: ByteArray): String {
        return Base64.encodeToString(data, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    }

    /**
     * Map Credential Manager exceptions to plugin error codes.
     */
    private fun mapCreateError(e: CreateCredentialException): Pair<String, String> {
        return when (e) {
            is CreateCredentialCancellationException -> "cancelled" to "User cancelled the operation"
            else -> "unknownError" to (e.message ?: "Unknown error during credential creation")
        }
    }

    /**
     * Map Credential Manager exceptions to plugin error codes.
     */
    private fun mapGetError(e: GetCredentialException): Pair<String, String> {
        return when (e) {
            is GetCredentialCancellationException -> "cancelled" to "User cancelled the operation"
            is NoCredentialException -> "noCredentials" to "No matching credentials found"
            else -> "unknownError" to (e.message ?: "Unknown error during credential retrieval")
        }
    }
}
