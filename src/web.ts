import { WebPlugin } from '@capacitor/core';

import type {
  PasskeysPlugin,
  CreatePasskeyOptions,
  CreatePasskeyResult,
  GetPasskeyOptions,
  GetPasskeyResult,
  IsSupportedResult,
  PasskeyErrorCode,
} from './definitions';

/**
 * Web implementation using browser WebAuthn API
 */
export class PasskeysWeb extends WebPlugin implements PasskeysPlugin {
  /**
   * Check if WebAuthn is supported in the browser
   */
  async isSupported(): Promise<IsSupportedResult> {
    const supported =
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential !== 'undefined' &&
      typeof navigator.credentials !== 'undefined';

    let platformAuthenticatorAvailable = false;

    if (supported && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      try {
        platformAuthenticatorAvailable =
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch {
        // Ignore errors
      }
    }

    return {
      supported,
      details: {
        platformAuthenticatorAvailable,
      },
    };
  }

  /**
   * Create a new passkey using WebAuthn API
   */
  async create(options: CreatePasskeyOptions): Promise<CreatePasskeyResult> {
    const publicKeyOptions = this.toPublicKeyCredentialCreationOptions(options);

    try {
      const credential = (await navigator.credentials.create({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw this.createError('notSupported', 'Failed to create credential');
      }

      return this.formatCreateResult(credential);
    } catch (error) {
      throw this.handleWebAuthnError(error);
    }
  }

  /**
   * Authenticate with an existing passkey using WebAuthn API
   */
  async get(options: GetPasskeyOptions): Promise<GetPasskeyResult> {
    const publicKeyOptions = this.toPublicKeyCredentialRequestOptions(options);

    try {
      const credential = (await navigator.credentials.get({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw this.createError('noCredentials', 'No credential selected');
      }

      return this.formatGetResult(credential);
    } catch (error) {
      throw this.handleWebAuthnError(error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Convert plugin options to WebAuthn PublicKeyCredentialCreationOptions
   */
  private toPublicKeyCredentialCreationOptions(
    options: CreatePasskeyOptions,
  ): PublicKeyCredentialCreationOptions {
    const pubKeyCredParams = options.pubKeyCredParams ?? [
      { type: 'public-key', alg: -7 }, // ES256
      { type: 'public-key', alg: -257 }, // RS256
    ];

    return {
      challenge: this.base64UrlToArrayBuffer(options.challenge),
      rp: {
        id: options.rp.id,
        name: options.rp.name,
      },
      user: {
        id: this.base64UrlToArrayBuffer(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: pubKeyCredParams as PublicKeyCredentialParameters[],
      timeout: options.timeout,
      authenticatorSelection: options.authenticatorSelection ?? {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      },
      attestation: options.attestation ?? 'none',
    };
  }

  /**
   * Convert plugin options to WebAuthn PublicKeyCredentialRequestOptions
   */
  private toPublicKeyCredentialRequestOptions(
    options: GetPasskeyOptions,
  ): PublicKeyCredentialRequestOptions {
    const requestOptions: PublicKeyCredentialRequestOptions = {
      challenge: this.base64UrlToArrayBuffer(options.challenge),
      rpId: options.rpId,
      timeout: options.timeout,
      userVerification: options.userVerification ?? 'required',
    };

    if (options.allowCredentials && options.allowCredentials.length > 0) {
      requestOptions.allowCredentials = options.allowCredentials.map((cred) => ({
        type: cred.type,
        id: this.base64UrlToArrayBuffer(cred.id),
        transports: cred.transports as AuthenticatorTransport[] | undefined,
      }));
    }

    return requestOptions;
  }

  /**
   * Format WebAuthn credential into CreatePasskeyResult
   */
  private formatCreateResult(credential: PublicKeyCredential): CreatePasskeyResult {
    const response = credential.response as AuthenticatorAttestationResponse;

    return {
      id: credential.id,
      rawId: this.arrayBufferToBase64Url(credential.rawId),
      type: 'public-key',
      response: {
        clientDataJSON: this.arrayBufferToBase64Url(response.clientDataJSON),
        attestationObject: this.arrayBufferToBase64Url(response.attestationObject),
      },
      authenticatorAttachment: credential.authenticatorAttachment as
        | 'platform'
        | 'cross-platform'
        | undefined,
    };
  }

  /**
   * Format WebAuthn credential into GetPasskeyResult
   */
  private formatGetResult(credential: PublicKeyCredential): GetPasskeyResult {
    const response = credential.response as AuthenticatorAssertionResponse;

    const result: GetPasskeyResult = {
      id: credential.id,
      rawId: this.arrayBufferToBase64Url(credential.rawId),
      type: 'public-key',
      response: {
        clientDataJSON: this.arrayBufferToBase64Url(response.clientDataJSON),
        authenticatorData: this.arrayBufferToBase64Url(response.authenticatorData),
        signature: this.arrayBufferToBase64Url(response.signature),
      },
    };

    if (response.userHandle) {
      result.response.userHandle = this.arrayBufferToBase64Url(response.userHandle);
    }

    return result;
  }

  /**
   * Handle WebAuthn errors and convert to PasskeyError
   */
  private handleWebAuthnError(error: unknown): { code: PasskeyErrorCode; message: string } {
    if (error instanceof DOMException) {
      switch (error.name) {
        case 'AbortError':
        case 'NotAllowedError':
          // User cancelled or denied
          return this.createError('cancelled', 'User cancelled the operation');

        case 'SecurityError':
          return this.createError('securityError', error.message);

        case 'InvalidStateError':
          // Credential already exists
          return this.createError('invalidRequest', 'Credential already exists for this user');

        case 'NotSupportedError':
          return this.createError('notSupported', 'WebAuthn not supported');

        default:
          return this.createError('unknownError', error.message);
      }
    }

    if (error instanceof Error) {
      return this.createError('unknownError', error.message);
    }

    return this.createError('unknownError', 'Unknown error occurred');
  }

  /**
   * Create a PasskeyError object
   */
  private createError(
    code: PasskeyErrorCode,
    message: string,
  ): { code: PasskeyErrorCode; message: string } {
    return { code, message };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Base64URL encoding utilities
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Convert base64url string to ArrayBuffer
   */
  private base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
    // Convert base64url to base64
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');

    // Pad with '=' if necessary
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

    // Decode
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Convert ArrayBuffer to base64url string
   */
  private arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    // Convert to base64
    const base64 = btoa(binary);

    // Convert to base64url
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
