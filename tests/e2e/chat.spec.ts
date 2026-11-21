import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import type { SessionView } from "../../src/contracts";
import type { ChatResponse } from "../../src/contracts/chat";

async function chat(page: Page): Promise<ChatResponse> {
  return page.evaluate(async () => {
    const id = location.pathname.split("/").pop();
    return (await (await fetch(`/api/sessions/${id}/chat`)).json()).data;
  });
}
async function fresh(page: Page) {
  await page.bringToFront();
  const current = await chat(page);
  await expect(page.getByTestId("chat-version")).toHaveText(
    `${current.session.preferenceVersion}/${current.session.rosterVersion}`,
  );
  return current;
}
async function draft(
  page: Page,
  text: string,
  budget: string,
  settings: { exclude?: string; diet?: string; tags?: string[] } = {},
) {
  await fresh(page);
  await page.getByLabel("ข้อความถึงกลุ่ม").fill(text);
  await page.getByRole("button", { name: "ส่งข้อความ", exact: true }).click();
  const review = page.getByRole("dialog", { name: "ตรวจ draft ก่อนยืนยัน" });
  await expect(review).toBeVisible();
  await expect(review.getByText(/ตัวช่วยจับคำแบบกฎ/)).toBeVisible();
  await expect(review.getByLabel("งบสูงสุด (บาท)")).toHaveValue(budget);
  if (settings.exclude)
    await review.getByLabel("วัตถุดิบที่ไม่กิน").fill(settings.exclude);
  if (settings.diet)
    await review
      .getByLabel("ข้อกำหนดอาหาร", { exact: true })
      .fill(settings.diet);
  for (const tag of settings.tags ?? []) {
    const button = review.getByRole("button", { name: tag, exact: true });
    if ((await button.getAttribute("aria-pressed")) !== "true")
      await button.click();
  }
  await review
    .getByRole("checkbox", { name: "ตรวจสอบและยืนยันข้อมูลของฉัน" })
    .check();
  await review.getByRole("button", { name: /^ยืนยันความต้องการ/ }).click();
  await expect(review).toHaveCount(0);
}

test("LINE-style simulated group: four contexts chat, review drafts, replan and unanimous final choice", async ({
  browser,
  baseURL,
}) => {
  const contexts: BrowserContext[] = [],
    pages: Page[] = [],
    errors: string[] = [];
  for (let i = 0; i < 4; i++) {
    const c = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    contexts.push(c);
    const p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    pages.push(p);
  }
  try {
    const host = pages[0];
    await host.goto("/legacy-line");
    await host.getByLabel("ชื่อของคุณ").fill("May");
    await host.getByRole("button", { name: "สร้างกลุ่มจำลอง" }).click();
    await host.waitForURL("**/line/**");
    await expect(host.getByText(/LINE-style simulation/).first()).toBeVisible();
    const roomUrl = host.url();
    for (let i = 1; i < 4; i++) {
      await pages[i].goto(roomUrl);
      await pages[i].getByLabel("ชื่อของคุณ").fill(["", "Nat", "Ploy", "Ton"][i]);
      await pages[i]
        .getByRole("button", { name: "เข้าร่วมกลุ่ม", exact: true })
        .click();
      await expect(pages[i].getByLabel("ข้อความถึงกลุ่ม")).toBeVisible();
    }
    await fresh(host);
    await host.getByLabel("ข้อความถึงกลุ่ม").fill("สวัสดีทุกคน วันนี้กินอะไรดี");
    await host.getByRole("button", { name: "ส่งข้อความ", exact: true }).click();
    await expect
      .poll(async () =>
        (await chat(pages[1])).chat.messages.some(
          (m) => m.text === "สวัสดีทุกคน วันนี้กินอะไรดี",
        ),
      )
      .toBe(true);
    expect((await chat(host)).chat.botJoined).toBe(false);
    await host.getByRole("button", { name: "เพิ่ม CraveLoop เข้ากลุ่ม" }).click();
    await expect.poll(async () => (await chat(host)).chat.botJoined).toBe(true);
    await fresh(host);
    await host.getByRole("button", { name: "เริ่มมื้อใหม่", exact: true }).click();
    const setup = host.getByRole("dialog", { name: "ตั้งค่ามื้อนี้" });
    await expect(setup).toBeVisible();
    for (const name of ["May", "Nat", "Ploy", "Ton"])
      await setup.getByRole("checkbox", { name, exact: true }).check();
    await setup.getByLabel("โซนที่นัดกัน").selectOption("bangkok_demo");
    await setup.getByLabel("รูปแบบมื้ออาหาร").selectOption("dine_in");
    await setup
      .getByRole("button", { name: "ยืนยันและเริ่มมื้อ", exact: true })
      .click();
    await expect(setup).toHaveCount(0);
    expect((await chat(host)).session.meal!.selectedMemberIds).toHaveLength(4);
    expect((await chat(host)).session.meal!.joinedMemberIds).toEqual([]);
    for (const page of pages) {
      await fresh(page);
      await page
        .getByRole("button", { name: "เข้าร่วมมื้อนี้", exact: true })
        .click();
      await expect
        .poll(async () =>
          (await chat(page)).session.meal!.joinedMemberIds.includes(
            (await chat(page)).session.me!.id,
          ),
        )
        .toBe(true);
    }

    await draft(host, "@CraveLoop อยากกินอะไรกรอบ ๆ กลมกล่อม งบ180", "180", {
      tags: ["กลมกล่อม", "กรอบ"],
    });
    await draft(pages[1], "@CraveLoop ไม่กินหมู ขอรสอ่อน งบ160", "160", {
      exclude: "pork",
      tags: ["รสอ่อน"],
    });
    await draft(pages[2], "@CraveLoop กินมังสวิรัติ อยากกินน้ำซุปเส้นหนึบ งบ150", "150", {
      diet: "vegetarian",
      tags: ["น้ำซุป", "เส้นหนึบ"],
    });
    await draft(pages[3], "@CraveLoop อยากกินเผ็ด งบ200", "200", {
      tags: ["เผ็ด"],
    });
    await fresh(host);
    await host.getByRole("button", { name: /^หาให้หน่อย/ }).click();
    await expect(host.getByTestId("chat-option-r01")).toBeVisible();
    const initial = (await chat(host)).session;
    expect(initial.ranking!.options.map((o) => o.restaurantId)).toEqual([
      "r01",
      "r04",
      "r02",
    ]);
    await host
      .getByTestId("chat-option-r01")
      .getByRole("button", { name: "ยอมรับร้านนี้", exact: true })
      .click();
    await expect
      .poll(async () => (await chat(host)).session.acceptances.length)
      .toBe(1);
    await draft(pages[3], "@CraveLoop เปลี่ยนงบเหลือ110บาท", "110");
    await expect
      .poll(async () => (await chat(host)).session.ranking!.id)
      .not.toBe(initial.ranking!.id);
    const revised = (await chat(host)).session;
    expect(revised.acceptances).toEqual([]);
    expect(revised.ranking!.options.map((o) => o.restaurantId)).toEqual([
      "r01",
      "r02",
      "r03",
    ]);
    const tonId = revised.members.find((m) => m.displayName === "Ton")!.id;
    for (const option of revised.ranking!.options) {
      expect(option.assignments).toHaveLength(4);
      expect(
        option.assignments.find((a) => a.memberId === tonId)!.totalCostSatang,
      ).toBeLessThanOrEqual(11000);
    }
    for (const page of pages) {
      await fresh(page);
      await page
        .getByTestId("chat-option-r01")
        .getByRole("button", { name: "ยอมรับร้านนี้", exact: true })
        .click();
    }
    await fresh(host);
    const finalize = host
      .getByTestId("chat-option-r01")
      .getByRole("button", { name: "สรุปร้านนี้", exact: true });
    await expect(finalize).toBeEnabled();
    await finalize.click();
    await expect
      .poll(async () => (await chat(host)).session.status)
      .toBe("finalized");
    for (const page of pages) {
      await page.reload();
      await fresh(page);
      const state = await chat(page);
      expect(state.session.status).toBe("finalized");
      expect(state.session.acceptances).toHaveLength(4);
      expect(
        state.chat.messages.some(
          (m) => m.kind === "bot" && m.text.includes("สรุปมื้อนี้"),
        ),
      ).toBe(true);
      expect(state.session.me).not.toBeNull();
    }
    await host.bringToFront();
    await contexts[0].grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: baseURL!,
    });
    await host
      .getByTestId("chat-final-summary")
      .getByRole("button", { name: /คัดลอกสรุปมื้อ/ })
      .click();
    await expect
      .poll(async () => host.evaluate(() => navigator.clipboard.readText()))
      .toContain("Demo Mixed Kitchen");
    await host
      .getByTestId("chat-final-summary")
      .getByText("ดูข้อความสรุป", { exact: true })
      .click();
    await expect(
      host.getByTestId("chat-final-summary").locator("pre"),
    ).toContainText("ข้อมูลร้านสมมติ");
    await expect(
      host.getByTestId("chat-final-summary").locator("pre"),
    ).toContainText("Demo Mixed Kitchen");
    expect(
      new Set(
        await Promise.all(
          pages.map(async (p) => (await chat(p)).session.me!.id),
        ),
      ).size,
    ).toBe(4);
    expect(
      await host.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await expect(host.locator(".line-copy-toast")).toHaveCount(0);
    await host.screenshot({
      path: "test-results/line-chat-final-mobile.png",
      fullPage: true,
    });
  } finally {
    for (const c of contexts) await c.close();
  }
});
