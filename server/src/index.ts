import express, { Request, Response } from 'express';
import cors from 'cors';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';

// Configuration
const RP_ID = process.env.RP_ID || 'localhost';
const RP_NAME = 'Passkeys Example';
const ORIGIN = process.env.ORIGIN || 'http://localhost:5173';
const PORT = parseInt(process.env.PORT || '3000', 10);

// Parse multiple origins if comma-separated
const ALLOWED_ORIGINS = ORIGIN.split(',').map(o => o.trim());

console.log('Configuration:');
console.log(`  RP_ID: ${RP_ID}`);
console.log(`  RP_NAME: ${RP_NAME}`);
console.log(`  ORIGIN: ${ALLOWED_ORIGINS.join(', ')}`);
console.log(`  PORT: ${PORT}`);

// Types
interface StoredCredential {
  id: string;
  publicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}

interface User {
  id: Uint8Array<ArrayBuffer>;
  username: string;
  credentials: StoredCredential[];
}

// In-memory storage (demo only - not for production!)
const users = new Map<string, User>();
const challenges = new Map<string, string>(); // session/username -> challenge

// Helper to generate a random user ID
function generateUserId(): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(16);
  const bytes = new Uint8Array(buffer);
  crypto.getRandomValues(bytes);
  return bytes;
}

// Helper to find user by credential ID
function findUserByCredentialId(credentialId: string): User | undefined {
  for (const user of users.values()) {
    if (user.credentials.some(c => c.id === credentialId)) {
      return user;
    }
  }
  return undefined;
}

const app = express();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', rpId: RP_ID });
});

// ============================================================
// Registration Flow
// ============================================================

// POST /api/register/options - Generate registration options
app.post('/api/register/options', async (req: Request, res: Response) => {
  try {
    const { username } = req.body;

    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    // Get or create user
    let user = users.get(username);
    if (!user) {
      user = {
        id: generateUserId(),
        username,
        credentials: [],
      };
      users.set(username, user);
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: user.id,
      userName: username,
      userDisplayName: username,
      // Exclude existing credentials to prevent re-registration
      excludeCredentials: user.credentials.map(cred => ({
        id: cred.id,
        transports: cred.transports,
      })),
      authenticatorSelection: {
        // Prefer platform authenticators (Face ID, Touch ID, Windows Hello)
        authenticatorAttachment: 'platform',
        // Require resident key for discoverable credentials
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Store challenge for verification
    challenges.set(username, options.challenge);

    console.log(`[Register] Generated options for user: ${username}`);
    res.json(options);
  } catch (error) {
    console.error('[Register] Error generating options:', error);
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
});

// POST /api/register/verify - Verify registration response
app.post('/api/register/verify', async (req: Request, res: Response) => {
  try {
    const { username, credential } = req.body;

    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    if (!credential) {
      res.status(400).json({ error: 'Credential is required' });
      return;
    }

    const user = users.get(username);
    if (!user) {
      res.status(400).json({ error: 'User not found. Call /api/register/options first.' });
      return;
    }

    const expectedChallenge = challenges.get(username);
    if (!expectedChallenge) {
      res.status(400).json({ error: 'No challenge found. Call /api/register/options first.' });
      return;
    }

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response: credential as RegistrationResponseJSON,
        expectedChallenge,
        expectedOrigin: ALLOWED_ORIGINS,
        expectedRPID: RP_ID,
      });
    } catch (error) {
      console.error('[Register] Verification failed:', error);
      res.status(400).json({ error: `Verification failed: ${error}` });
      return;
    }

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      // Store the credential
      const { credential: newCredential } = registrationInfo;
      
      const storedCredential: StoredCredential = {
        id: newCredential.id,
        publicKey: newCredential.publicKey,
        counter: newCredential.counter,
        transports: credential.response?.transports,
      };

      user.credentials.push(storedCredential);

      // Clear the challenge
      challenges.delete(username);

      console.log(`[Register] Successfully registered credential for user: ${username}`);
      console.log(`[Register] Credential ID: ${newCredential.id}`);

      res.json({
        verified: true,
        credentialId: newCredential.id,
      });
    } else {
      res.status(400).json({ verified: false, error: 'Verification failed' });
    }
  } catch (error) {
    console.error('[Register] Error verifying registration:', error);
    res.status(500).json({ error: 'Failed to verify registration' });
  }
});

// ============================================================
// Authentication Flow
// ============================================================

// POST /api/authenticate/options - Generate authentication options
app.post('/api/authenticate/options', async (req: Request, res: Response) => {
  try {
    const { username } = req.body;

    // If username provided, get user's credentials
    let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] | undefined;
    
    if (username && typeof username === 'string') {
      const user = users.get(username);
      if (!user || user.credentials.length === 0) {
        res.status(400).json({ error: 'User not found or has no registered credentials' });
        return;
      }
      
      allowCredentials = user.credentials.map(cred => ({
        id: cred.id,
        transports: cred.transports,
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
      // If allowCredentials is undefined, allows discoverable credentials
      allowCredentials,
    });

    // Store challenge - use username if provided, otherwise use the challenge itself as key
    const challengeKey = username || `anon_${options.challenge}`;
    challenges.set(challengeKey, options.challenge);

    console.log(`[Authenticate] Generated options${username ? ` for user: ${username}` : ' (discoverable)'}`);
    res.json(options);
  } catch (error) {
    console.error('[Authenticate] Error generating options:', error);
    res.status(500).json({ error: 'Failed to generate authentication options' });
  }
});

// POST /api/authenticate/verify - Verify authentication response  
app.post('/api/authenticate/verify', async (req: Request, res: Response) => {
  try {
    const { username, credential } = req.body;

    if (!credential) {
      res.status(400).json({ error: 'Credential is required' });
      return;
    }

    const authResponse = credential as AuthenticationResponseJSON;

    // Find the user - either by provided username or by credential ID
    let user: User | undefined;
    let challengeKey: string;

    if (username && typeof username === 'string') {
      user = users.get(username);
      challengeKey = username;
    } else {
      // Discoverable credential - find user by credential ID
      user = findUserByCredentialId(authResponse.id);
      // For discoverable credentials, we stored with `anon_${challenge}` key
      // We need to find the matching challenge
      for (const [key, challenge] of challenges.entries()) {
        if (key.startsWith('anon_')) {
          challengeKey = key;
          break;
        }
      }
    }

    if (!user) {
      res.status(400).json({ error: 'User not found' });
      return;
    }

    const storedCredential = user.credentials.find(c => c.id === authResponse.id);
    if (!storedCredential) {
      res.status(400).json({ error: 'Credential not found for this user' });
      return;
    }

    const expectedChallenge = challenges.get(challengeKey!);
    if (!expectedChallenge) {
      res.status(400).json({ error: 'No challenge found. Call /api/authenticate/options first.' });
      return;
    }

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response: authResponse,
        expectedChallenge,
        expectedOrigin: ALLOWED_ORIGINS,
        expectedRPID: RP_ID,
        credential: {
          id: storedCredential.id,
          publicKey: storedCredential.publicKey,
          counter: storedCredential.counter,
          transports: storedCredential.transports,
        },
      });
    } catch (error) {
      console.error('[Authenticate] Verification failed:', error);
      res.status(400).json({ error: `Verification failed: ${error}` });
      return;
    }

    const { verified, authenticationInfo } = verification;

    if (verified) {
      // Update the counter
      storedCredential.counter = authenticationInfo.newCounter;

      // Clear the challenge
      challenges.delete(challengeKey!);

      console.log(`[Authenticate] Successfully authenticated user: ${user.username}`);

      res.json({
        verified: true,
        username: user.username,
      });
    } else {
      res.status(400).json({ verified: false, error: 'Verification failed' });
    }
  } catch (error) {
    console.error('[Authenticate] Error verifying authentication:', error);
    res.status(500).json({ error: 'Failed to verify authentication' });
  }
});

// ============================================================
// Debug endpoints (for development only)
// ============================================================

app.get('/api/debug/users', (_req: Request, res: Response) => {
  const userList = Array.from(users.entries()).map(([username, user]) => ({
    username,
    credentialCount: user.credentials.length,
    credentialIds: user.credentials.map(c => c.id),
  }));
  res.json(userList);
});

app.delete('/api/debug/users', (_req: Request, res: Response) => {
  users.clear();
  challenges.clear();
  console.log('[Debug] Cleared all users and challenges');
  res.json({ message: 'All users cleared' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🔐 Passkey server running at http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /api/register/options     - Generate registration options`);
  console.log(`  POST /api/register/verify      - Verify registration`);
  console.log(`  POST /api/authenticate/options - Generate authentication options`);
  console.log(`  POST /api/authenticate/verify  - Verify authentication`);
  console.log(`  GET  /api/health               - Health check`);
  console.log(`  GET  /api/debug/users          - List registered users (debug)`);
  console.log(`  DELETE /api/debug/users        - Clear all users (debug)`);
  console.log('');
});
