import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import type { SessionView } from "../../src/contracts";
async function state(page: Page): Promise<SessionView> {
  return page.evaluate(async () => {
    const id = location.pathname.split("/").pop();
    return (await (await fetch(`/api/sessions/${id}`)).json()).data;
  });
}
async function fresh(page: Page) {
  await page.bringToFront();
  const s = await state(page);
  await expect(page.getByTestId("group-version")).toHaveText(
    `${s.preferenceVersion}/${s.rosterVersion}`,
  );
  return s;
}
async function preferences(
  page: Page,
  budget: string,
  options: {
    exclude?: string;
    diet?: string;
    tags?: string[];
    editing?: boolean;
  } = {},
) {
  await fresh(page);
  await page
    .getByRole("button", {
      name: options.editing ? "แก้ความต้องการของฉัน" : "กรอกความต้องการของฉัน",
      exact: true,
    })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "ความต้องการของฉัน" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("งบสูงสุด (บาท)").fill(budget);
  if (options.exclude !== undefined)
    await dialog.getByLabel("วัตถุดิบที่ไม่กิน").fill(options.exclude);
  if (options.diet !== undefined)
    await dialog.getByLabel("ข้อกำหนดอาหาร", { exact: true }).fill(options.diet);
  for (const tag of options.tags ?? []) {
    const button = dialog.getByRole("button", { name: tag, exact: true });
    if ((await button.getAttribute("aria-pressed")) !== "true")
      await button.click();
  }
  await dialog
    .getByRole("checkbox", { name: "ตรวจสอบและยืนยันข้อมูลของฉัน" })
    .check();
  await dialog
    .getByRole("button", { name: "ยืนยันความต้องการ", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
}
test("three independent Group Order members recover no-match, agree on catalog meals and persist simulated cart/checkout", async ({
  browser,
  baseURL,
}) => {
  const contexts: BrowserContext[] = [],
    pages: Page[] = [],
    errors: string[] = [];
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    contexts.push(context);
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    pages.push(page);
  }
  try {
    const [host, nat, ploy] = pages;
    await host.goto("/");
    await host
      .getByRole("button", { name: "เริ่ม Group Order", exact: true })
      .click();
    await host
      .getByRole("button", { name: "ให้ CraveLoop ช่วยเลือก", exact: true })
      .click();
    await host.getByLabel("ชื่อของคุณ").fill("May");
    await host
      .getByRole("button", { name: "สร้าง Group Order", exact: true })
      .click();
    await host.waitForURL("**/group/**");
    const url = host.url();
    expect((await state(host)).experience).toBe("group_order");
    expect((await state(host)).meal!.joinedMemberIds).toEqual([]);
    for (const [page, name] of [
      [nat, "Nat"],
      [ploy, "Ploy"],
    ] as const) {
      await page.goto(url);
      await page.getByLabel("ชื่อของคุณ").fill(name);
      await page
        .getByRole("button", { name: "เข้าร่วม Group Order", exact: true })
        .click();
      await expect(page.getByTestId("group-version")).toBeVisible();
    }
    await fresh(host);
    expect((await state(host)).meal!.selectedMemberIds).toHaveLength(3);
    expect((await state(host)).meal!.joinedMemberIds).toEqual([]);
    for (const page of pages) {
      await fresh(page);
      await page
        .getByRole("button", { name: "เข้าร่วมมื้อนี้", exact: true })
        .click();
      await expect
        .poll(async () =>
          (await state(page)).meal!.joinedMemberIds.includes(
            (await state(page)).me!.id,
          ),
        )
        .toBe(true);
    }
    await preferences(host, "180", { tags: ["เผ็ด"] });
    await preferences(nat, "150", { exclude: "pork", tags: ["รสอ่อน"] });
    await fresh(host);
    await expect(
      host.getByRole("button", { name: "ค้นหาร้านสำหรับกลุ่ม", exact: true }),
    ).toBeDisabled();
    await preferences(ploy, "0", { diet: "vegetarian" });
    await fresh(host);
    await host
      .getByRole("button", { name: "ค้นหาร้านสำหรับกลุ่ม", exact: true })
      .click();
    await expect(host.getByTestId("group-no-match")).toBeVisible();
    const noMatch = await state(host);
    expect(noMatch.ranking!.status).toBe("no_match");
    expect(noMatch.ranking!.options).toEqual([]);
    await preferences(ploy, "120", { editing: true });
    expect((await state(ploy)).me!.preference!.dietaryRequirements).toEqual([
      "vegetarian",
    ]);
    await fresh(host);
    await expect(host.getByTestId("group-option-r01")).toBeVisible();
    const ranked = await state(host);
    expect(ranked.ranking!.id).not.toBe(noMatch.ranking!.id);
    expect(ranked.ranking!.status).toBe("ok");
    for (const option of ranked.ranking!.options) {
      expect(option.assignments).toHaveLength(3);
      expect(new Set(option.assignments.map((a) => a.memberId)).size).toBe(3);
      expect(
        option.assignments.reduce((n, a) => n + a.allocatedFeeSatang!, 0),
      ).toBe(4000);
      for (const assignment of option.assignments) {
        expect(assignment.menuId).toMatch(
          new RegExp(`^${option.restaurantId}-m`),
        );
        expect(
          assignment.itemCostSatang! + assignment.allocatedFeeSatang!,
        ).toBe(assignment.totalCostSatang);
        expect(assignment.constraintEvidence ?? []).toEqual([]);
      }
    }
    await host
      .getByTestId("group-option-r01")
      .getByRole("button", { name: "ยอมรับร้านนี้", exact: true })
      .click();
    await expect
      .poll(async () => (await state(host)).acceptances.length)
      .toBe(1);
    const beforeSetup = await state(host);
    await host
      .getByRole("button", { name: "จัดการผู้ร่วมสั่ง", exact: true })
      .click();
    const setup = host.getByRole("dialog", { name: "จัดการผู้ร่วมสั่ง" });
    await expect(setup).toBeVisible();
    let unchanged = await state(host);
    expect(unchanged.ranking!.id).toBe(beforeSetup.ranking!.id);
    expect(unchanged.acceptances).toEqual(beforeSetup.acceptances);
    await setup
      .getByRole("button", { name: "ปิดการจัดการผู้ร่วมสั่ง", exact: true })
      .click();
    await expect(setup).toHaveCount(0);
    unchanged = await state(host);
    expect(unchanged.ranking!.id).toBe(beforeSetup.ranking!.id);
    expect(unchanged.acceptances).toEqual(beforeSetup.acceptances);
    expect([unchanged.preferenceVersion, unchanged.rosterVersion]).toEqual([
      beforeSetup.preferenceVersion,
      beforeSetup.rosterVersion,
    ]);
    await preferences(host, "175", { editing: true });
    await fresh(host);
    const replanned = await state(host);
    expect(replanned.ranking!.id).not.toBe(ranked.ranking!.id);
    expect(replanned.ranking!.update!.outcome).toBe("unchanged");
    expect(replanned.acceptances).toEqual([]);
    expect(replanned.me!.preference!.flavorTags).toEqual(["spicy"]);
    await expect(host.getByTestId("group-update")).toBeVisible();
    await expect(host.getByTestId("group-update")).toContainText(/เหมือนเดิม/);
    const stale = await host.evaluate(
      async ({ oldRankingId, current }) => {
        const id = location.pathname.split("/").pop();
        const response = await fetch(`/api/sessions/${id}/acceptance/me`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            rankingId: oldRankingId,
            restaurantId: "r01",
            expectedPreferenceVersion: current.preferenceVersion,
            expectedRosterVersion: current.rosterVersion,
          }),
        });
        return { status: response.status, body: await response.json() };
      },
      {
        oldRankingId: ranked.ranking!.id,
        current: {
          preferenceVersion: replanned.preferenceVersion,
          rosterVersion: replanned.rosterVersion,
        },
      },
    );
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_RANKING");
    await Promise.all(
      pages.map(async (page) => {
        await fresh(page);
        await page
          .getByTestId("group-option-r01")
          .getByRole("button", { name: "ยอมรับร้านนี้", exact: true })
          .click();
      }),
    );
    await fresh(host);
    const finalize = host
      .getByTestId("group-option-r01")
      .getByRole("button", { name: "สรุปร้านนี้", exact: true });
    await expect(finalize).toBeEnabled();
    await finalize.click();
    await expect.poll(async () => (await state(host)).status).toBe("finalized");
    await host
      .getByRole("button", { name: "ส่งต่อไปยังตะกร้าจำลอง", exact: true })
      .click();
    await expect(host.getByTestId("group-cart")).toBeVisible();
    const cart = (await state(host)).handoff!;
    expect(cart.status).toBe("cart");
    expect(cart.simulated).toBe(true);
    expect(cart.restaurantId).toBe("r01");
    expect(cart.items).toHaveLength(3);
    expect(cart.allocatedFeesSatang).toBe(4000);
    expect(cart.items.reduce((n, i) => n + i.totalCostSatang, 0)).toBe(
      cart.totalSatang,
    );
    expect(cart.totalSatang).toBe(
      cart.subtotalSatang + cart.allocatedFeesSatang,
    );
    expect(cart).not.toHaveProperty("orderId");
    expect(cart).not.toHaveProperty("paymentId");
    const duplicateCarts = await host.evaluate(async (cart) => {
      const id = location.pathname.split("/").pop(),
        key = crypto.randomUUID();
      return Promise.all(
        [key, key, crypto.randomUUID()].map(async (requestKey) => {
          const response = await fetch(`/api/sessions/${id}/handoff`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": requestKey,
            },
            body: JSON.stringify({
              rankingId: cart.rankingId,
              restaurantId: cart.restaurantId,
              expectedPreferenceVersion: cart.preferenceVersion,
              expectedRosterVersion: cart.rosterVersion,
            }),
          });
          const body = await response.json();
          return { status: response.status, id: body.data?.handoff?.id };
        }),
      );
    }, cart);
    expect(duplicateCarts).toEqual(
      Array.from({ length: 3 }, () => ({ status: 200, id: cart.id })),
    );
    await host
      .getByRole("button", { name: "ดูสรุป Checkout จำลอง", exact: true })
      .click();
    await expect(host.getByTestId("group-checkout")).toBeVisible();
    await expect(host.getByTestId("group-checkout")).toContainText(
      "ยังไม่ได้สร้างคำสั่งซื้อหรือชำระเงิน",
    );
    const checkout = (await state(host)).handoff!;
    expect(checkout.id).toBe(cart.id);
    expect(checkout.status).toBe("checkout_summary");
    expect(checkout.checkoutAt).toEqual(expect.any(String));
    for (const page of pages) {
      await page.reload();
      await fresh(page);
      const restored = await state(page);
      expect(restored.me).not.toBeNull();
      expect(restored.handoff).toEqual(checkout);
      expect(restored.acceptances).toHaveLength(3);
      await expect(page.getByTestId("group-checkout")).toBeVisible();
    }
    expect(
      new Set(
        await Promise.all(
          pages.map(async (page) => (await state(page)).me!.id),
        ),
      ).size,
    ).toBe(3);
    expect(errors).toEqual([]);
    expect(
      await host.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await host.screenshot({
      path: "test-results/group-order-checkout-mobile.png",
      fullPage: true,
    });
  } finally {
    for (const context of contexts) await context.close();
  }
});
