import type { NextRequest } from "next/server";
import { handle } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function route(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return handle(req, (await ctx.params).path);
}
export {
  route as GET,
  route as POST,
  route as PUT,
  route as PATCH,
  route as DELETE,
};
