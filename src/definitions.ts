/**
 * Capacitor Passkeys Plugin
 *
 * Native passkey (WebAuthn) authentication for iOS and Android.
 * Falls back to browser WebAuthn API on web.
 */

/**
 * Error codes returned by the plugin
 */
export enum PasskeyErrorCode {
  /** User cancelled the passkey operation */
  Cancelled = 'cancelled',
  /** Passkeys not supported on this device/OS version */
  NotSupported = 'notSupported',
  /** RP ID doesn't match associated domain configuration */
  InvalidDomain = 'invalidDomain',
  /** No matching credentials found (get only) */
  NoCredentials = 'noCredentials',
  /** User verification failed (biometric/PIN) */
  SecurityError = 'securityError',
  /** Request was invalid or malformed */
  InvalidRequest = 'invalidRequest',
  /** Unknown error occurred */
  UnknownError = 'unknownError',
}

/**
 * Error thrown by passkey operations
 */
export interface PasskeyError {
  code: PasskeyErrorCode;
  message: string;
  /** Platform-specific error details (if available) */
  nativeError?: string;
}

/**
 * Credential algorithm parameters
 * -7 = ES256 (ECDSA with P-256 and SHA-256) — preferred
 * -257 = RS256 (RSA with SHA-256)
 */
export interface PublicKeyCredentialParameters {
  type: 'public-key';
  /** COSE algorithm identifier */
  alg: number;
}

/**
 * Criteria for selecting which authenticator to use
 */
export interface AuthenticatorSelectionCriteria {
  /**
   * 'platform' = device's built-in authenticator (Face ID, fingerprint)
   * 'cross-platform' = external authenticator (security key)
   */
  authenticatorAttachment?: 'platform' | 'cross-platform';
  /**
   * Whether to create a discoverable credential (resident key)
   * 'required' = must be discoverable (recommended for passkeys)
   */
  residentKey?: 'discouraged' | 'preferred' | 'required';
  /**
   * Whether user verification is required
   * 'required' = biometric/PIN must succeed
   */
  userVerification?: 'required' | 'preferred' | 'discouraged';
}

/**
 * Descriptor for an existing credential (used in allowCredentials)
 */
export interface PublicKeyCredentialDescriptor {
  type: 'public-key';
  /** Base64URL-encoded credential ID */
  id: string;
  /** Optional transport hints */
  transports?: ('usb' | 'nfc' | 'ble' | 'internal')[];
}

/**
 * Options for creating a new passkey (registration)
 */
export interface CreatePasskeyOptions {
  /**
   * Base64URL-encoded challenge from your server
   * Must be cryptographically random, at least 16 bytes
   */
  challenge: string;

  /**
   * Relying party (your server) information
   */
  rp: {
    /** Domain name (must match associated domains config) */
    id: string;
    /** Human-readable name shown to user */
    name: string;
  };

  /**
   * User account information
   */
  user: {
    /** Base64URL-encoded unique user identifier (opaque to client) */
    id: string;
    /** Username/email shown to user */
    name: string;
    /** Display name shown to user */
    displayName: string;
  };

  /**
   * Acceptable public key algorithms
   * Default: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }]
   */
  pubKeyCredParams?: PublicKeyCredentialParameters[];

  /**
   * Timeout in milliseconds
   * Default: platform-specific (usually 5-10 minutes)
   */
  timeout?: number;

  /**
   * Authenticator selection criteria
   * Default: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' }
   */
  authenticatorSelection?: AuthenticatorSelectionCriteria;

  /**
   * Attestation conveyance preference
   * 'none' = don't request attestation (recommended for privacy)
   * 'direct' = request attestation statement
   */
  attestation?: 'none' | 'indirect' | 'direct';
}

/**
 * Result of creating a new passkey
 */
export interface CreatePasskeyResult {
  /** Base64URL-encoded credential ID */
  id: string;
  /** Base64URL-encoded raw credential ID bytes */
  rawId: string;
  /** Always 'public-key' for WebAuthn credentials */
  type: 'public-key';
  response: {
    /**
     * Base64URL-encoded client data JSON
     * Contains: type, challenge, origin, crossOrigin
     */
    clientDataJSON: string;
    /**
     * Base64URL-encoded attestation object
     * Contains: fmt, authData (with public key), attStmt
     */
    attestationObject: string;
  };
  /**
   * Authenticator attachment used
   */
  authenticatorAttachment?: 'platform' | 'cross-platform';
}

/**
 * Options for authenticating with an existing passkey
 */
export interface GetPasskeyOptions {
  /**
   * Base64URL-encoded challenge from your server
   */
  challenge: string;

  /**
   * Relying party identifier (domain)
   */
  rpId: string;

  /**
   * Optional list of allowed credential IDs
   * If omitted, allows any discoverable credential for this RP
   */
  allowCredentials?: PublicKeyCredentialDescriptor[];

  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * User verification requirement
   * Default: 'required'
   */
  userVerification?: 'required' | 'preferred' | 'discouraged';
}

/**
 * Result of authenticating with a passkey
 */
export interface GetPasskeyResult {
  /** Base64URL-encoded credential ID */
  id: string;
  /** Base64URL-encoded raw credential ID bytes */
  rawId: string;
  /** Always 'public-key' */
  type: 'public-key';
  response: {
    /**
     * Base64URL-encoded client data JSON
     */
    clientDataJSON: string;
    /**
     * Base64URL-encoded authenticator data
     * Contains: rpIdHash, flags, signCount, extensions
     */
    authenticatorData: string;
    /**
     * Base64URL-encoded signature
     * Sign(authenticatorData || clientDataHash)
     */
    signature: string;
    /**
     * Base64URL-encoded user handle (user.id from registration)
     * Present if credential is discoverable
     */
    userHandle?: string;
  };
}

/**
 * Result of isSupported check
 */
export interface IsSupportedResult {
  /** Whether passkeys are supported on this device */
  supported: boolean;
  /**
   * Platform-specific details
   */
  details?: {
    /** iOS version or Android API level */
    osVersion?: string;
    /** Whether platform authenticator is available */
    platformAuthenticatorAvailable?: boolean;
  };
}

/**
 * Main plugin interface
 */
export interface PasskeysPlugin {
  /**
   * Check if passkeys are supported on this device.
   *
   * iOS: Requires iOS 16.0+
   * Android: Requires API 28+ with Google Play Services
   * Web: Requires WebAuthn support in browser
   *
   * @returns Promise with supported status
   */
  isSupported(): Promise<IsSupportedResult>;

  /**
   * Create a new passkey (registration).
   *
   * This will prompt the user to authenticate with biometrics
   * and create a new credential bound to the relying party.
   *
   * @param options - Registration options
   * @returns Promise with the new credential
   * @throws PasskeyError on failure
   */
  create(options: CreatePasskeyOptions): Promise<CreatePasskeyResult>;

  /**
   * Authenticate with an existing passkey.
   *
   * This will prompt the user to select a credential and
   * authenticate with biometrics.
   *
   * @param options - Authentication options
   * @returns Promise with the assertion
   * @throws PasskeyError on failure
   */
  get(options: GetPasskeyOptions): Promise<GetPasskeyResult>;
}
