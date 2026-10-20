/**
 * Cryptographic authentication and password management using Node.js native crypto
 */

import crypto from 'crypto';
import { User } from './types.ts';

const SECRET_KEY = process.env.SECRET_KEY || 'student-expense-tracker-secure-secret-key-prod-2026';

/**
 * Hash password using scrypt with random salt
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

/**
 * Verify password against salt and stored hash using timing-safe comparison
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    return crypto.timingSafeEqual(keyBuffer, hashBuffer);
  } catch {
    return false;
  }
}

/**
 * Generate a signed session token
 */
export function generateToken(user: User): string {
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payloadStr)
    .digest('base64url');
  return `${payloadStr}.${signature}`;
}

/**
 * Verify and decode a session token
 */
export function verifyToken(token: string): { userId: string; email: string; name: string } | null {
  if (!token || !token.includes('.')) return null;
  const [payloadStr, signature] = token.split('.');
  if (!payloadStr || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payloadStr)
    .digest('base64url');

  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }
    return { userId: payload.userId, email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}
