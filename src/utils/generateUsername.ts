/**
 * Generate a unique username suggestion from an email or display name.
 * e.g. "john.doe@email.com" → "johndoe1234"
 */
export function suggestUsername(email: string): string {
  const base = email
    .split('@')[0]
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, 12);
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}${suffix}`;
}

/**
 * Validate a username: 3–20 chars, alphanumeric + underscores only.
 */
export function validateUsername(username: string): string | null {
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (username.length > 20) return 'Username must be 20 characters or less';
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return 'Username can only contain letters, numbers, and underscores';
  return null;
}
