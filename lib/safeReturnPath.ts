export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return '/';
  try {
    const url = new URL(value, 'https://dashboard.invalid');
    if (url.origin !== 'https://dashboard.invalid' || url.pathname === '/login'
      || url.pathname.startsWith('/api/')) return '/';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}
