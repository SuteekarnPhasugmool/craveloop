import "dotenv/config";
import { sqlite, pool, transact, closeDatabase } from "../src/server/database";
import { env } from "../src/server/env";
const isPg = env().driver === "postgres";
const ids = isPg
  ? (await pool().query("SELECT id FROM sessions")).rows
  : (sqlite().prepare("SELECT id FROM sessions").all() as { id: string }[]);
let deleted = 0,
  images = 0;
for (const { id } of ids) {
  await transact(id, (s) => {
    if (!s) throw new Error("Session disappeared during cleanup");
    for (const member of s.members) {
      for (const kind of ["image", "voice"] as const) {
        const media = member.media?.[kind];
        if (media && Date.parse(media.expiresAt) <= Date.now()) delete member.media![kind];
      }
    }
    for (const i of s.inputs)
      if (
        i.imageDataUrl &&
        Date.parse(i.imageExpiresAt ?? s.expiresAt) <= Date.now()
      ) {
        delete i.imageDataUrl;
        delete i.draft;
        delete i.draftId;
        images++;
      }
    return { session: s, result: null };
  });
  if (isPg) {
    const r = await pool().query(
      "DELETE FROM sessions WHERE id=$1 AND expires_at<NOW()",
      [id],
    );
    deleted += r.rowCount ?? 0;
  } else
    deleted += sqlite()
      .prepare("DELETE FROM sessions WHERE id=? AND expires_at<?")
      .run(id, new Date().toISOString()).changes;
}
console.log({ expiredRoomsDeleted: deleted, expiredImagesDeleted: images });
await closeDatabase();
