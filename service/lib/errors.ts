export function mapGmoError(e: unknown) {
  const s = String(e instanceof Error ? e.message : e || '');
  // Try to detect known codes from error text
  const m = s.match(/ERR-[0-9]+/);
  const code = m ? m[0] : undefined;
  switch (code) {
    case 'ERR-201':
      return 'Insufficient funds (ERR-201)';
    case 'ERR-760':
      return 'No prices are changed (ERR-760)';
    case 'ERR-5003':
      return 'Rate limit exceeded (ERR-5003)';
    case 'ERR-5008':
    case 'ERR-5009':
      return 'Timestamp skew detected (ERR-5008/5009). Ensure clock sync.';
    case 'ERR-761':
      return 'Order rate exceeds price limit range (ERR-761). Check price bounds.';
    default:
      return s || String(e);
  }
}
