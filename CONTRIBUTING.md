# Contributing to capacitor-passkeys

Thank you for your interest in contributing!

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/beginwallet/capacitor-passkeys.git
   cd capacitor-passkeys
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

## Project Structure

```
capacitor-passkeys/
├── src/                     # TypeScript source
│   ├── definitions.ts       # Type definitions
│   ├── index.ts             # Plugin registration
│   └── web.ts               # Web implementation
├── ios/                     # iOS implementation
│   └── Sources/PasskeysPlugin/
│       ├── PasskeysPlugin.swift
│       └── PasskeysPlugin.m
├── android/                 # Android implementation
│   └── src/main/kotlin/io/beginwallet/passkeys/
│       └── PasskeysPlugin.kt
└── README.md
```

## Making Changes

### TypeScript

1. Edit files in `src/`
2. Run `npm run build` to compile
3. Run `npm run lint` to check for issues

### iOS (Swift)

1. Edit `ios/Sources/PasskeysPlugin/PasskeysPlugin.swift`
2. Test in a real Capacitor app (simulators don't support passkeys)

### Android (Kotlin)

1. Edit `android/src/main/kotlin/io/beginwallet/passkeys/PasskeysPlugin.kt`
2. Run `npm run verify:android` to build
3. Test on a real device with Google Play Services

## Testing

Passkeys require real hardware for testing:
- **iOS:** Device with Face ID/Touch ID running iOS 16+
- **Android:** Device with fingerprint sensor and Google Play Services

## Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run linting: `npm run lint`
5. Commit with a clear message
6. Push and open a PR

## Code Style

- TypeScript: ESLint + Prettier (run `npm run fmt`)
- Swift: SwiftLint (run `npm run swiftlint`)
- Follow existing patterns in the codebase

## Questions?

Open an issue if you have questions or need help!
