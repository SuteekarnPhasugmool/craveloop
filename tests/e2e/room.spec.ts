import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import type { SessionView } from "../../src/contracts";
async function current(page: Page) {
  return page.evaluate(async () => {
    const id = location.pathname.split("/").pop();
    const r = await fetch(`/api/sessions/${id}`);
    return (await r.json()).data as SessionView;
  });
}
async function focusFresh(page: Page) {
  await page.bringToFront();
  const s = await current(page);
  await expect(
    page.getByText(
      new RegExp(`Version ${s.preferenceVersion}/${s.rosterVersion}`),
    ),
  ).toBeVisible();
}
async function confirm(
  page: Page,
  budget: string,
  text: string,
  settings: { tags?: string[]; exclude?: string; diet?: string } = {},
) {
  await focusFresh(page);
  await page.getByLabel("What are you craving?").fill(text);
  await page.getByLabel("Budget (THB)").fill(budget);
  if (settings.exclude)
    await page
      .getByLabel("Exclude ingredients", { exact: true })
      .fill(settings.exclude);
  if (settings.diet)
    await page
      .getByLabel("Dietary requirements", { exact: true })
      .fill(settings.diet);
  for (const tag of settings.tags ?? [])
    await page.getByRole("button", { name: tag, exact: true }).click();
  await page
    .getByRole("checkbox", { name: /I reviewed these preferences/ })
    .check();
  await page.getByRole("button", { name: "Confirm my preferences" }).click();
  await expect(
    page.getByRole("button", { name: "Change preferences" }),
  ).toBeVisible();
}
for (const mode of ["dine_in", "delivery"] as const) {
  test(`four independent contexts complete ${mode}, replan, unanimous finalize and persistence`, async ({
    browser,
    baseURL,
  }) => {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    const errors: string[] = [];
    for (let i = 0; i < 4; i++) {
      const c = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        baseURL,
      });
      contexts.push(c);
      const p = await c.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      pages.push(p);
    }
    try {
      const host = pages[0];
      await host.goto("/web");
      await host.getByLabel("Your name").fill("May");
      if (mode === "delivery")
        await host.getByRole("button", { name: "Delivery" }).click();
      await host.getByRole("button", { name: "Create a room" }).click();
      await host.waitForURL("**/s/**");
      const roomUrl = host.url();
      await expect(
        host.getByText("SYNTHETIC CATALOG", { exact: true }),
      ).toBeVisible();
      for (let i = 1; i < 4; i++) {
        await pages[i].goto(roomUrl);
        await pages[i]
          .getByLabel("Your name")
          .fill(["", "Nat", "Ploy", "Ton"][i]);
        await pages[i].getByRole("button", { name: "Join room" }).click();
        await expect(pages[i].getByLabel("Budget (THB)")).toBeVisible();
      }
      await focusFresh(host);
      await host
        .getByLabel("Add food photo / screenshot")
        .setInputFiles("tests/fixtures/crispy.png");
      await expect(host.getByAltText("Your uploaded craving")).toBeVisible();
      await expect(
        host.getByText("Manual mode · AI unavailable"),
      ).toBeVisible();
      await expect(
        host.getByRole("button", { name: "Create AI draft" }),
      ).toBeDisabled();
      await confirm(host, "180", "อยากกินอะไรกรอบ ๆ งบ 180", {
        tags: ["Savory · เค็มกลมกล่อม", "Crispy · กรอบ"],
      });
      await confirm(pages[1], "160", "ไม่กินหมู ขออาหารรสอ่อน งบ 160", {
        tags: ["Mild · รสอ่อน"],
        exclude: "pork",
      });
      await confirm(pages[2], "150", "กินมังสวิรัติ อยากกินเส้น งบ 150", {
        tags: ["Brothy · น้ำซุป", "Chewy · เส้นหนึบ"],
        diet: "vegetarian",
      });
      await confirm(pages[3], "200", "อยากกินเผ็ด งบ 200", {
        tags: ["Spicy · เผ็ด"],
      });
      await focusFresh(host);
      await expect(
        host.getByRole("button", { name: "Find meals for everyone" }),
      ).toBeEnabled();
      await host
        .getByRole("button", { name: "Find meals for everyone" })
        .click();
      await expect(host.getByTestId("option-r01")).toBeVisible();
      const initial = await current(host);
      expect(initial.ranking!.options.map((o) => o.restaurantId)).toEqual([
        "r01",
        "r04",
        "r02",
      ]);
      for (const option of initial.ranking!.options) {
        expect(option.assignments).toHaveLength(4);
        for (const a of option.assignments) {
          expect(a.menuId).toMatch(new RegExp(`^${option.restaurantId}-m`));
          expect(a.itemCostSatang! + a.allocatedFeeSatang!).toBe(
            a.totalCostSatang,
          );
        }
      }
      const initialId = initial.ranking!.id;
      await host
        .getByTestId("option-r01")
        .getByRole("button", { name: "Accept this option" })
        .click();
      await expect(
        host.getByTestId("option-r01").getByText("1 / 4 accepted"),
      ).toBeVisible();
      await focusFresh(pages[3]);
      await pages[3]
        .getByRole("button", { name: "Change preferences" })
        .click();
      await pages[3].getByLabel("Budget (THB)").fill("110");
      await pages[3]
        .getByRole("checkbox", { name: /I reviewed these preferences/ })
        .check();
      await pages[3]
        .getByRole("button", { name: "Confirm changes & replan" })
        .click();
      await expect
        .poll(async () => (await current(host)).ranking!.id)
        .not.toBe(initialId);
      await focusFresh(host);
      await expect(host.getByTestId("option-r04")).toHaveCount(0);
      const changed = await current(host);
      expect(changed.acceptances).toHaveLength(0);
      expect(changed.ranking!.options.map((o) => o.restaurantId)).toEqual([
        "r01",
        "r02",
        "r03",
      ]);
      for (const o of changed.ranking!.options)
        expect(
          o.assignments.find(
            (a) =>
              a.memberId ===
              changed.members.find((m) => m.displayName === "Ton")!.id,
          )!.totalCostSatang,
        ).toBeLessThanOrEqual(11000);
      for (const p of pages) {
        await focusFresh(p);
        await expect(
          p
            .getByTestId("option-r01")
            .getByRole("button", { name: "Accept this option" }),
        ).toBeVisible();
        await p
          .getByTestId("option-r01")
          .getByRole("button", { name: "Accept this option" })
          .click();
      }
      await focusFresh(host);
      const finalize = host
        .getByTestId("option-r01")
        .getByRole("button", { name: "Finalize group choice" });
      await expect(finalize).toBeEnabled();
      await finalize.click();
      for (const p of pages) {
        await focusFresh(p);
        await expect(
          p.getByText("UNANIMOUSLY AGREED", { exact: true }),
        ).toBeVisible();
      }
      await focusFresh(host);
      await host.getByRole("button", { name: "Copy meal summary" }).click();
      await host.getByText("View copyable summary").click();
      await expect(host.locator("pre.summary-text")).toContainText(
        "Synthetic demo catalog",
      );
      expect(
        await host.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      for (const p of pages) {
        await p.reload();
        await expect(
          p.getByText("UNANIMOUSLY AGREED", { exact: true }),
        ).toBeVisible();
        const s = await current(p);
        expect(s.me).not.toBeNull();
        expect(s.acceptances).toHaveLength(4);
        expect(s.status).toBe("finalized");
      }
      expect(
        new Set(
          await Promise.all(pages.map(async (p) => (await current(p)).me!.id)),
        ).size,
      ).toBe(4);
      expect(errors).toEqual([]);
      await host.screenshot({
        path: `test-results/${mode}-final-mobile.png`,
        fullPage: true,
      });
    } finally {
      for (const c of contexts) await c.close();
    }
  });
}
test("mobile no-match and manual recovery preserve room", async ({ page }) => {
  await page.goto("/web");
  await page.getByLabel("Your name").fill("NoMatch");
  await page.getByRole("button", { name: "Create a room" }).click();
  await page.waitForURL("**/s/**");
  await confirm(page, "0", "Budget boundary zero");
  await page.getByRole("button", { name: "Find meals for everyone" }).click();
  await expect(
    page.getByRole("heading", { name: "No feasible restaurant for everyone" }),
  ).toBeVisible();
  await expect(
    page.getByText("Total exceeds a member’s budget", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Change preferences" }).click();
  await page.getByLabel("Budget (THB)").fill("150");
  await page
    .getByRole("checkbox", { name: /I reviewed these preferences/ })
    .check();
  await page.getByRole("button", { name: "Confirm changes & replan" }).click();
  await expect(page.getByTestId("option-r01")).toBeVisible();
  expect((await current(page)).ranking!.options.length).toBeGreaterThan(0);
});
