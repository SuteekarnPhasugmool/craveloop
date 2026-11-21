# Group Order concept — 3–4 minute demonstration

## Guided noodle choice and ingredient evidence

Use the synthetic `seed-v2` catalog, `fit-60-40-v3` ranker and `thai-ingredients-v1` graph. Start the app with the migration, seed and dev commands in the README. Use three independent browser profiles so each person has their own cookie. This walkthrough works offline without OpenAI credentials.

1. May creates a Group Order from the home screen. Nat and Ploy open the invite. All three join the group and tap **เข้าร่วมมื้อนี้**.
2. Nat and Ploy each confirm a ฿120 inclusive budget and leave the other fields empty. May enters the same budget, types `shrimp` in **วัตถุดิบที่ไม่กิน**, and taps **อยากกินเส้น**. With the peers' constraints confirmed, the form offers **เส้นน้ำ**, **เส้นผัด**, **ได้ทั้งคู่** and **ข้าม**. Choose **ข้าม**, check the confirmation box and save.
3. May searches and opens **ทำไมบางเมนูจึงถูกตัดออกสำหรับฉัน**. The recipe for `r03-m03` identifies paste X, and product label X identifies shrimp. Show the two fact IDs and their source scopes in May's private view. Nat and Ploy see their own results. May accepts the first restaurant and notes its name.
4. May opens **แก้ความต้องการของฉัน**. The broad noodle preference survived skipping. Choose **เส้นน้ำ**. The vote and published result stay in place while May reviews the draft. Check the box and confirm. Compare the new first restaurant and May's assignment, and show that the old vote has cleared.
5. Everyone accepts the new first restaurant. May finalizes and opens the simulated cart. Check the three items and their fee-inclusive totals, then open the checkout summary.

Run `npm run test:e2e -- tests/e2e/group-order.spec.ts` to repeat the browser cases and `npm run eval` to compare the three question policies on the same two authored scenarios. The second scenario has both styles available and keeps the same assignments and restaurant order under either answer. Only scores change, so the form can proceed directly to confirmation.

20 November 2026 · Bangkok. **Independent ShopeeFood integration concept; no platform connection, real order, payment or order number. All catalog facts and cart costs are synthetic.** This is a prepared script, not evidence of a timed rehearsal or hosted demonstration.

Prepare **three independent browser contexts** named May, Nat and Ploy and a running migrated/seeded app. Keep simulation labels visible. Group creation, individual opt-in, confirmation and acceptance must be actual persistent operations. For a short slot, pre-open the two invite pages and fill but do not secretly pre-confirm people.

| Elapsed   | Action                                                                                                   | Observable evidence / wording                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:25 | Open `/`, create a delivery group and share `/group/:id`; Nat and Ploy join.                             | “เราเป็น concept การตัดสินใจสั่งอาหารร่วมกัน ร้านและราคาในเดโมเป็นข้อมูลจำลอง ยังไม่เชื่อม ShopeeFood จริง”                                                        |
| 0:25–1:00 | Each selected person personally joins the meal, opens their own form and confirms the values below.      | Host selection is not consent; pending people remain in readiness. Hard exclusions/allergies differ from soft dislikes.                            |
| 1:00–1:35 | Host searches; inspect restaurant and personal assignments.                                              | Show actual catalog IDs, one menu per person, item + allocated fee = total, and group mean/minimum/composite. No fabricated AI animation.          |
| 1:35–2:05 | May accepts; one member changes their own budget and confirms.                                           | Fresh version/ranking, old acceptance cleared. Use a genuinely binding edit to demonstrate changed options, or truthfully show unchanged feedback. |
| 2:05–2:35 | All three personally accept the same current option; host finalizes.                                     | Decision screen means unanimous consent, not an order. Show refresh persistence if time permits.                                                   |
| 2:35–3:10 | Host creates the separate simulated cart, checks all three item/fee totals, then opens checkout summary. | Persistent cart ID and exact totals; “สรุป checkout จำลอง ยังไม่ได้สั่งอาหารหรือชำระเงิน”. No fake provider success or order number.                       |
| 3:10–3:45 | Explain deterministic constraints/60:40, actual verification and limitations.                            | Optional AI understands drafts only when actually configured/tested; local contexts are not hosted venue devices.                                  |

## Current three-person demo values

| Person | Explicitly confirmed fields                    |
| ------ | ---------------------------------------------- |
| May    | Spicy; maximum ฿180                            |
| Nat    | Mild; hard exclude `pork`; maximum ฿150        |
| Ploy   | Dietary requirement `vegetarian`; maximum ฿120 |

Use the current synthetic catalog and ranker. With a 4,000-satang synthetic delivery quote, three participants receive shares 1,334 / 1,333 / 1,333 by ascending member ID, exactly reconciling to 4,000. The member receiving the extra satang depends on the actual stored IDs.

The API's `expectedSize:4` is a historical hint, not a requirement to have four participants. This demo deliberately has three people, all of whom must join, confirm and accept for this meal.

The primary flow is manual-first. If demonstrating the private image form, use your own licensed image or `tests/fixtures/crispy.png` (authored illustration). Without configured and smoke-tested AI, explicitly say the image is saved privately and tags are manually entered. Never present the rule helper or an illustration fixture as a live model response.

## Optional failure demonstrations, outside the timed core

- Set your own inclusive budget to zero and confirm: actual no-match, generic constraint reason families, no invented candidate. Restore your own budget; previous exclusions remain.
- Open/cancel host meal configuration: ranking, votes and cart remain unchanged. Confirming a changed roster atomically reopens and invalidates old agreement/cart; newly selected people must personally join and confirm.
- After a cart exists, host reconfigures or reopens: show the old handoff is invalidated, and stale cart/checkout API calls cannot produce a usable result. Rerank, unanimous acceptance and finalization are required again.
- A nonbinding preference edit can return the same menus, prices and scores; show fresh calculation feedback instead of repeatedly searching for random alternatives.

## Claims to avoid

No real ShopeeFood/LINE integration, merchant inventory, live quotes, safety certification, order placement, payment, delivery tracking, measured time savings, user adoption, partnership, competition submission or winning probability. Show test counts only from the actual current [verification record](VERIFICATION.md); historical 98/45/6 counts do not verify the newly added Group Order path. Real PostgreSQL, deployment and live AI remain unverified unless subsequent evidence explicitly records them.

Prepared pitch: “CraveLoop ให้ทุกคนยืนยันข้อจำกัดและงบของตัวเอง โค้ดเลือกเมนูที่ทำได้จริงใน catalog ให้ครบทุกคน แล้วใช้ 60% ค่าเฉลี่ยกับ 40% คะแนนต่ำสุดช่วยเปรียบเทียบ ทุกคนต้องยอมรับตัวเลือกปัจจุบันเดียวกันก่อนสรุป จากนั้นจึงส่งต่อเป็นตะกร้าและ checkout จำลองที่เก็บสถานะจริง โดยยังไม่มีการเรียกแพลตฟอร์มหรือชำระเงินครับ”
