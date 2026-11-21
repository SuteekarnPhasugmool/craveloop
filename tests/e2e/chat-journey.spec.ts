import { test, expect } from "@playwright/test";

test("shared chat, personal menu choices and checkout survive refresh", async ({
  browser,
  page,
  baseURL,
}) => {
  const guest = await browser.newPage({
    baseURL,
    viewport: { width: 390, height: 844 },
  });
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "สร้างห้องแชต" }).click();
    await page.getByLabel("ชื่อของคุณ").fill("May");
    await page
      .getByRole("button", { name: "สร้างห้องและชวนเพื่อน", exact: true })
      .click();
    const invite = page.getByRole("dialog", { name: "แชร์ห้องแชต" });
    await expect(page).toHaveURL(new URL("/", baseURL!).href);
    const url = await invite.getByLabel("ลิงก์ห้องแชต").inputValue();
    await invite.getByRole("button", { name: "เข้าห้องแชต" }).click();
    await expect(page.getByLabel("ข้อความถึงกลุ่ม")).toBeInViewport();
    await expect(
      page.getByRole("link", { name: "กลับหน้าอาหาร" }),
    ).toBeInViewport();
    await guest.goto(url);
    await guest.getByLabel("ชื่อของคุณ").fill("Nat");
    await guest.getByRole("button", { name: "เข้าร่วม Group Order" }).click();
    for (const member of [page, guest]) {
      await member.bringToFront();
      await member.getByLabel("ข้อความถึงกลุ่ม").fill("อยากกินกรอบ ๆ งบ 200 บาท");
      await member.getByRole("button", { name: "ส่ง", exact: true }).click();
      const dialog = member.getByRole("dialog", { name: "ความต้องการของฉัน" });
      await expect(dialog.getByLabel("งบสูงสุด (บาท)")).toHaveValue("200");
      await dialog.getByRole("checkbox").last().check();
      await dialog
        .getByRole("button", { name: "ยืนยันความต้องการ", exact: true })
        .click();
      await expect(dialog).toHaveCount(0);
    }
    await page.bringToFront();
    await expect(
      page
        .getByRole("log")
        .getByText("อยากกินกรอบ ๆ งบ 200 บาท", { exact: true }),
    ).toHaveCount(2);
    await page.getByRole("button", { name: "ค้นหาร้านสำหรับกลุ่ม" }).click();
    for (const member of [page, guest]) {
      await member.bringToFront();
      await member.getByRole("button", { name: "ยอมรับร้านนี้" }).first().click();
    }
    await page.bringToFront();
    const agreedName = await page
      .locator(".chat-results article h3")
      .first()
      .innerText();
    await page.getByRole("button", { name: "สรุปร้านนี้" }).first().click();
    for (const member of [page, guest]) {
      await member.bringToFront();
      await expect(member).toHaveURL(/\/group\/[^/]+\/shop\/[^/]+$/);
      await expect(
        member.getByRole("heading", { level: 1, name: agreedName }),
      ).toBeVisible();
      await expect(member.getByRole("main", { name: "หน้าร้าน" })).toBeVisible();
      await expect(member.getByLabel("ข้อความถึงกลุ่ม")).toHaveCount(0);
    }
    const shopPath = new URL(page.url()).pathname;
    expect(new URL(guest.url()).pathname).toBe(shopPath);
    await guest.goto(url);
    await expect(guest).toHaveURL(new URL(shopPath, url).href);
    await page.bringToFront();
    await page.getByRole("button", { name: "ค้นหาเมนูในร้าน" }).click();
    await page.getByRole("searchbox", { name: "ค้นหาเมนู" }).fill("no-such-menu");
    await expect(page.getByText("ไม่พบเมนูที่ค้นหา")).toBeVisible();
    await page.getByRole("button", { name: "ค้นหาเมนูในร้าน" }).click();
    const handoff = page.getByRole("button", { name: "ดูตะกร้ากลุ่ม" });
    await expect(handoff).toBeDisabled();
    const dishes = [];
    for (const [i, member] of [page, guest].entries()) {
      await member.bringToFront();
      const row = member
        .getByRole("region", { name: "รายการอาหาร" })
        .getByRole("article")
        .nth(i);
      const dish = row.getByRole("button");
      dishes.push(await row.getByRole("heading").innerText());
      await dish.click();
      await expect(dish).toHaveAttribute("aria-pressed", "true");
    }
    await page.bringToFront();
    await handoff.click();
    for (const name of dishes)
      await expect(page.getByTestId("group-cart")).toContainText(name);
    await page.getByRole("button", { name: "ดูสรุป Checkout จำลอง" }).click();
    await expect(page.getByTestId("group-checkout")).toBeVisible();
    await guest.reload();
    await expect(guest.getByTestId("group-checkout")).toBeVisible();

    await page.bringToFront();
    await page.getByRole("button", { name: "คำสั่งซื้อแบบกลุ่ม" }).click();
    await page.getByRole("button", { name: "จัดการผู้ร่วมสั่ง" }).click();
    await page.getByRole("button", { name: "ยืนยันผู้ร่วมสั่ง" }).click();
    for (const member of [page, guest]) {
      await member.bringToFront();
      await expect(member).toHaveURL(/\/group\/[^/]+$/);
      await expect(member.getByLabel("ข้อความถึงกลุ่ม")).toBeVisible();
    }
  } finally {
    await guest.close();
  }
});
