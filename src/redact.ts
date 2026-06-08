const TOKEN_PATTERNS = [
  /xox[a-z]-[A-Za-z0-9-]+/gi,
  /xapp-[A-Za-z0-9-]+/gi,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g
];

const PRIVATE_KEY_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
const BEARER_PATTERN = /\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi;
const AUTHORIZATION_BEARER_PATTERN = /(authorization:\s*bearer\s+)[^\s]+/gi;
const LABELED_SECRET_PATTERN =
  /\b((?:password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key|client[_-]?secret)\s*[=:]\s*)("[^"\n]*"|'[^'\n]*'|`[^`\n]*`|[^\s,;]+)/gi;

export function redactSensitive(input: string): string {
  const withoutKeyBlocks = input.replace(PRIVATE_KEY_PATTERN, "<hidden private key>");
  const withoutLabeledSecrets = withoutKeyBlocks
    .replace(AUTHORIZATION_BEARER_PATTERN, "$1<hidden>")
    .replace(BEARER_PATTERN, "$1<hidden>")
    .replace(LABELED_SECRET_PATTERN, "$1<hidden>");

  return TOKEN_PATTERNS.reduce((text, pattern) => {
    return text.replace(pattern, (_match: string, prefix?: string) => {
      return prefix ? `${prefix}<hidden>` : "<hidden>";
    });
  }, withoutLabeledSecrets);
}
