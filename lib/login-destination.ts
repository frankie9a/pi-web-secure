/**
 * Where the login page may send the browser after a successful sign-in: the
 * same-origin location named by its `returnTo` query, or `/`.
 *
 * A leading `/` alone does not prove the target is local: the URL parser reads
 * `/\evil.example` and `/<TAB>/evil.example` as `//evil.example`, another host.
 * Resolve against the page origin and require the origin to be unchanged, so the
 * decision is made by the same parser the browser will use.
 *
 * Returns a relative `pathname + search + hash` (never an absolute URL) so the
 * result is safe both as a `location.replace()` argument and as a query value.
 */
export function safeLoginDestination(value: string | null, origin: string): string {
  if (!value || !value.startsWith("/")) return "/";
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return "/";
    const destination = `${url.pathname}${url.search}${url.hash}`;
    return destination.startsWith("//") ? "/" : destination;
  } catch {
    return "/";
  }
}
