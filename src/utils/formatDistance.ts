/**
 * Format a distance in meters to a human-readable string.
 * e.g. 450 → "~450 m", 2500 → "~2.5 km"
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `~${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `~${km % 1 === 0 ? km.toFixed(0) : km.toFixed(1)} km`;
}

/**
 * Format timestamp to relative time string.
 * e.g. "2 hours ago", "Yesterday"
 */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}
