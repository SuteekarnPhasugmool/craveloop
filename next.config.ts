import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

const lanHosts = Object.values(networkInterfaces()).flatMap((addresses) =>
  (addresses ?? [])
    .filter(
      (a) =>
        !a.internal &&
        a.family === "IPv4" &&
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address),
    )
    .map((a) => a.address),
);
const config: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: lanHosts,
  env: {
    DEV_LAN_HOSTS:
      process.env.NODE_ENV === "development" ? lanHosts.join(",") : "",
    NEXT_PUBLIC_DEV_LAN_HOST:
      process.env.NODE_ENV === "development" ? (lanHosts[0] ?? "") : "",
  },
};
export default config;
