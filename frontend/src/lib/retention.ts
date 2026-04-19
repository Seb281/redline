/**
 * SP-5 retention helpers.
 *
 * The backend is the source of truth for whether an analysis is still
 * active — the frontend only formats the `expires_at` timestamp into
 * a human-readable countdown for the history UI. Keeping this logic
 * here (not inline in the page) so the label rules can be unit tested
 * without rendering React.
 */

export interface RetentionStatus {
  /** True when the analysis has the never-expire flag set. */
  pinned: boolean;
  /** True when the (unpinned) analysis has passed its expiry. */
  expired: boolean;
  /** Whole days remaining until expiry (clamped at 0). */
  daysRemaining: number;
  /** User-facing label for the expiry pill. */
  label: string;
}

/**
 * Derive the retention pill copy from the raw list-item fields.
 *
 * `now` is injectable so tests can assert stable copy across dates.
 * In production the caller passes `new Date()` (or omits the
 * argument, which resolves to the same thing).
 */
export function getRetentionStatus(
  expiresAt: string | null | undefined,
  pinned: boolean | undefined,
  now: Date = new Date(),
): RetentionStatus {
  if (pinned) {
    return {
      pinned: true,
      expired: false,
      daysRemaining: Infinity,
      label: "Pinned",
    };
  }

  if (!expiresAt) {
    // Pre-SP-5 row without a migration — treat as "no expiry set"
    // rather than flagging as expired. Should only show up on stale
    // local caches or non-migrated databases.
    return {
      pinned: false,
      expired: false,
      daysRemaining: Infinity,
      label: "No expiry",
    };
  }

  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.ceil(diffMs / dayMs);

  if (diffMs <= 0) {
    return { pinned: false, expired: true, daysRemaining: 0, label: "Expired" };
  }

  if (days <= 1) {
    return {
      pinned: false,
      expired: false,
      daysRemaining: days,
      label: "Expires today",
    };
  }

  return {
    pinned: false,
    expired: false,
    daysRemaining: days,
    label: `Expires in ${days} days`,
  };
}
