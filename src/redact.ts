const TOKEN_PATTERNS = [
  /xox[a-z]-[A-Za-z0-9-]+/g,
  /xapp-[A-Za-z0-9-]+/g,
  /(authorization:\s*bearer\s+)[^\s]+/gi,
  /((?:password|passwd|token|secret|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi
];

export function redactSensitive(input: string): string {
  return TOKEN_PATTERNS.reduce((text, pattern) => {
    return text.replace(pattern, (_match: string, prefix?: string) => {
      return prefix ? `${prefix}<hidden>` : "<hidden>";
    });
  }, input);
}
