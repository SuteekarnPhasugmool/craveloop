# CraveLoop — Group Order prototype

> CraveLoop helps groups turn different cravings, budgets and dietary needs into a restaurant and meal selection everyone can accept, then hands it off to the existing group-order cart.

CraveLoop is an independent mobile delivery prototype exploring a **ShopeeFood integration concept**: a group shares its needs, receives a workable catalog meal for every participant, agrees on one restaurant, then reviews a persistent **simulated cart and checkout summary**. It does not connect to ShopeeFood, LINE or a delivery platform, submit an order, take payment or issue an order number.

**All 12 restaurants, 60 menus, prices, distances, fees and dietary evidence are synthetic fixtures.** Deterministic TypeScript enforces confirmed constraints, computes integer-satang costs and ranks choices. The primary Group Order form is manual. With a configured server model, the private form can route a text turn into an editable draft. The member reviews ambiguous requirements separately and confirms before the ranker uses any changes.

## ลอง CraveLoop AI Chat Journey

กด **สร้างห้องแชต** บนแบนเนอร์ CraveLoop ที่หน้าแรก ใส่ชื่อแล้วส่งลิงก์จากแผงเชิญให้เพื่อน เปิดลิงก์คนละเครื่องหรือคนละโปรไฟล์เบราว์เซอร์ สมาชิกแต่ละคนเข้าร่วมมื้อด้วยชื่อของตัวเอง ห้องรองรับผู้ร่วมสั่งรวมผู้จัดสูงสุด 5 คน

1. ทุกคนเห็นข้อความที่ส่งในห้อง ลองพิมพ์ “อยากกินกรอบ ๆ งบ 200 บาท” ผู้ช่วยแบบกฎจะแปลงข้อความที่รู้จักเป็นร่างส่วนตัว ตรวจร่างและยืนยัน หรือเปิดฟอร์มเพื่อกำหนดเงื่อนไขเอง ห้องแบบนี้ใช้ได้โดยไม่ต้องตั้ง API key
2. เมื่อทุกคนพร้อม ผู้จัดกดค้นหาร้าน ระบบจัดอันดับจากแค็ตตาล็อกจำลอง ทุกคนกดยอมรับร้านเดียวกันแล้วผู้จัดสรุปร้าน
3. เมื่อสรุปร้าน สมาชิกจะออกจากแชตไปยังหน้าร้านที่ตกลงกันโดยอัตโนมัติ เปิดลิงก์ห้องเดิมอีกครั้งก็ไปถึงร้านเดิมได้ แต่ละคนเลือกอาหารหนึ่งจานจากเมนูที่ผ่านงบและข้อจำกัดของตน เปลี่ยนได้จนกว่าผู้จัดจะรวมตะกร้า
4. เมื่อเลือกครบ ผู้จัดเปิดตะกร้าร่วมและสรุป Checkout จำลอง ยอดรวมใช้ราคาจานที่เลือกจริงกับส่วนแบ่งค่าธรรมเนียม ห้องและตะกร้าเก็บในฐานข้อมูล

**ทดสอบผ่าน Wi-Fi** เปิด dev server ตามขั้นตอน Run locally แล้วเข้าเว็บผ่าน IP ของเครื่องที่รัน เช่น `http://192.168.1.20:3000` ใช้พอร์ตที่ Next แสดง เครื่องเพื่อนต้องเข้าถึง IP และพอร์ตนี้ได้ ในโหมด dev หน้าแชร์บน localhost จะเสนอลิงก์ LAN เมื่อพบ IP ภายใน ถ้าเครื่องมีหลายเครือข่ายให้เปิดหน้าแรกผ่าน IP ของ Wi-Fi ที่ต้องการ

**นำขึ้นเซิร์ฟเวอร์เดียว** ใช้ Node 22.12+ และดิสก์ถาวร ตั้ง `PERSISTENCE_DRIVER=sqlite`, `SQLITE_PATH` เป็นพาธบนดิสก์นั้น, `NEXT_PUBLIC_APP_URL` เป็น HTTPS origin จริง และ `APP_SECRET` เป็นค่าสุ่มถาวรอย่างน้อย 32 ตัวอักษร ตั้งก่อน build และใช้ค่าเดิมตอน start ติดตั้งด้วย `npm ci` จากนั้นรัน `npm run db:migrate && npm run seed && npm run build && npm start` จาก root ของโปรเจกต์ ให้ HTTPS reverse proxy ส่งต่อมายังพอร์ตของ Node สำหรับหลาย instance หรือโฮสต์ที่ไม่มีดิสก์ถาวร ให้ใช้ PostgreSQL ตามหัวข้อ deployment ด้านล่าง

## Primary flow

The delivery home also supports Thai searches across 22 public ShopeeFood category labels. The `shopeefood-demo-v1` discovery fixture pairs each label with one fictional shop and two priced dishes. Only the category labels and listing IDs were taken from the public page. Group Order ranks the separate `seed-v2` catalog. [ShopeeFood Thailand categories](https://shopee.co.th/m/ShopeeFoodCategories)

To add or refresh just the discovery sample in an existing database, run `npm run db:migrate` followed by `npm run seed -- --shopeefood-only`. For a fresh database, the normal `npm run seed` loads both catalogs. Category provenance is stored in `shopeefood_categories`, and `shopeefood_menu_categories` links each dish to its category. For example, this SQLite query lists the mock bubble tea menu in baht.

```sql
SELECT c.name_th, r.name AS restaurant, m.name AS dish,
       json_extract(m.channel_prices_satang, '$.delivery') / 100.0 AS baht
FROM shopeefood_categories c
JOIN shopeefood_menu_categories mc ON mc.listing_id = c.listing_id
JOIN menus m ON m.id = mc.menu_id
JOIN restaurants r ON r.id = m.restaurant_id
WHERE c.listing_id = '30970'
ORDER BY m.id;
```

In a private Group Order form, **อยากกินเส้น** records a broad noodle preference. Once the other selected participants have joined and confirmed, the server compares available noodle styles against the whole group's constraints. It asks a skippable question when the answer changes the recommended restaurants, their order or the member's assigned dish. Choosing an answer creates a draft for that member to confirm. The private room card also shows the recipe and product-label evidence behind a hidden ingredient rejection. [Three-person demo](docs/DEMO_GROUP_ORDER.md)

The home screen follows the supplied mobile-app reference: orange delivery/search header, a two-row shortcut rail, horizontal catalog/menu cards, concept banners and fixed bottom navigation. Search supports catalog names and Thai tag labels; category filters, menu details, the single demo-zone sheet and group-link recovery are functional. Prices are source fixture **food prices before fee allocation**, with no invented discount, review or sales claims. Group Order is the first shortcut; CraveLoop also has a direct entry below the shortcuts.

Open `/`, create a delivery group and share `/group/:sessionId` into independent browsers. Each person joins the group, **personally joins the meal**, reviews their own inclusive budget, cravings, hard exclusions, dietary requirements and allergies, then confirms. Being selected by the host is not consent.

The host ranks after every selected active participant has joined and confirmed. Cards show one catalog menu per person, exact item/fee/total costs and preference fit. A confirmed edit clears old acceptances and produces a fresh result when the closed meal remains ready. The result can truthfully remain unchanged.

Everyone accepts the same current restaurant. Host finalization records the group's decision; a separate host action creates a persistent simulated cart, and another action records its checkout summary. Both revalidate the current decision. Any preference/roster/mode invalidation makes the old cart unusable. **A checkout summary is not an order or payment.**

Host meal configuration is one atomic `/meal` operation: reopen, select actual active group members and confirm the shared `bangkok_demo` delivery zone. Opening/cancelling setup does not write. Retained people keep confirmed values and consent; newly selected people must opt in and confirm. Never silently remove a nonresponder.

The Group Order API hides private constraint-evidence fields from public result projections and reports generic no-match reason families. Peer preference forms, uploaded images and extraction drafts remain private. The group can see names, consent/readiness, assigned menus, costs, fit, acceptances and simulated cart items; menu choices can still imply preferences.

See the [Group Order API contracts](docs/GROUP_ORDER_CONTRACTS.md), [master spec](CRAVELOOP_MASTER_SPEC.md) and [local verification record](docs/VERIFICATION.md).

## Run locally

Use Node.js 22.12+ and npm. Preserve an existing configured `.env`.

```sh
npm install
# SQLite and manual preferences work with the development defaults.
# Set a private APP_SECRET for production; generate with: openssl rand -hex 32
npm run db:migrate
npm run seed
npm run dev
```

Open `http://localhost:3000`. For other devices set `NEXT_PUBLIC_APP_URL` to a reachable origin; use HTTPS outside localhost for secure cookies/clipboard and browser media features. Five active group members is the cap; `expectedSize:4` is a demo hint. Each browser's HttpOnly cookie identifies its seat. Clearing cookies loses that identity; no account recovery exists.

SQLite is a durable file at `.local/craveloop.sqlite`, with WAL and transactional writes. It survives reload/restart on one installation with persistent disk. It is not suitable for Vercel's ephemeral filesystem or shared multi-instance persistence. Run migrations again on existing installations: migration 004 adds the cart-handoff projection alongside the existing initial/chat/meal migrations.

Set a server-side `OPENAI_MODEL` and API key to enable AI drafts. CraveLoop uses `CRAVELOOP_OPENAI_API_KEY` when set, then falls back to `OPENAI_API_KEY`. Use the project-specific setting when your shell already supplies a key for a different project. Run `npm run ai:smoke` to verify live extraction with the bundled sample.

## Test and evaluate

```sh
npm run typecheck
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run eval
npm run kg:draft
# Stop dev/browser QA before building; do not run both against .next concurrently.
npm run build
npm start
```

Use disposable demo data for E2E. Integration tests use temporary SQLite. Playwright can bootstrap a local server or reuse one on port 3000 outside CI. Set `CI=1` to require a fresh server. To test a compiled build, run `npm run build` first, then set `NODE_ENV=production`, a private test `APP_SECRET` of at least 32 characters and a disposable `SQLITE_PATH` before starting Playwright. Set `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome. Ignored `test-results` and `playwright-report` can contain test conversation data.

`npm run eval` is offline: 34 authored fixtures, exact deterministic outcomes and assignment checks. It does not measure live extraction accuracy. `npm run ai:smoke` requires a supported vision/structured-output `OPENAI_MODEL` and server key. `npm run eval -- --live` explicitly invokes that configured provider on labeled samples. Fixture images are [self-authored illustrations](tests/fixtures/README.md), not a photo benchmark. No model is selected silently.

The [verification record](docs/VERIFICATION.md) includes the current test counts, three-policy evaluation and results from local browser runs. Real devices, PostgreSQL deployment and live model quality require separate verification.

## PostgreSQL/Supabase and deployment

1. Provision trusted PostgreSQL, optionally Supabase. Set `PERSISTENCE_DRIVER=postgres` and its server `DATABASE_URL`, with provider-required TLS/pooler settings. `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are unused placeholders; current persistence uses `pg`, not Supabase Storage/browser SDK.
2. Set a stable shared random `APP_SECRET` ≥32 characters and the real HTTPS `NEXT_PUBLIC_APP_URL`. Keep `CATALOG_MODE=synthetic`, `DEMO_MODE=true`. Never expose credentials through `NEXT_PUBLIC_`.
3. Run `npm run db:migrate` and `npm run seed` against the actual connection. To regenerate catalog JSON run `npx tsx scripts/generate-catalog.ts`; runtime rankings read that checked-in versioned seed, not SQL catalog edits.
4. Deploy the Node Next.js app. Vercel configuration rejects SQLite. A prepared adapter/migration is not a successful PostgreSQL deployment.
5. Schedule trusted `npm run cleanup`, for example every five minutes, using the same database configuration. The repo does not provision a scheduler or expose public cleanup.
6. Exercise the actual HTTPS three-person Group Order → replan → consensus → cart → checkout-summary path, stale-cart rejection, refresh, expiry and privacy. Smoke-test live AI separately if desired; record actual URL/revision/results without secrets.

## Correctness, privacy and limits

- Every mutation requires actor authorization and `Idempotency-Key`; conflicting key reuse is 409. Versioned actions require expected preference/roster versions; own preference edits also require member revision. Current ranking UUID matters even if versions/choices are identical.
- Hard constraints run before soft scores. Unknown prices/quotes fail finite budgets. Unsupported restrictions fail closed. Allergy eligibility requires explicit absence and cross-contact evidence; fictional fixture evidence is not medical safety certification.
- Delivery fees split in exact integer satang, floor plus remainder by ascending participating member ID. Group bystanders never subsidize fees or enter fairness/consensus. Rank is `0.6×mean+0.4×minimum`; it is a preference-fit heuristic, not measured happiness.
- Handoff/checkout require the current finalized unanimous delivery decision and known reconciled costs. One immutable quantity-one item/member; no editing quantities, discounts, shared dishes or payment split. Invalidation preserves stale cart history as unusable.
- Host/member tokens are server-HMAC-derived and stored as hashes. Invite URLs contain no member/host token. Cookies are HttpOnly/SameSite=Lax; Secure depends on configured HTTPS. No full identity/account recovery exists.
- Private uploads: JPEG/PNG/WebP, server-decoded single frame ≤1600 px and ≤5 MiB; text ≤2000 characters; mutation envelope ≤6 MiB. Images are server-only database data, not public attachments or Supabase Storage objects.
- Cleanup removes expired image bytes/input drafts and expired rooms. Cached extraction responses can retain derived draft/evidence until room deletion. Backups/provider logs have separate retention; OpenAI `store:false` is not universal erasure. Data is not application-encrypted.
- Rate limiting is process-local: 80 general mutations/minute or 8 extraction checks against the same room+cookie/IP counter. Reads are not rate-limited; public multi-instance hosting needs an ingress/distributed policy.
- Real platform SDKs, live discovery, merchant/order status, payments, video/reels scraping, accounts, multi-meal history and production abuse controls are outside this prototype. “Other options” means the current top-three set, not live discovery.

## Preserved experiences and evidence

`/legacy-line` retains the earlier simulated-chat landing; `/line/:id` remains its room UI. `/web` and `/s/:id` retain the original web experience. No real LINE bot/channel is involved. Legacy rooms without explicit meal metadata retain all-active-member compatibility. Legacy result views can expose relevant constraint evidence; the newer Group Order public projection has stricter disclosure.

[Demo script](docs/DEMO_GROUP_ORDER.md), [verification](docs/VERIFICATION.md), [Codex log](docs/CODEX_LOG.md), [current master](CRAVELOOP_MASTER_SPEC.md), [version 2 archive](docs/archive/CRAVELOOP_MASTER_SPEC.v2.0-2026-11-19.md).

`AI_PIPELINE_PLAN.md` is a separately authored future plan, unchanged by this implementation. The guided-choice implementation includes the private router adapter, reviewed ingredient graph and offline graph-drafting worker. The verification record identifies which checks used fixtures. Development on 18–20 November predates the recorded 21 November event; do not claim it was written during the competition or that a submission/deployment/partnership succeeded.
