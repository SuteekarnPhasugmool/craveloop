import Database from "better-sqlite3";
import { Pool, type PoolClient } from "pg";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "./env";
import type { StoredSession } from "./state";
type Sqlite = InstanceType<typeof Database>;
const globalDb = globalThis as unknown as { clSqlite?: Sqlite; clPool?: Pool };
export function sqlite() {
  if (!globalDb.clSqlite) {
    const p = env().SQLITE_PATH;
    mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
    const db = new Database(p);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 10000");
    globalDb.clSqlite = db;
  }
  return globalDb.clSqlite;
}
export function pool() {
  return (globalDb.clPool ??= new Pool({
    connectionString: env().DATABASE_URL,
    max: 8,
  }));
}
export async function migrate() {
  const sql = readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
    .join("\n");
  if (env().driver === "postgres") {
    await pool().query(sql);
  } else {
    const localSql = sql
      .replace(/DO \$\$[\s\S]*?END \$\$;/g, "")
      .replace(/\buuid\b/g, "TEXT")
      .replace(/\bjsonb\b/g, "TEXT")
      .replace(/\btimestamptz\b/g, "TEXT")
      .replace(/\bboolean\b/g, "INTEGER")
      .replace(/\bdouble precision\b/g, "REAL");
    sqlite().exec(localSql);
  }
}
// Authoritative aggregate plus relational projections written in the SAME transaction.
// Postgres locks one room row; SQLite BEGIN IMMEDIATE serializes durable local writes.
async function writePg(c: PoolClient, s: StoredSession) {
  await c.query(
    "INSERT INTO sessions(id,area_id,mode,status,host_token_hash,preference_version,roster_version,current_ranking_id,finalized_option_id,expires_at,created_at,document) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET area_id=excluded.area_id,mode=excluded.mode,status=excluded.status,preference_version=excluded.preference_version,roster_version=excluded.roster_version,current_ranking_id=excluded.current_ranking_id,finalized_option_id=excluded.finalized_option_id,document=excluded.document",
    sessionValues(s),
  );
  await projections(
    s,
    async (q, v) => {
      await c.query(
        q.replace(
          /\?/g,
          (() => {
            let n = 0;
            return () => `$${++n}`;
          })(),
        ),
        v,
      );
    },
    true,
  );
}
function sessionValues(s: StoredSession) {
  return [
    s.id,
    s.areaId,
    s.mode,
    s.status,
    s.hostTokenHash,
    s.preferenceVersion,
    s.rosterVersion,
    s.currentRankingId,
    s.finalizedOptionId,
    s.expiresAt,
    s.createdAt,
    JSON.stringify(s),
  ];
}
function writeLocal(s: StoredSession) {
  const d = sqlite();
  d.prepare(
    "INSERT INTO sessions(id,area_id,mode,status,host_token_hash,preference_version,roster_version,current_ranking_id,finalized_option_id,expires_at,created_at,document) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET area_id=excluded.area_id,mode=excluded.mode,status=excluded.status,preference_version=excluded.preference_version,roster_version=excluded.roster_version,current_ranking_id=excluded.current_ranking_id,finalized_option_id=excluded.finalized_option_id,document=excluded.document",
  ).run(...sessionValues(s));
  projectionsLocal(s);
}
type Exec = (q: string, v: unknown[]) => Promise<void>;
function rows(s: StoredSession) {
  const j = JSON.stringify;
  const now = new Date().toISOString();
  return {
    cart_handoffs: s.handoff
      ? [
          [
            s.id,
            s.handoff.id,
            s.handoff.rankingId,
            s.handoff.status,
            s.handoff.preferenceVersion,
            s.handoff.rosterVersion,
            s.handoff.totalSatang,
            j(s.handoff),
            s.handoff.createdAt,
          ],
        ]
      : [],
    members: s.members.map((m) => [
      m.id,
      s.id,
      m.displayName,
      m.tokenHash,
      m.active,
      m.confirmed,
      m.createdAt,
    ]),
    meal_settings: s.chat?.meal ? [[s.id, s.chat.meal.phase]] : [],
    meal_participants: (s.chat?.meal?.selectedMemberIds ?? []).map((id) => [
      s.id,
      id,
      s.chat!.meal!.joinedMemberIds.includes(id),
    ]),
    chat_messages: (s.chat?.messages ?? []).map((m) => [
      m.id,
      s.id,
      m.memberId,
      m.kind,
      m.text,
      m.createdAt,
      m.rankingId ?? null,
    ]),
    inputs: s.inputs.map((i) => [
      i.id,
      s.id,
      i.memberId,
      i.kind,
      i.text,
      i.imageDataUrl ? `private-db:${i.id}` : null,
      i.inputRevision,
      i.state,
      i.createdAt,
    ]),
    preferences: s.members
      .filter((m) => m.preference)
      .map((m) => {
        const p = m.preference!;
        return [
          m.id,
          s.id,
          m.revision,
          j(p.cuisinePreferences),
          j(p.flavorTags),
          j(p.textureTags),
          j(p.dislikes),
          p.budgetMaxSatang,
          j(p.excludedIngredients),
          j(p.dietaryRequirements),
          j(p.allergies),
          now,
          null,
        ];
      }),
    rankings: s.rankings.map((r) => [
      r.id,
      s.id,
      r.preferenceVersion,
      r.rosterVersion,
      r.catalogVersion,
      r.status,
      j(r.options),
      j(r.rejections),
      r.createdAt,
    ]),
    acceptances: s.acceptances.map((a) => [
      s.id,
      a.memberId,
      a.rankingId,
      a.restaurantId,
      now,
    ]),
    events: s.events.map((e) => [
      e.id,
      s.id,
      e.type,
      e.version,
      j(e.payload),
      e.createdAt,
    ]),
    tool_runs: s.runs.map((r) => [
      r.id,
      s.id,
      r.name,
      r.snapshotVersion,
      r.status,
      r.durationMs,
      j(r.evidenceIds),
      r.errorCode ?? null,
      r.createdAt,
    ]),
    idempotency_keys: Object.entries(s.requests).map(([key, r]) => [
      s.id,
      key.split(":")[0],
      key,
      r.hash,
      j(r.response),
      s.expiresAt,
    ]),
  };
}
const deletion = [
  "cart_handoffs",
  "meal_participants",
  "meal_settings",
  "chat_messages",
  "acceptances",
  "preferences",
  "inputs",
  "rankings",
  "members",
  "events",
  "tool_runs",
  "idempotency_keys",
];
const columns: Record<string, string> = {
  cart_handoffs:
    "session_id,id,ranking_id,status,preference_version,roster_version,total_satang,document,created_at",
  meal_settings: "session_id,phase",
  meal_participants: "session_id,member_id,joined",
  chat_messages: "id,session_id,member_id,kind,text,created_at,ranking_id",
  members:
    "id,session_id,display_name,member_token_hash,active,confirmed,created_at",
  inputs:
    "id,session_id,member_id,kind,raw_text,private_storage_key,input_revision,state,created_at",
  preferences:
    "member_id,session_id,revision,cuisine_preferences,flavor_tags,texture_tags,dislikes,budget_max_satang,excluded_ingredients,dietary_requirements,allergies,confirmed_at,source_input_id",
  rankings:
    "id,session_id,preference_version,roster_version,catalog_version,status,options,rejections,created_at",
  acceptances: "session_id,member_id,ranking_id,restaurant_id,accepted_at",
  events: "id,session_id,event_type,version,payload,created_at",
  tool_runs:
    "id,session_id,name,snapshot_version,status,duration_ms,evidence_ids,error_code,created_at",
  idempotency_keys:
    "session_id,actor_id,key,request_hash,response_json,expires_at",
};
async function projections(s: StoredSession, exec: Exec, _pg: boolean) {
  for (const table of deletion)
    await exec(`DELETE FROM ${table} WHERE session_id=?`, [s.id]);
  for (const [table, values] of Object.entries(rows(s)))
    for (const v of values)
      await exec(
        `INSERT INTO ${table}(${columns[table]}) VALUES(${v.map(() => "?").join(",")})`,
        v,
      );
}
function projectionsLocal(s: StoredSession) {
  const d = sqlite();
  for (const table of deletion)
    d.prepare(`DELETE FROM ${table} WHERE session_id=?`).run(s.id);
  for (const [table, values] of Object.entries(rows(s)))
    for (const v of values)
      d.prepare(
        `INSERT INTO ${table}(${columns[table]}) VALUES(${v.map(() => "?").join(",")})`,
      ).run(...v.map((x) => (typeof x === "boolean" ? Number(x) : x)));
}
export async function readSession(id: string): Promise<StoredSession | null> {
  if (env().driver === "postgres") {
    const r = await pool().query("SELECT document FROM sessions WHERE id=$1", [
      id,
    ]);
    return r.rows[0]?.document ?? null;
  }
  const row = sqlite()
    .prepare("SELECT document FROM sessions WHERE id=?")
    .get(id) as { document: string } | undefined;
  return row ? JSON.parse(row.document) : null;
}
export async function transact<T>(
  id: string,
  fn: (s: StoredSession | null) => { session: StoredSession; result: T },
): Promise<T> {
  if (env().driver === "postgres") {
    const c = await pool().connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        id,
      ]);
      const r = await c.query(
        "SELECT document FROM sessions WHERE id=$1 FOR UPDATE",
        [id],
      );
      const { session, result } = fn(r.rows[0]?.document ?? null);
      await writePg(c, session);
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  const d = sqlite();
  return d
    .transaction(() => {
      const row = d
        .prepare("SELECT document FROM sessions WHERE id=?")
        .get(id) as { document: string } | undefined;
      const { session, result } = fn(row ? JSON.parse(row.document) : null);
      writeLocal(session);
      return result;
    })
    .immediate();
}
export async function closeDatabase() {
  globalDb.clSqlite?.close();
  globalDb.clSqlite = undefined;
  if (globalDb.clPool) {
    await globalDb.clPool.end();
    globalDb.clPool = undefined;
  }
}
