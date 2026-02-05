package io.beginwallet.passkeys

import android.os.Build
import android.util.Base64
import androidx.credentials.CredentialManager
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.CreateCredentialCustomException
import androidx.credentials.exceptions.CreateCredentialException
import androidx.credentials.exceptions.CreateCredentialInterruptedException
import androidx.credentials.exceptions.CreateCredentialProviderConfigurationException
import androidx.credentials.exceptions.CreateCredentialUnknownException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialCustomException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialInterruptedException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnknownException
import androidx.credentials.exceptions.NoCredentialException
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
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
     *
     * Passkeys require:
     * - Android 9+ (API 28)
     * - Google Play Services available and up-to-date
     */
    @PluginMethod
    fun isSupported(call: PluginCall) {
        val apiLevelOk = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P

        // Check Google Play Services availability
        val hasPlayServices = try {
            val availability = GoogleApiAvailability.getInstance()
            val resultCode = availability.isGooglePlayServicesAvailable(context)
            resultCode == ConnectionResult.SUCCESS
        } catch (e: Exception) {
            false
        }

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

    /**
     * Create a new passkey (registration).
     */
    @PluginMethod
    fun create(call: PluginCall) {
        // 1. Extract and validate required parameters
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

        // 2. Build pubKeyCredParams array (default to ES256 + RS256)
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
            put(JSONObject().put("type", "public-key").put("alg", -7))   // ES256
            put(JSONObject().put("type", "public-key").put("alg", -257)) // RS256
        }

        // 3. Build authenticatorSelection object
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

        // 4. Build WebAuthn-compatible JSON request
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

        // 5. Create the Credential Manager request
        val request = CreatePublicKeyCredentialRequest(
            requestJson = requestJson.toString()
        )

        // 6. Execute the request asynchronously
        val currentActivity = activity
        if (currentActivity == null) {
            call.reject("Activity not available", "unknownError")
            return
        }

        scope.launch {
            try {
                val result = credentialManager.createCredential(
                    context = currentActivity,
                    request = request
                )

                // 7. Parse the response
                if (result is CreatePublicKeyCredentialResponse) {
                    val responseJson = JSONObject(result.registrationResponseJson)

                    // 8. Build result matching TypeScript interface
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
                } else {
                    call.reject("Unexpected response type", "unknownError")
                }

            } catch (e: CreateCredentialException) {
                val (code, message) = mapCreateError(e)
                call.reject(message, code)
            } catch (e: SecurityException) {
                call.reject("RP ID doesn't match Digital Asset Links configuration", "invalidDomain")
            } catch (e: Exception) {
                call.reject(e.message ?: "Unknown error during credential creation", "unknownError")
            }
        }
    }

    /**
     * Authenticate with an existing passkey.
     */
    @PluginMethod
    fun get(call: PluginCall) {
        // 1. Extract and validate required parameters
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

        // 2. Build WebAuthn-compatible JSON request
        val requestJson = JSONObject().apply {
            put("challenge", challenge)
            put("rpId", rpId)
            put("userVerification", call.getString("userVerification") ?: "required")

            // Handle optional allowCredentials array
            call.getArray("allowCredentials")?.let { arr ->
                val credArray = JSONArray()
                for (i in 0 until arr.length()) {
                    val cred = arr.getJSONObject(i)
                    credArray.put(JSONObject().apply {
                        put("type", cred.getString("type"))
                        put("id", cred.getString("id"))
                        // Handle optional transports array
                        if (cred.has("transports")) {
                            put("transports", cred.getJSONArray("transports"))
                        }
                    })
                }
                put("allowCredentials", credArray)
            }

            call.getInt("timeout")?.let { put("timeout", it) }
        }

        // 3. Create the Credential Manager request
        val getRequest = GetCredentialRequest(
            credentialOptions = listOf(
                GetPublicKeyCredentialOption(requestJson.toString())
            )
        )

        // 4. Execute the request asynchronously
        val currentActivity = activity
        if (currentActivity == null) {
            call.reject("Activity not available", "unknownError")
            return
        }

        scope.launch {
            try {
                val result = credentialManager.getCredential(
                    context = currentActivity,
                    request = getRequest
                )

                // 5. Parse the response - credential is a PublicKeyCredential
                val credential = result.credential
                if (credential is PublicKeyCredential) {
                    val responseJson = JSONObject(credential.authenticationResponseJson)

                    // 6. Build result matching TypeScript interface
                    val resultObj = JSObject().apply {
                        put("id", responseJson.getString("id"))
                        put("rawId", responseJson.getString("rawId"))
                        put("type", "public-key")
                        put("response", JSObject().apply {
                            val resp = responseJson.getJSONObject("response")
                            put("clientDataJSON", resp.getString("clientDataJSON"))
                            put("authenticatorData", resp.getString("authenticatorData"))
                            put("signature", resp.getString("signature"))
                            // userHandle is optional - only present for discoverable credentials
                            if (resp.has("userHandle") && !resp.isNull("userHandle")) {
                                val userHandle = resp.getString("userHandle")
                                if (userHandle.isNotEmpty()) {
                                    put("userHandle", userHandle)
                                }
                            }
                        })
                    }
                    call.resolve(resultObj)
                } else {
                    call.reject("Unexpected credential type", "unknownError")
                }

            } catch (e: GetCredentialException) {
                val (code, message) = mapGetError(e)
                call.reject(message, code)
            } catch (e: SecurityException) {
                call.reject("RP ID doesn't match Digital Asset Links configuration", "invalidDomain")
            } catch (e: Exception) {
                call.reject(e.message ?: "Unknown error during credential retrieval", "unknownError")
            }
        }
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
     * Map Credential Manager create exceptions to plugin error codes.
     */
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

    /**
     * Map Credential Manager get exceptions to plugin error codes.
     */
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

    /**
     * Map SecurityException (Digital Asset Links failures) to plugin error code.
     */
    private fun mapSecurityError(e: SecurityException): Pair<String, String> {
        return "invalidDomain" to "RP ID doesn't match Digital Asset Links configuration: ${e.message}"
    }
}
