/** Fail on missing persistence/secrets at server boot, before accepting requests. */
export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { env } = await import("./src/server/env");
    env();
  }
}
