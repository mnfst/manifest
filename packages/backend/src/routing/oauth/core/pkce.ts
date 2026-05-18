import { createHash, randomBytes } from 'crypto';

export interface PkcePair {
  /** Random verifier the client keeps secret until token exchange. */
  verifier: string;
  /** SHA-256(verifier), base64url-encoded — sent on /authorize as code_challenge. */
  challenge: string;
}

export function generatePkce(): PkcePair {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function generateState(byteLength = 32): string {
  return randomBytes(byteLength).toString('hex');
}
