import type { User } from '@supabase/supabase-js';

// Supabase signs people in by email, so an ID like "dalbi" is stored as dalbi@tango-note.invalid.
// The .invalid TLD can never receive mail, so these addresses never reach anyone.
const ID_EMAIL_DOMAIN = 'tango-note.invalid';

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const USERNAME_RULE = '영문 소문자, 숫자, _ 로 3~20자';

/** Accepts an ID or a full email address and returns what Supabase signs in with. */
export function toAuthEmail(idOrEmail: string): string {
  const value = idOrEmail.trim().toLowerCase();
  return value.includes('@') ? value : `${value}@${ID_EMAIL_DOMAIN}`;
}

export function displayName(user: User): string {
  const username = user.user_metadata?.username;
  if (typeof username === 'string' && username) return username;
  return user.email?.replace(`@${ID_EMAIL_DOMAIN}`, '') ?? '내 계정';
}
