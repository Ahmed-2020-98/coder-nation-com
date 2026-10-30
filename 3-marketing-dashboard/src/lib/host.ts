// Pure helper (no Node or server-only imports) shared by proxy.ts and the API guard.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function hostnameOf(value: string): string {
  // "localhost:3001" -> "localhost", "[::1]:3001" -> "[::1]"
  return value.startsWith("[") ? value.slice(0, value.indexOf("]") + 1) : value.split(":")[0];
}

/** True for localhost / 127.0.0.1 / [::1], with or without a port. Anything else (LAN IP, a rebound domain) is refused. */
export function isLocalHost(host: string | null | undefined): boolean {
  return Boolean(host) && LOCAL_HOSTS.has(hostnameOf(host as string).toLowerCase());
}
