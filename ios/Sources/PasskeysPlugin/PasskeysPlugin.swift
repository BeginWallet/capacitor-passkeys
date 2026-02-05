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
    @objc func create(_ call: CAPPluginCall) {
        // TODO: Implement full passkey creation
        //
        // Steps:
        // 1. Extract options from call:
        //    - challenge (base64url string -> Data)
        //    - rp.id (String) - relying party identifier
        //    - user.id (base64url string -> Data)
        //    - user.name (String)
        //
        // 2. Create the credential provider:
        //    let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
        //        relyingPartyIdentifier: rpId
        //    )
        //
        // 3. Create the registration request:
        //    let request = provider.createCredentialRegistrationRequest(
        //        challenge: challengeData,
        //        name: userName,
        //        userID: userIdData
        //    )
        //
        // 4. Configure authenticator selection (if provided):
        //    - authenticatorAttachment -> request.attestationPreference
        //    - userVerification -> request.userVerificationPreference
        //
        // 5. Create and present the authorization controller:
        //    let controller = ASAuthorizationController(authorizationRequests: [request])
        //    controller.delegate = self
        //    controller.presentationContextProvider = self
        //    controller.performRequests()
        //
        // 6. Handle the result in delegate methods (see below)

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

        guard let challengeData = base64UrlDecode(challengeB64),
              let userIdData = base64UrlDecode(userIdB64) else {
            call.reject("Invalid base64url encoding", "invalidRequest")
            return
        }

        // TODO: Complete implementation
        // For now, return a placeholder error
        call.reject(
            "Passkey creation not yet implemented. See TODOs in PasskeysPlugin.swift",
            "notSupported",
            nil,
            [
                "rpId": rpId,
                "userName": userName,
                "challengeLength": challengeData.count,
                "userIdLength": userIdData.count
            ]
        )
    }

    /// Authenticate with an existing passkey
    @objc func get(_ call: CAPPluginCall) {
        // TODO: Implement full passkey authentication
        //
        // Steps:
        // 1. Extract options from call:
        //    - challenge (base64url string -> Data)
        //    - rpId (String)
        //    - allowCredentials (optional array of credential descriptors)
        //    - userVerification (optional)
        //
        // 2. Create the credential provider:
        //    let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
        //        relyingPartyIdentifier: rpId
        //    )
        //
        // 3. Create the assertion request:
        //    let request = provider.createCredentialAssertionRequest(
        //        challenge: challengeData
        //    )
        //
        // 4. If allowCredentials provided, set allowed credential IDs:
        //    request.allowedCredentials = allowCredentials.map { descriptor in
        //        ASAuthorizationPlatformPublicKeyCredentialDescriptor(
        //            credentialID: descriptor.id
        //        )
        //    }
        //
        // 5. Create and present the authorization controller:
        //    let controller = ASAuthorizationController(authorizationRequests: [request])
        //    controller.delegate = self
        //    controller.presentationContextProvider = self
        //    controller.performRequests()
        //
        // 6. Handle the result in delegate methods

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

        // TODO: Complete implementation
        // For now, return a placeholder error
        call.reject(
            "Passkey authentication not yet implemented. See TODOs in PasskeysPlugin.swift",
            "notSupported",
            nil,
            [
                "rpId": rpId,
                "challengeLength": challengeData.count
            ]
        )
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
        // TODO: Handle successful authorization
        //
        // For registration (create):
        // if let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration {
        //     let result: [String: Any] = [
        //         "id": base64UrlEncode(credential.credentialID),
        //         "rawId": base64UrlEncode(credential.credentialID),
        //         "type": "public-key",
        //         "response": [
        //             "clientDataJSON": base64UrlEncode(credential.rawClientDataJSON),
        //             "attestationObject": base64UrlEncode(credential.rawAttestationObject!)
        //         ]
        //     ]
        //     currentCall?.resolve(result)
        // }
        //
        // For authentication (get):
        // if let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion {
        //     var response: [String: Any] = [
        //         "clientDataJSON": base64UrlEncode(credential.rawClientDataJSON),
        //         "authenticatorData": base64UrlEncode(credential.rawAuthenticatorData),
        //         "signature": base64UrlEncode(credential.signature)
        //     ]
        //     if let userHandle = credential.userID {
        //         response["userHandle"] = base64UrlEncode(userHandle)
        //     }
        //     let result: [String: Any] = [
        //         "id": base64UrlEncode(credential.credentialID),
        //         "rawId": base64UrlEncode(credential.credentialID),
        //         "type": "public-key",
        //         "response": response
        //     ]
        //     currentCall?.resolve(result)
        // }

        currentCall?.reject("Delegate handling not yet implemented", "notSupported")
        currentCall = nil
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        let (code, message) = mapError(error)
        currentCall?.reject(message, code)
        currentCall = nil
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding

@available(iOS 16.0, *)
extension PasskeysPlugin: ASAuthorizationControllerPresentationContextProviding {

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        // Return the main window for presenting the authorization UI
        // TODO: Ensure this works correctly in all scenarios
        return self.bridge?.webView?.window ?? UIWindow()
    }
}
