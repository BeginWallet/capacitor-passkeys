# Passkeys Example App

A sample Capacitor app demonstrating the `@beginwallet/capacitor-passkeys` plugin.

## Features

- ✅ Check passkey support on device
- ✅ Register a new passkey (create credential)
- ✅ Authenticate with existing passkey
- ✅ Optional server integration for real WebAuthn flow
- ✅ Mobile-friendly dark UI

## Quick Start

### Prerequisites

- Node.js 18+
- For iOS: Xcode 15+, macOS
- For Android: Android Studio, JDK 17+

### Install Dependencies

```bash
cd example
npm install
```

### Build the Plugin

The example links to the local plugin, so build it first:

```bash
cd ..
npm install
npm run build
cd example
```

### Run on Web

```bash
npm start
```

Open http://localhost:5173 in your browser.

> **Note:** WebAuthn requires a secure context. localhost works for development, but for other hosts you need HTTPS.

### Run on iOS

```bash
# Add iOS platform (first time only)
npx cap add ios

# Sync web assets to iOS
npm run sync:ios

# Open in Xcode
npm run ios
```

In Xcode:
1. Select your team in Signing & Capabilities
2. Configure Associated Domains (see below)
3. Run on device (simulator has limited passkey support)

### Run on Android

```bash
# Add Android platform (first time only)
npx cap add android

# Sync web assets to Android
npm run sync:android

# Open in Android Studio
npm run android
```

In Android Studio:
1. Configure Digital Asset Links (see below)
2. Run on device with Google Play Services

## Configuration

### Relying Party ID

The Relying Party ID (RP ID) is your domain. For testing:

- **Web (localhost):** Use `localhost` as RP ID
- **iOS/Android:** Must match your associated domain

Edit the RP ID in the app's configuration section.

### Using a Test Server

Enable "Use server for challenges" toggle and point to your server:

```
http://localhost:3000
```

The server should implement these endpoints:

- `POST /register/start` - Returns WebAuthn registration options
- `POST /register/finish` - Verifies and stores credential
- `POST /auth/start` - Returns WebAuthn authentication options
- `POST /auth/finish` - Verifies assertion and returns user

See the `../server` directory for a sample server implementation.

## Platform Setup

### iOS Associated Domains

For iOS, you must configure Associated Domains to link your app with your server:

1. In Xcode, go to **Signing & Capabilities**
2. Add **Associated Domains** capability
3. Add: `webcredentials:your-domain.com`

On your server, host this file at `https://your-domain.com/.well-known/apple-app-site-association`:

```json
{
  "webcredentials": {
    "apps": ["TEAM_ID.com.example.passkeysexample"]
  }
}
```

Replace `TEAM_ID` with your Apple Team ID.

#### Local Development with ngrok

For testing without a production domain:

```bash
ngrok http 3000
```

Use the ngrok HTTPS URL as your RP ID and configure Associated Domains accordingly.

### Android Asset Links

For Android, configure Digital Asset Links:

1. Host this file at `https://your-domain.com/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.example.passkeysexample",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
  }
}]
```

2. Get your SHA256 fingerprint:

```bash
# Debug key
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android

# Release key
keytool -list -v -keystore your-release-key.keystore -alias your-alias
```

3. Add to `android/app/src/main/res/values/strings.xml`:

```xml
<string name="asset_statements">
  [{
    "include": "https://your-domain.com/.well-known/assetlinks.json"
  }]
</string>
```

## Project Structure

```
example/
├── www/
│   └── index.html      # Single-page app with all UI and logic
├── ios/                # iOS project (after npx cap add ios)
├── android/            # Android project (after npx cap add android)
├── capacitor.config.ts # Capacitor configuration
├── package.json        # Dependencies and scripts
└── README.md           # This file
```

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Serve web app on localhost:5173 |
| `npm run build` | Copy www to dist (static, no build needed) |
| `npm run ios` | Open iOS project in Xcode |
| `npm run android` | Open Android project in Android Studio |
| `npm run sync` | Sync web assets to all platforms |
| `npm run sync:ios` | Sync web assets to iOS only |
| `npm run sync:android` | Sync web assets to Android only |

## Troubleshooting

### "Passkeys not supported"

- **iOS:** Requires iOS 16.0+. Run on a physical device; simulator support is limited.
- **Android:** Requires Android 9+ (API 28) with Google Play Services.
- **Web:** Requires a browser with WebAuthn support (Chrome, Safari, Firefox, Edge).

### "Invalid domain" error

- Ensure RP ID matches your Associated Domains (iOS) or Asset Links (Android) configuration.
- The domain must be served over HTTPS (except localhost for development).

### "No credentials found"

- No passkey exists for this RP ID. Register one first.
- Check that you're using the same RP ID for registration and authentication.

### Registration works but authentication fails

- Ensure the credential was created as a discoverable credential (`residentKey: 'required'`).
- On iOS, check that the credential is synced via iCloud Keychain.

## License

MIT
