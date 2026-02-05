import Foundation
import Capacitor
import AuthenticationServices

/// Capacitor plugin for native passkey (WebAuthn) authentication on iOS
@available(iOS 16.0, *)
@objc(PasskeysPlugin)
public class PasskeysPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PasskeysPlugin"
    public let jsName = "Passkeys"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "create", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise)
    ]

    /// Current authorization controller (kept for delegate callbacks)
    private var authController: ASAuthorizationController?
    /// Current call to resolve/reject
    private var currentCall: CAPPluginCall?

    // MARK: - Plugin Methods

    /// Check if passkeys are supported on this device
    @objc func isSupported(_ call: CAPPluginCall) {
        // Passkeys require iOS 16.0+
        if #available(iOS 16.0, *) {
            call.resolve([
                "supported": true,
                "details": [
                    "osVersion": UIDevice.current.systemVersion,
                    "platformAuthenticatorAvailable": true
                ]
            ])
        } else {
            call.resolve([
                "supported": false,
                "details": [
                    "osVersion": UIDevice.current.systemVersion,
                    "platformAuthenticatorAvailable": false
                ]
            ])
        }
    }

    /// Create a new passkey (registration)
    ///
    /// Note on timeouts: iOS's ASAuthorizationController does not expose a direct timeout
    /// configuration. The system manages timeouts internally based on user interaction.
    /// The `timeout` parameter from options is accepted for API compatibility but
    /// is not enforced on iOS. If precise timeout control is needed, implement a
    /// client-side timer using DispatchQueue.main.asyncAfter and cancel the
    /// authorization flow manually.
    @objc func create(_ call: CAPPluginCall) {
        // Extract and validate required parameters
        guard let challengeB64 = call.getString("challenge") else {
            call.reject("Missing required parameter: challenge", "invalidRequest")
            return
        }

        guard let rp = call.getObject("rp"),
              let rpId = rp["id"] as? String else {
            call.reject("Missing required parameter: rp.id", "invalidRequest")
            return
        }

        guard let user = call.getObject("user"),
              let userIdB64 = user["id"] as? String,
              let userName = user["name"] as? String else {
            call.reject("Missing required parameters: user.id, user.name", "invalidRequest")
            return
        }

        guard let challengeData = base64UrlDecode(challengeB64) else {
            call.reject("Invalid base64url encoding for challenge", "invalidRequest")
            return
        }

        guard let userIdData = base64UrlDecode(userIdB64) else {
            call.reject("Invalid base64url encoding for user.id", "invalidRequest")
            return
        }

        // Create the credential provider
        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
            relyingPartyIdentifier: rpId
        )

        // Create the registration request
        let request = provider.createCredentialRegistrationRequest(
            challenge: challengeData,
            name: userName,
            userID: userIdData
        )

        // Handle optional authenticatorSelection preferences
        if let authenticatorSelection = call.getObject("authenticatorSelection") {
            // Map userVerification preference
            if let userVerification = authenticatorSelection["userVerification"] as? String {
                switch userVerification {
                case "required":
                    request.userVerificationPreference = .required
                case "preferred":
                    request.userVerificationPreference = .preferred
                case "discouraged":
                    request.userVerificationPreference = .discouraged
                default:
                    request.userVerificationPreference = .required
                }
            }
        }

        // Store the call for async delegate callback
        self.currentCall = call

        // Create and configure the authorization controller
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        self.authController = controller

        // Perform the request on main thread
        DispatchQueue.main.async {
            controller.performRequests()
        }
    }

    /// Authenticate with an existing passkey
    @objc func get(_ call: CAPPluginCall) {
        // Extract and validate required parameters
        guard let challengeB64 = call.getString("challenge") else {
            call.reject("Missing required parameter: challenge", "invalidRequest")
            return
        }

        guard let rpId = call.getString("rpId") else {
            call.reject("Missing required parameter: rpId", "invalidRequest")
            return
        }

        guard let challengeData = base64UrlDecode(challengeB64) else {
            call.reject("Invalid base64url encoding for challenge", "invalidRequest")
            return
        }

        // Create the credential provider
        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
            relyingPartyIdentifier: rpId
        )

        // Create the assertion request
        let request = provider.createCredentialAssertionRequest(challenge: challengeData)

        // Handle optional allowCredentials array
        if let allowCredentials = call.getArray("allowCredentials") as? [[String: Any]] {
            let descriptors: [ASAuthorizationPlatformPublicKeyCredentialDescriptor] = allowCredentials.compactMap { item in
                guard let idB64 = item["id"] as? String,
                      let idData = base64UrlDecode(idB64) else {
                    return nil
                }
                return ASAuthorizationPlatformPublicKeyCredentialDescriptor(credentialID: idData)
            }
            if !descriptors.isEmpty {
                request.allowedCredentials = descriptors
            }
        }

        // Handle optional userVerification preference
        if let userVerification = call.getString("userVerification") {
            switch userVerification {
            case "required":
                request.userVerificationPreference = .required
            case "preferred":
                request.userVerificationPreference = .preferred
            case "discouraged":
                request.userVerificationPreference = .discouraged
            default:
                request.userVerificationPreference = .required
            }
        }

        // Store the call for async delegate callback
        self.currentCall = call

        // Create and configure the authorization controller
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        self.authController = controller

        // Perform the request on main thread
        DispatchQueue.main.async {
            controller.performRequests()
        }
    }

    // MARK: - Helper Methods

    /// Decode base64url string to Data
    private func base64UrlDecode(_ base64url: String) -> Data? {
        // Convert base64url to standard base64
        var base64 = base64url
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        // Pad with '=' if necessary
        let remainder = base64.count % 4
        if remainder > 0 {
            base64 += String(repeating: "=", count: 4 - remainder)
        }

        return Data(base64Encoded: base64)
    }

    /// Encode Data to base64url string
    private func base64UrlEncode(_ data: Data) -> String {
        return data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    /// Map ASAuthorizationError to plugin error code
    private func mapError(_ error: Error) -> (code: String, message: String) {
        if let authError = error as? ASAuthorizationError {
            switch authError.code {
            case .canceled:
                return ("cancelled", "User cancelled the operation")
            case .invalidResponse:
                return ("invalidRequest", "Invalid response from authenticator")
            case .notHandled:
                return ("noCredentials", "No credentials available")
            case .failed:
                return ("securityError", "Authorization failed")
            case .unknown:
                return ("unknownError", authError.localizedDescription)
            @unknown default:
                return ("unknownError", authError.localizedDescription)
            }
        }
        return ("unknownError", error.localizedDescription)
    }
}

// MARK: - ASAuthorizationControllerDelegate

@available(iOS 16.0, *)
extension PasskeysPlugin: ASAuthorizationControllerDelegate {

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        defer {
            currentCall = nil
            authController = nil
        }

        // Handle passkey registration (create)
        if let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration {
            guard let attestationObject = credential.rawAttestationObject else {
                currentCall?.reject("Missing attestation object", "unknownError")
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
            return
        }

        // Handle passkey authentication (get)
        if let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion {
            var response: [String: Any] = [
                "clientDataJSON": base64UrlEncode(credential.rawClientDataJSON),
                "authenticatorData": base64UrlEncode(credential.rawAuthenticatorData),
                "signature": base64UrlEncode(credential.signature)
            ]

            // Include userHandle if present
            if let userHandle = credential.userID, !userHandle.isEmpty {
                response["userHandle"] = base64UrlEncode(userHandle)
            }

            let result: [String: Any] = [
                "id": base64UrlEncode(credential.credentialID),
                "rawId": base64UrlEncode(credential.credentialID),
                "type": "public-key",
                "response": response
            ]
            currentCall?.resolve(result)
            return
        }

        // Unknown credential type
        currentCall?.reject("Unsupported credential type", "unknownError")
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        let (code, message) = mapError(error)
        currentCall?.reject(message, code)
        currentCall = nil
        authController = nil
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding

@available(iOS 16.0, *)
extension PasskeysPlugin: ASAuthorizationControllerPresentationContextProviding {

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        // Return the main window for presenting the authorization UI
        // Use the webView's window if available, fall back to key window
        if let window = self.bridge?.webView?.window {
            return window
        }
        
        // Fallback: get the key window from the scene
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let keyWindow = windowScene.windows.first(where: { $0.isKeyWindow }) {
            return keyWindow
        }
        
        // Last resort fallback
        return UIWindow()
    }
}
