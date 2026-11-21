import type { NextRequest } from "next/server";
import { handle } from "@/server/http";
export const runtime = "nodejs";
export const POST = (req: NextRequest) => handle(req);
