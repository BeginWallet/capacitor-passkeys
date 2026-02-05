# Passkeys Example Server

A simple WebAuthn/Passkeys server for testing the `capacitor-passkeys` plugin. Built with Express and [SimpleWebAuthn](https://simplewebauthn.dev/).

> ⚠️ **Demo Only**: This server uses in-memory storage and is intended for development/testing only. See [Production Considerations](#production-considerations) for guidance on production deployments.

## Quick Start

```bash
# Install dependencies
npm install

# Run the server
npm start

# Or run with auto-reload for development
npm run dev
```

The server starts at `http://localhost:3000` by default.

## Configuration

Configure via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `RP_ID` | `localhost` | Relying Party ID (your domain) |
| `ORIGIN` | `http://localhost:5173` | Allowed origin(s) for CORS. Comma-separated for multiple. |
| `PORT` | `3000` | Server port |

Example:
```bash
RP_ID=example.com ORIGIN=https://example.com npm start
```

For multiple origins (e.g., web + mobile):
```bash
ORIGIN=http://localhost:5173,capacitor://localhost,https://localhost npm start
```

## API Endpoints

### Health Check

```
GET /api/health
```

Returns server status and configuration.

### Registration Flow

#### 1. Generate Registration Options

```
POST /api/register/options
Content-Type: application/json

{
  "username": "alice"
}
```

Response: `PublicKeyCredentialCreationOptions` compatible with the WebAuthn API.

#### 2. Verify Registration

```
POST /api/register/verify
Content-Type: application/json

{
  "username": "alice",
  "credential": { /* RegistrationResponseJSON from navigator.credentials.create() or Passkeys.create() */ }
}
```

Response:
```json
{
  "verified": true,
  "credentialId": "abc123..."
}
```

### Authentication Flow

#### 1. Generate Authentication Options

```
POST /api/authenticate/options
Content-Type: application/json

{
  "username": "alice"  // Optional - omit for discoverable credentials
}
```

Response: `PublicKeyCredentialRequestOptions` compatible with the WebAuthn API.

#### 2. Verify Authentication

```
POST /api/authenticate/verify
Content-Type: application/json

{
  "username": "alice",  // Optional if using discoverable credentials
  "credential": { /* AuthenticationResponseJSON from navigator.credentials.get() or Passkeys.get() */ }
}
```

Response:
```json
{
  "verified": true,
  "username": "alice"
}
```

### Debug Endpoints

```
GET /api/debug/users      # List all registered users
DELETE /api/debug/users   # Clear all users (reset)
```

## Usage with Capacitor Passkeys Plugin

### Registration

```typescript
import { Passkeys } from 'capacitor-passkeys';

// 1. Get registration options from server
const optionsResponse = await fetch('http://localhost:3000/api/register/options', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'alice' }),
});
const options = await optionsResponse.json();

// 2. Create credential with the plugin
const credential = await Passkeys.create({
  challenge: options.challenge,
  rp: options.rp,
  user: options.user,
  pubKeyCredParams: options.pubKeyCredParams,
  timeout: options.timeout,
  excludeCredentials: options.excludeCredentials,
  authenticatorSelection: options.authenticatorSelection,
});

// 3. Send credential to server for verification
const verifyResponse = await fetch('http://localhost:3000/api/register/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    username: 'alice',
    credential: credential 
  }),
});
const result = await verifyResponse.json();
console.log('Registered:', result.verified);
```

### Authentication

```typescript
import { Passkeys } from 'capacitor-passkeys';

// 1. Get authentication options from server
const optionsResponse = await fetch('http://localhost:3000/api/authenticate/options', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'alice' }), // Optional
});
const options = await optionsResponse.json();

// 2. Get credential with the plugin
const credential = await Passkeys.get({
  challenge: options.challenge,
  timeout: options.timeout,
  rpId: options.rpId,
  allowCredentials: options.allowCredentials,
  userVerification: options.userVerification,
});

// 3. Send credential to server for verification
const verifyResponse = await fetch('http://localhost:3000/api/authenticate/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    username: 'alice', // Optional if using discoverable credentials
    credential: credential 
  }),
});
const result = await verifyResponse.json();
console.log('Authenticated:', result.verified, result.username);
```

## Production Considerations

For production deployments, you'll need to address:

### 1. HTTPS Required
WebAuthn requires a secure context. Use HTTPS in production.

### 2. Real Domain
Set `RP_ID` to your actual domain (e.g., `example.com`). The RP ID must match the domain or be a registrable suffix.

### 3. Persistent Storage
Replace the in-memory Maps with a proper database:

```typescript
// Instead of:
const users = new Map<string, User>();

// Use a database like:
// - PostgreSQL with node-postgres
// - MongoDB with mongoose
// - SQLite for simpler deployments
```

Store credentials securely:
- `credential.publicKey` (Uint8Array → base64 for storage)
- `credential.id` (string)
- `credential.counter` (number)
- `credential.transports` (string[])

### 4. Session Management
Replace challenge storage with proper sessions:
- Use `express-session` with a session store
- Tie challenges to user sessions
- Set appropriate expiration (5 minutes is typical)

### 5. Rate Limiting
Add rate limiting to prevent brute force:

```typescript
import rateLimit from 'express-rate-limit';

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP
}));
```

### 6. Error Handling
Don't leak sensitive information in error messages.

### Example Production Config

```bash
# Production environment
export RP_ID=myapp.example.com
export ORIGIN=https://myapp.example.com
export PORT=3000
export DATABASE_URL=postgres://...
export SESSION_SECRET=your-secure-secret
```

## Testing

Test the server with curl:

```bash
# Health check
curl http://localhost:3000/api/health

# Start registration
curl -X POST http://localhost:3000/api/register/options \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser"}'

# List users (debug)
curl http://localhost:3000/api/debug/users

# Clear all users (debug)
curl -X DELETE http://localhost:3000/api/debug/users
```

## License

MIT
