import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { validateMediaUrl } from "../../lib/media/contracts";
export function isPublicAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || b === 2)) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0)
    );
  }
  const lower = ip.toLowerCase();
  return (
    isIP(ip) === 6 &&
    !lower.startsWith("::") &&
    !/^(fc|fd|fe[89ab]|ff)/.test(lower) &&
    !lower.startsWith("2001:db8")
  );
}
export async function validatePublicUrl(value: string): Promise<string> {
  const valid = validateMediaUrl(value);
  const url = new URL(valid);
  if (url.port && url.port !== "443")
    throw new Error("O servidor aceita apenas HTTPS na porta 443.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((x) => !isPublicAddress(x.address)))
    throw new Error("Este destino de rede não é permitido.");
  return valid;
}
