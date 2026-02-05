# capacitor-passkeys

Native passkey (WebAuthn/FIDO2) authentication for Capacitor apps.

Provides a unified API for passkey creation and authentication across iOS, Android, and web, enabling passwordless authentication with biometrics.

## Platform Requirements

| Platform | Minimum Version | Notes |
|----------|-----------------|-------|
| iOS | 16.0+ | Uses AuthenticationServices framework |
| Android | API 28+ (Android 9) | Uses Credential Manager API, requires Google Play Services |
| Web | Modern browsers | Uses WebAuthn API |

## Installation

```bash
npm install capacitor-passkeys
npx cap sync
```

## Platform Setup

Both iOS and Android require domain verification to ensure your app is authorized to create passkeys for your domain. This is a security requirement of the WebAuthn specification.

### iOS Setup

#### 1. Enable Associated Domains Capability

1. Open your project in Xcode
2. Select your app target → **Signing & Capabilities** tab
3. Click **+ Capability** → search for **Associated Domains**
4. Add: `webcredentials:yourdomain.com`

> **Note:** Replace `yourdomain.com` with your actual domain. Do not include `https://` or any path.

#### 2. Host the Apple App Site Association File

Create a file named `apple-app-site-association` (no extension) and host it at:
```
https://yourdomain.com/.well-known/apple-app-site-association
```

**File contents:**
```json
{
  "webcredentials": {
    "apps": [
      "TEAMID.com.yourcompany.yourapp"
    ]
  }
}
```

**Where:**
- `TEAMID` is your 10-character Apple Team ID (find it at [developer.apple.com/account](https://developer.apple.com/account) → Membership)
- `com.yourcompany.yourapp` is your app's bundle identifier

**Hosting requirements:**
- Must be served over HTTPS with a valid TLS certificate
- Content-Type must be `application/json`
- No redirects allowed
- File must be accessible without authentication

**Example for multiple apps:**
```json
{
  "webcredentials": {
    "apps": [
      "ABC123DEF4.com.example.myapp",
      "ABC123DEF4.com.example.myapp.dev"
    ]
  }
}
```

#### 3. Verify Configuration

Test your setup with Apple's validator:
```bash
curl -I "https://yourdomain.com/.well-known/apple-app-site-association"
```

Or use Apple's [Associated Domains validator](https://search.developer.apple.com/appsearch-validation-tool/).

---

### Android Setup

#### 1. Host the Digital Asset Links File

Create a file named `assetlinks.json` and host it at:
```
https://yourdomain.com/.well-known/assetlinks.json
```

**File contents:**
```json
[
  {
    "relation": [
      "delegate_permission/common.handle_all_urls",
      "delegate_permission/common.get_login_creds"
    ],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yourcompany.yourapp",
      "sha256_cert_fingerprints": [
        "AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90"
      ]
    }
  }
]
```

**Where:**
- `com.yourcompany.yourapp` is your app's package name (from `AndroidManifest.xml`)
- `sha256_cert_fingerprints` is the SHA-256 fingerprint of your signing certificate

#### 2. Get Your SHA-256 Fingerprint

**For debug builds:**
```bash
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey \
  -storepass android \
  -keypass android | grep SHA256
```

**For release builds:**
```bash
keytool -list -v \
  -keystore /path/to/your/release.keystore \
  -alias your-key-alias | grep SHA256
```

**For Google Play App Signing:**
1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app → **Setup** → **App signing**
3. Copy the SHA-256 fingerprint under "App signing key certificate"

> **Important:** If you use Google Play App Signing, use the fingerprint from Play Console, not your upload key.

#### 3. Multiple Environments

For development and production, include all fingerprints:

```json
[
  {
    "relation": [
      "delegate_permission/common.handle_all_urls",
      "delegate_permission/common.get_login_creds"
    ],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yourcompany.yourapp",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:...:debug-fingerprint",
        "DD:EE:FF:...:release-fingerprint",
        "11:22:33:...:play-signing-fingerprint"
      ]
    }
  }
]
```

#### 4. Verify Configuration

Test with Google's verification tool:
```bash
curl -s "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://yourdomain.com&relation=delegate_permission/common.get_login_creds"
```

Or use the [Asset Links Tool](https://developers.google.com/digital-asset-links/tools/generator).

---

### Troubleshooting Setup

| Issue | Platform | Solution |
|-------|----------|----------|
| "Invalid domain" error | Both | Verify your AASA/assetlinks.json is accessible and correctly formatted |
| Associated Domains not working | iOS | Ensure capability is enabled and AASA file has no redirects |
| No credentials found | Android | Check that SHA-256 fingerprint matches your signing certificate |
| Works in debug, fails in release | Android | Add release/Play signing fingerprint to assetlinks.json |

---

## Usage

### Import the Plugin

```typescript
import { Passkeys } from 'capacitor-passkeys';
```

### Check Support

```typescript
const { supported, details } = await Passkeys.isSupported();

if (!supported) {
  console.log('Passkeys not supported:', details);
  // Fall back to password authentication
}

// On Android, details includes:
// - apiLevel: Android API level
// - hasPlayServices: Google Play Services availability

// On iOS, details includes:
// - osVersion: iOS version
// - platformAuthenticatorAvailable: true if Face ID/Touch ID available
```

### Create a Passkey (Registration)

```typescript
import { Passkeys, PasskeyErrorCode } from 'capacitor-passkeys';

async function registerPasskey(user: { id: string; email: string; name: string }) {
  try {
    // 1. Get challenge from your server
    const { challenge } = await fetch('/api/passkey/register/begin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    }).then(r => r.json());

    // 2. Create the passkey
    const credential = await Passkeys.create({
      challenge, // base64url-encoded challenge from server
      rp: {
        id: 'yourdomain.com', // Must match Associated Domains / Asset Links
        name: 'Your App Name',
      },
      user: {
        id: btoa(user.id), // base64url-encoded user ID
        name: user.email,
        displayName: user.name,
      },
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Use device biometrics
        residentKey: 'required',             // Discoverable credential
        userVerification: 'required',        // Require biometric/PIN
      },
      attestation: 'none', // 'none' for privacy, 'direct' for attestation
    });

    // 3. Send credential to your server for verification and storage
    await fetch('/api/passkey/register/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        credential: {
          id: credential.id,
          rawId: credential.rawId,
          type: credential.type,
          response: credential.response,
        },
      }),
    });

    console.log('Passkey registered successfully!');
    return credential;
  } catch (error: any) {
    handlePasskeyError(error);
    throw error;
  }
}
```

### Authenticate with a Passkey

```typescript
import { Passkeys, PasskeyErrorCode } from 'capacitor-passkeys';

async function loginWithPasskey() {
  try {
    // 1. Get challenge from your server
    const { challenge, allowCredentials } = await fetch('/api/passkey/login/begin', {
      method: 'POST',
    }).then(r => r.json());

    // 2. Authenticate with passkey
    const assertion = await Passkeys.get({
      challenge, // base64url-encoded challenge from server
      rpId: 'yourdomain.com',
      userVerification: 'required',
      // Optional: limit to specific credentials
      // allowCredentials: allowCredentials,
    });

    // 3. Send assertion to your server for verification
    const { token } = await fetch('/api/passkey/login/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: assertion.id,
        rawId: assertion.rawId,
        type: assertion.type,
        response: assertion.response,
      }),
    }).then(r => r.json());

    console.log('Logged in successfully!');
    return token;
  } catch (error: any) {
    handlePasskeyError(error);
    throw error;
  }
}
```

### Error Handling

```typescript
import { PasskeyErrorCode } from 'capacitor-passkeys';

function handlePasskeyError(error: any) {
  switch (error.code) {
    case PasskeyErrorCode.Cancelled:
      // User dismissed the biometric prompt
      console.log('User cancelled');
      break;

    case PasskeyErrorCode.InvalidDomain:
      // RP ID doesn't match Associated Domains (iOS) or Asset Links (Android)
      console.error('Domain configuration error - check your AASA/assetlinks.json');
      break;

    case PasskeyErrorCode.NoCredentials:
      // No passkeys found for this RP
      console.log('No passkeys registered - prompt user to register');
      break;

    case PasskeyErrorCode.NotSupported:
      // Device doesn't support passkeys
      console.log('Passkeys not supported on this device');
      break;

    case PasskeyErrorCode.SecurityError:
      // User verification failed (biometric/PIN)
      console.log('Authentication failed');
      break;

    case PasskeyErrorCode.InvalidRequest:
      // Malformed request parameters
      console.error('Invalid request:', error.message);
      break;

    default:
      console.error('Unknown error:', error.message);
  }
}
```

### Complete Example: Registration Flow

```typescript
import { Passkeys } from 'capacitor-passkeys';

// Check if passkeys are available before showing the option
async function initPasskeyUI() {
  const { supported } = await Passkeys.isSupported();
  
  if (supported) {
    // Show "Enable Passkey" button
    document.getElementById('passkey-section')?.classList.remove('hidden');
  }
}

// Full registration with server integration
async function enablePasskey() {
  const user = getCurrentUser(); // Your app's current user

  // Request registration options from server
  const beginResponse = await fetch('/api/webauthn/register/begin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id }),
  });
  const options = await beginResponse.json();

  // Create passkey (triggers Face ID/Touch ID/fingerprint)
  const credential = await Passkeys.create({
    challenge: options.challenge,
    rp: options.rp,
    user: options.user,
    pubKeyCredParams: options.pubKeyCredParams,
    authenticatorSelection: options.authenticatorSelection,
    attestation: options.attestation,
    timeout: options.timeout,
  });

  // Send credential to server for verification
  const verifyResponse = await fetch('/api/webauthn/register/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.id,
      credential,
    }),
  });

  if (verifyResponse.ok) {
    showSuccess('Passkey enabled! You can now sign in with biometrics.');
  }
}
```

---

## API Reference

### `isSupported()`

Check if passkeys are supported on the current device.

**Returns:** `Promise<{ supported: boolean; details?: object }>`

| Property | Type | Description |
|----------|------|-------------|
| `supported` | `boolean` | `true` if passkeys can be used |
| `details.osVersion` | `string` | OS version (e.g., "16.0", "13") |
| `details.apiLevel` | `number` | Android API level (Android only) |
| `details.hasPlayServices` | `boolean` | Google Play Services available (Android only) |
| `details.platformAuthenticatorAvailable` | `boolean` | Platform authenticator ready |

---

### `create(options: CreatePasskeyOptions)`

Create a new passkey (registration ceremony).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `challenge` | `string` | ✓ | Base64URL-encoded challenge from server |
| `rp.id` | `string` | ✓ | Relying party domain (must match AASA/Asset Links) |
| `rp.name` | `string` | ✓ | Relying party display name |
| `user.id` | `string` | ✓ | Base64URL-encoded user ID |
| `user.name` | `string` | ✓ | Username (typically email) |
| `user.displayName` | `string` | ✓ | Human-readable display name |
| `pubKeyCredParams` | `array` | | Acceptable algorithms (default: ES256, RS256) |
| `timeout` | `number` | | Timeout in milliseconds (platform-dependent) |
| `authenticatorSelection` | `object` | | Authenticator requirements |
| `attestation` | `string` | | Attestation preference: `'none'`, `'indirect'`, `'direct'` |

**Returns:** `Promise<CreatePasskeyResult>`

**Note on timeouts:** iOS manages timeouts internally; the `timeout` parameter is accepted for API compatibility but not enforced on iOS.

---

### `get(options: GetPasskeyOptions)`

Authenticate with an existing passkey (assertion ceremony).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `challenge` | `string` | ✓ | Base64URL-encoded challenge from server |
| `rpId` | `string` | ✓ | Relying party domain |
| `allowCredentials` | `array` | | Allowed credential IDs (omit for discoverable) |
| `timeout` | `number` | | Timeout in milliseconds (platform-dependent) |
| `userVerification` | `string` | | `'required'`, `'preferred'`, or `'discouraged'` |

**Returns:** `Promise<GetPasskeyResult>`

---

## Error Codes

| Code | Description |
|------|-------------|
| `cancelled` | User cancelled the operation |
| `notSupported` | Passkeys not supported on this device |
| `invalidDomain` | RP ID doesn't match domain configuration |
| `noCredentials` | No matching credentials found |
| `securityError` | User verification failed |
| `invalidRequest` | Request was invalid or malformed |
| `unknownError` | Unknown error occurred |

---

## Server-Side Implementation

Your server needs to implement the WebAuthn protocol. Recommended libraries:

| Language | Library |
|----------|---------|
| **Node.js** | [@simplewebauthn/server](https://simplewebauthn.dev/) |
| **Python** | [py_webauthn](https://github.com/duo-labs/py_webauthn) |
| **Go** | [go-webauthn](https://github.com/go-webauthn/webauthn) |
| **Rust** | [webauthn-rs](https://github.com/kanidm/webauthn-rs) |
| **Ruby** | [webauthn-ruby](https://github.com/cedarcode/webauthn-ruby) |
| **Java** | [java-webauthn-server](https://github.com/Yubico/java-webauthn-server) |
| **.NET** | [Fido2-NetLib](https://github.com/passwordless-lib/fido2-net-lib) |

---

## Testing

> ⚠️ **Simulators and emulators don't fully support passkeys.** Test on real devices.

### iOS Testing

- Requires iOS 16+ device with Face ID or Touch ID
- Must have Associated Domains configured correctly
- Use a development provisioning profile with the Associated Domains entitlement

### Android Testing

- Requires Android 9+ device with fingerprint sensor
- Must have Google Play Services installed
- Digital Asset Links must be accessible from the device

### Web Testing

- Use HTTPS (localhost is allowed for development)
- Use a browser that supports WebAuthn (Chrome, Safari, Firefox, Edge)

### Testing Domain Configuration

Before testing on devices, verify your domain files are accessible:

```bash
# iOS
curl -I "https://yourdomain.com/.well-known/apple-app-site-association"

# Android
curl -I "https://yourdomain.com/.well-known/assetlinks.json"
```

---

## Security Considerations

1. **Always verify on the server** - Never trust the client alone
2. **Use unique challenges** - Generate a new random challenge for each ceremony
3. **Validate RP ID** - Ensure it matches your domain exactly
4. **Store credentials securely** - Keep public keys and credential IDs in your database
5. **Handle errors gracefully** - Don't leak information about existing credentials

---

## License

MIT

## Contributing

Contributions welcome! Please read our [contributing guidelines](CONTRIBUTING.md) first.

## Credits

Built with ❤️ by [Begin](https://begin.is) for the Begin Wallet.
