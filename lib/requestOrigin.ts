// Next may normalize req.nextUrl to an internal hostname behind a proxy.
// Compare the browser's Origin with the public HTTP Host, not that internal URL.
export function hasSameOrigin(headers: Headers): boolean {
  const origin = headers.get('origin');
  const host = headers.get('host');
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && url.origin === origin && url.host === host;
  } catch {
    return false;
  }
}
