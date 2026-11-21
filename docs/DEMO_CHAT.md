# CraveLoop in a simulated LINE group — 3–4 minutes

This is a web simulation of a LINE-style group, not an actual LINE integration. No external messages are sent. Venue/menu/price evidence is synthetic. Previous web demo remains in DEMO.md.

1. **0:00–0:35:** Open `/`, create a group as May, and share its `/line/:id` URL with three independent browsers named Nat, Ploy and Ton. Send an ordinary greeting, then press **เพิ่ม CraveLoop เข้ากลุ่ม**. Show the actual persisted invitation and bot greeting.
2. **0:35–1:25:** Type each member's craving in their own composer. The limited helper labels its proposed draft as rules (not AI). Each member checks fields, edits as needed, and confirms. May: crispy/savory180; Nat: mild, exclude pork160; Ploy: brothy/chewy, vegetarian150; Ton: spicy200. Use the private photo drawer if desired; no image inference is claimed without configured live AI.
3. **1:25–1:55:** Host presses **หาให้หน่อย**. Inspect Flex-style cards inside chat: one real catalog menu assignment per member, cost + exact fee share, fit, formula and evidence.
4. **1:55–2:30:** May accepts r01, then Ton types `เปลี่ยนงบเหลือ110บาท`, reviews and confirms. Show new ranking version, all old acceptances cleared, r04 removed and r03 included. r01 remains the actual winner.
5. **2:30–3:10:** All four accept the same current option. Host presses **สรุปร้านนี้**. Bot publishes the actual unanimous decision. Copy summary; refresh one context to show persisted conversation and result.
6. **3:10–3:45:** Explain deterministic hard checks and60:40 preference fit. Show verified test results. This is a chat interface over the existing engine; no LINE channel/webhook, order or live venue discovery.

Literal sample inputs:

- May: `@CraveLoop อยากกินกรอบ ๆ รสกลมกล่อม งบ180`
- Nat: `@CraveLoop ไม่กินหมู ขอรสอ่อน งบ160`
- Ploy: `@CraveLoop กินมังสวิรัติ อยากกินน้ำซุปเส้นหนึบ งบ150`
- Ton: `@CraveLoop อยากกินเผ็ด งบ200`, later `@CraveLoop เปลี่ยนงบเหลือ110บาท`

The helper is intentionally conservative. Any missing cue can be set in the review drawer. Entering or changing a group message alone does not change a confirmed preference or imply consent.
