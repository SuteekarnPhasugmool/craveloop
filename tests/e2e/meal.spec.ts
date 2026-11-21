import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import type { ChatResponse } from "../../src/contracts/chat";
async function state(page: Page): Promise<ChatResponse> {
  return page.evaluate(async () => {
    const id = location.pathname.split("/").pop();
    return (await (await fetch(`/api/sessions/${id}/chat`)).json()).data;
  });
}
async function fresh(page: Page) {
  await page.bringToFront();
  const s = (await state(page)).session;
  await expect(page.getByTestId("chat-version")).toHaveText(
    `${s.preferenceVersion}/${s.rosterVersion}`,
  );
  return s;
}
async function configure(page: Page, names: string[]) {
  const d = page.getByRole("dialog", { name: "ตั้งค่ามื้อนี้" });
  await expect(d).toBeVisible();
  for (const name of ["May", "Nat", "Ploy"]) {
    const box = d.getByRole("checkbox", { name, exact: true });
    if (names.includes(name)) await box.check();
    else await box.uncheck();
  }
  await d.getByLabel("โซนที่นัดกัน").selectOption("bangkok_demo");
  await d.getByLabel("รูปแบบมื้ออาหาร").selectOption("dine_in");
  await d.getByRole("button", { name: "ยืนยันและเริ่มมื้อ", exact: true }).click();
  await expect(d).toHaveCount(0);
}
async function saveReview(page: Page, budget: string, exclusion?: string) {
  const d = page.getByRole("dialog", { name: "ตรวจ draft ก่อนยืนยัน" });
  await expect(d).toBeVisible();
  await d.getByLabel("งบสูงสุด (บาท)").fill(budget);
  if (exclusion !== undefined) await d.getByLabel("วัตถุดิบที่ไม่กิน").fill(exclusion);
  await d.getByRole("checkbox", { name: "ตรวจสอบและยืนยันข้อมูลของฉัน" }).check();
  await d.getByRole("button", { name: /^ยืนยันความต้องการ/ }).click();
  await expect(d).toHaveCount(0);
}

test("selected meal subset handles no-match, private recovery and adding a self-consenting participant", async ({
  browser,
  baseURL,
}) => {
  const contexts: BrowserContext[] = [],
    pages: Page[] = [],
    errors: string[] = [];
  for (let i = 0; i < 3; i++) {
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
    const [host, nat, ploy] = pages;
    await host.goto("/legacy-line");
    await host.getByLabel("ชื่อของคุณ").fill("May");
    await host.getByRole("button", { name: "สร้างกลุ่มจำลอง" }).click();
    await host.waitForURL("**/line/**");
    const url = host.url();
    for (const [p, name] of [
      [nat, "Nat"],
      [ploy, "Ploy"],
    ] as const) {
      await p.goto(url);
      await p.getByLabel("ชื่อของคุณ").fill(name);
      await p.getByRole("button", { name: "เข้าร่วมกลุ่ม", exact: true }).click();
      await expect(p.getByLabel("ข้อความถึงกลุ่ม")).toBeVisible();
    }
    await fresh(host);
    await host.getByRole("button", { name: "เพิ่ม CraveLoop เข้ากลุ่ม" }).click();
    await expect
      .poll(async () => (await state(host)).chat.botJoined)
      .toBe(true);
    await host.getByRole("button", { name: "เริ่มมื้อใหม่", exact: true }).click();
    await configure(host, ["May", "Nat"]);
    await fresh(nat);
    await expect(nat.getByRole("dialog")).toHaveCount(0);
    await fresh(ploy);
    await expect(
      ploy.getByText("คุณไม่ได้ร่วมมื้อนี้", { exact: false }).first(),
    ).toBeVisible();
    await expect(
      ploy.getByRole("button", { name: "เข้าร่วมมื้อนี้", exact: true }),
    ).toHaveCount(0);
    for (const p of [host, nat]) {
      await fresh(p);
      await p.getByRole("button", { name: "เข้าร่วมมื้อนี้", exact: true }).click();
      await expect
        .poll(async () =>
          (await state(p)).session.meal!.joinedMemberIds.includes(
            (await state(p)).session.me!.id,
          ),
        )
        .toBe(true);
      await p
        .getByRole("button", { name: "กรอกความต้องการของฉัน", exact: true })
        .first()
        .click();
      await saveReview(
        p,
        p === nat ? "0" : "180",
        p === nat ? "pork" : undefined,
      );
    }
    await fresh(host);
    await host.getByRole("button", { name: /^หาให้หน่อย/ }).click();
    await expect(host.getByTestId("chat-no-match")).toBeVisible();
    await fresh(nat);
    await nat.getByLabel("ข้อความถึงกลุ่ม").fill("@CraveLoop เปลี่ยนงบเหลือ110บาท");
    await nat.getByRole("button", { name: "ส่งข้อความ", exact: true }).click();
    const d = nat.getByRole("dialog", { name: "ตรวจ draft ก่อนยืนยัน" });
    await expect(d.getByLabel("วัตถุดิบที่ไม่กิน")).toHaveValue("pork");
    await saveReview(nat, "110");
    await fresh(host);
    await expect(host.getByTestId("chat-option-r01")).toBeVisible();
    let s = (await state(host)).session;
    expect(s.ranking!.options.every((o) => o.assignments.length === 2)).toBe(
      true,
    );
    await host
      .getByTestId("chat-option-r01")
      .getByRole("button", { name: "ยอมรับร้านนี้", exact: true })
      .click();
    await expect
      .poll(async () => (await state(host)).session.acceptances.length)
      .toBe(1);
    await fresh(ploy);
    await expect(
      ploy.getByRole("button", { name: "ยอมรับร้านนี้", exact: true }),
    ).toHaveCount(0);
    await ploy.getByLabel("ข้อความถึงกลุ่ม").fill("@CraveLoop งบ0 อยากกินเผ็ด");
    await ploy.getByRole("button", { name: "ส่งข้อความ", exact: true }).click();
    await expect(ploy.getByRole("dialog")).toHaveCount(0);
    expect((await state(host)).session.ranking!.id).toBe(s.ranking!.id);
    await fresh(host);
    const beforeSetup = (await state(host)).session;
    await host.getByRole("button", { name: "เพิ่มผู้ร่วมมื้อ", exact: true }).click();
    const cancelledSetup = host.getByRole("dialog", { name: "ตั้งค่ามื้อนี้" });
    await expect(cancelledSetup).toBeVisible();
    let duringSetup = (await state(host)).session;
    expect(duringSetup.ranking!.id).toBe(beforeSetup.ranking!.id);
    expect(duringSetup.acceptances).toEqual(beforeSetup.acceptances);
    expect(duringSetup.rosterVersion).toBe(beforeSetup.rosterVersion);
    await cancelledSetup
      .getByRole("button", { name: "ปิดการตั้งค่ามื้อ", exact: true })
      .click();
    await expect(cancelledSetup).toHaveCount(0);
    duringSetup = (await state(host)).session;
    expect(duringSetup.ranking!.id).toBe(beforeSetup.ranking!.id);
    expect(duringSetup.acceptances).toEqual(beforeSetup.acceptances);
    expect(duringSetup.preferenceVersion).toBe(beforeSetup.preferenceVersion);
    await host.getByRole("button", { name: "เพิ่มผู้ร่วมมื้อ", exact: true }).click();
    await configure(host, ["May", "Nat", "Ploy"]);
    s = (await state(host)).session;
    expect(s.acceptances).toEqual([]);
    expect(s.ranking).toBeNull();
    expect(s.meal!.joinedMemberIds).toHaveLength(2);
    const natState = (await state(nat)).session;
    expect(natState.me!.confirmed).toBe(true);
    expect(natState.me!.preference!.excludedIngredients).toEqual(["pork"]);
    expect(natState.me!.preference!.budgetMaxSatang).toBe(11000);
    await fresh(ploy);
    await expect(ploy.getByRole("dialog")).toHaveCount(0);
    await ploy.getByRole("button", { name: "เข้าร่วมมื้อนี้", exact: true }).click();
    await ploy
      .getByRole("button", { name: "กรอกความต้องการของฉัน", exact: true })
      .first()
      .click();
    await saveReview(ploy, "150");
    await fresh(host);
    await host.getByRole("button", { name: /^หาให้หน่อย/ }).click();
    await expect(host.getByTestId("chat-option-r01")).toBeVisible();
    s = (await state(host)).session;
    expect(s.ranking!.options.every((o) => o.assignments.length === 3)).toBe(
      true,
    );
    expect(s.meal!.selectedMemberIds).toHaveLength(3);
    expect(s.meal!.joinedMemberIds).toHaveLength(3);
    expect(errors).toEqual([]);
    expect(
      await host.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await host.screenshot({
      path: "test-results/meal-selected-subset-mobile.png",
      fullPage: true,
    });
  } finally {
    for (const c of contexts) await c.close();
  }
});
