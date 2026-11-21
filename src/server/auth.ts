import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { env } from "./env";
let localSecret: string | undefined;
function secret() {
  if (env().APP_SECRET) return env().APP_SECRET!;
  if (!localSecret) {
    mkdirSync(".local", { recursive: true, mode: 0o700 });
    try {
      localSecret = readFileSync(".local/secret", "utf8");
    } catch {
      try {
        writeFileSync(".local/secret", randomBytes(32).toString("hex"), {
          mode: 0o600,
          flag: "wx",
        });
      } catch {}
      localSecret = readFileSync(".local/secret", "utf8");
    }
  }
  return localSecret;
}
export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function derive(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}
export function stableId(value: string) {
  const h = derive(value);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function matches(token: string | undefined, hashed: string) {
  if (!token) return false;
  const actual = hash(token);
  return (
    actual.length === hashed.length &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(hashed))
  );
}
export const cookieName = (id: string) => `cl_${id}`;
