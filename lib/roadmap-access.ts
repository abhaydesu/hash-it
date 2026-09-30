/**
 * The study roadmap is a personal feature of the owner, not part of the product.
 * Access is an email allowlist in ROADMAP_EMAILS (comma-separated, case-insensitive).
 * Unset or empty means nobody sees it.
 */
export function canSeeRoadmap(
  email: string | null | undefined,
  allowlist: string | undefined = process.env.ROADMAP_EMAILS
): boolean {
  if (!email || !allowlist) return false;
  const target = email.trim().toLowerCase();
  return allowlist
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(target);
}
