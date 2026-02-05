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

## Setup

### iOS Setup

#### 1. Associated Domains

Add the Associated Domains capability to your app and include your domain:

1. Open your project in Xcode
2. Select your app target → "Signing & Capabilities"
3. Click "+ Capability" → "Associated Domains"
4. Add: `webcredentials:yourdomain.com`

#### 2. Apple App Site Association

Host an `apple-app-site-association` file at `https://yourdomain.com/.well-known/apple-app-site-association`:

```json
{
  "webcredentials": {
    "apps": ["TEAMID.com.yourcompany.yourapp"]
  }
}
```

Replace `TEAMID` with your Apple Team ID and update the bundle identifier.

The file must be:
- Served over HTTPS with a valid certificate
- Content-Type: `application/json`
- No redirects

### Android Setup

#### 1. Digital Asset Links

Host an `assetlinks.json` file at `https://yourdomain.com/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.yourcompany.yourapp",
    "sha256_cert_fingerprints": [
      "YOUR:SHA256:FINGERPRINT:HERE"
    ]
  }
}]
```

#### 2. Get Your SHA-256 Fingerprint

For debug builds:
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

For release builds, use your release keystore.

#### 3. Dependencies

The plugin automatically includes the required Credential Manager dependencies:
```gradle
implementation "androidx.credentials:credentials:1.3.0"
implementation "androidx.credentials:credentials-play-services-auth:1.3.0"
```

## Usage

### Import the Plugin

```typescript
import { Passkeys } from 'capacitor-passkeys';
```

### Check Support

```typescript
const { supported } = await Passkeys.isSupported();

if (!supported) {
  // Fall back to password authentication
  console.log('Passkeys not supported on this device');
}
```

### Create a Passkey (Registration)

```typescript
import { Passkeys, PasskeyErrorCode } from 'capacitor-passkeys';

async function registerPasskey(user: { id: string; email: string; name: string }) {
  try {
    // Get challenge from your server
    const { challenge } = await fetch('/api/passkey/register/begin', {
      method: 'POST',
      body: JSON.stringify({ userId: user.id }),
    }).then(r => r.json());

    // Create the passkey
    const credential = await Passkeys.create({
      challenge, // base64url-encoded challenge from server
      rp: {
        id: 'yourdomain.com', // Must match associated domains
        name: 'Your App Name',
      },
      user: {
        id: btoa(user.id), // base64url-encoded user ID
        name: user.email,
        displayName: user.name,
      },
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      },
      attestation: 'none',
    });

    // Send credential to your server for verification
    await fetch('/api/passkey/register/complete', {
      method: 'POST',
      body: JSON.stringify({
        userId: user.id,
        credential,
      }),
    });

    console.log('Passkey registered successfully!');
  } catch (error) {
    if (error.code === PasskeyErrorCode.Cancelled) {
      console.log('User cancelled registration');
    } else {
      console.error('Registration failed:', error);
    }
  }
}
```

### Authenticate with a Passkey

```typescript
import { Passkeys, PasskeyErrorCode } from 'capacitor-passkeys';

async function authenticateWithPasskey() {
  try {
    // Get challenge from your server
    const { challenge } = await fetch('/api/passkey/login/begin', {
      method: 'POST',
    }).then(r => r.json());

    // Authenticate with passkey
    const assertion = await Passkeys.get({
      challenge, // base64url-encoded challenge from server
      rpId: 'yourdomain.com',
      userVerification: 'required',
    });

    // Send assertion to your server for verification
    const { token } = await fetch('/api/passkey/login/complete', {
      method: 'POST',
      body: JSON.stringify({ assertion }),
    }).then(r => r.json());

    console.log('Authenticated successfully!');
    return token;
  } catch (error) {
    if (error.code === PasskeyErrorCode.Cancelled) {
      console.log('User cancelled authentication');
    } else if (error.code === PasskeyErrorCode.NoCredentials) {
      console.log('No passkeys found for this site');
    } else {
      console.error('Authentication failed:', error);
    }
  }
}
```

## API Reference

### `isSupported()`

Check if passkeys are supported on the current device.

**Returns:** `Promise<{ supported: boolean; details?: object }>`

---

### `create(options: CreatePasskeyOptions)`

Create a new passkey (registration ceremony).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `challenge` | `string` | ✓ | Base64URL-encoded challenge from server |
| `rp.id` | `string` | ✓ | Relying party domain |
| `rp.name` | `string` | ✓ | Relying party display name |
| `user.id` | `string` | ✓ | Base64URL-encoded user ID |
| `user.name` | `string` | ✓ | Username (email) |
| `user.displayName` | `string` | ✓ | Display name |
| `pubKeyCredParams` | `array` | | Acceptable algorithms (default: ES256, RS256) |
| `timeout` | `number` | | Timeout in milliseconds |
| `authenticatorSelection` | `object` | | Authenticator requirements |
| `attestation` | `string` | | Attestation preference |

**Returns:** `Promise<CreatePasskeyResult>`

---

### `get(options: GetPasskeyOptions)`

Authenticate with an existing passkey (assertion ceremony).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `challenge` | `string` | ✓ | Base64URL-encoded challenge from server |
| `rpId` | `string` | ✓ | Relying party domain |
| `allowCredentials` | `array` | | Allowed credential IDs |
| `timeout` | `number` | | Timeout in milliseconds |
| `userVerification` | `string` | | User verification requirement |

**Returns:** `Promise<GetPasskeyResult>`

## Error Handling

All methods may throw errors with the following codes:

| Code | Description |
|------|-------------|
| `cancelled` | User cancelled the operation |
| `notSupported` | Passkeys not supported on this device |
| `invalidDomain` | RP ID doesn't match associated domain configuration |
| `noCredentials` | No matching credentials found |
| `securityError` | User verification failed |
| `invalidRequest` | Request was invalid or malformed |
| `unknownError` | Unknown error occurred |

```typescript
import { PasskeyErrorCode } from 'capacitor-passkeys';

try {
  await Passkeys.create(options);
} catch (error) {
  switch (error.code) {
    case PasskeyErrorCode.Cancelled:
      // User dismissed the dialog
      break;
    case PasskeyErrorCode.InvalidDomain:
      // Check your associated domains configuration
      break;
    default:
      console.error(error.message);
  }
}
```

## Server-Side Implementation

Your server needs to implement the WebAuthn protocol. Popular libraries:

- **Node.js:** [@simplewebauthn/server](https://simplewebauthn.dev/)
- **Python:** [py_webauthn](https://github.com/duo-labs/py_webauthn)
- **Go:** [go-webauthn](https://github.com/go-webauthn/webauthn)
- **Rust:** [webauthn-rs](https://github.com/kanidm/webauthn-rs)

## Testing

> ⚠️ **Simulators and emulators don't fully support passkeys.** You need real devices for testing.

### iOS Testing
- Requires iOS 16+ device with Face ID or Touch ID
- Must have associated domains configured correctly
- Use a development provisioning profile

### Android Testing
- Requires Android 9+ device with fingerprint sensor
- Must have Google Play Services
- Digital Asset Links must be accessible

### Web Testing
- Use HTTPS (localhost is allowed for development)
- Use a browser that supports WebAuthn

## License

MIT

## Contributing

Contributions welcome! Please read our [contributing guidelines](CONTRIBUTING.md) first.

## Credits

Built with ❤️ by [Begin](https://begin.is) for the Begin Wallet.
