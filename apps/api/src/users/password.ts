import { argon2id, hash } from 'argon2';

// Library defaults (m=64 MiB, t=3, p=4); salt and params are embedded in the hash string.
export function hashPassword(plain: string): Promise<string> {
  return hash(plain, { type: argon2id });
}
