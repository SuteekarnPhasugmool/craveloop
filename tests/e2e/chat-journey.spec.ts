import { test, expect } from "@playwright/test";
test.use({
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

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
    const inviteUrl = new URL(await invite.getByLabel("ลิงก์ห้องแชต").inputValue());
    // Loopback-only test servers cannot listen on the advertised LAN interface.
    const url = new URL(inviteUrl.pathname, baseURL).href;
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
      if (member === page) {
        await page.locator(".chat-welcome-bubble").getByRole("button", { name: "กรอกความต้องการของฉัน" }).click();
      } else {
        await member.getByLabel("ข้อความถึงกลุ่ม").fill("อยากกินกรอบ ๆ งบ 200 บาท");
        await member.getByRole("button", { name: "ส่ง", exact: true }).click();
      }
      const dialog = member.getByRole("dialog", { name: "ความต้องการของฉัน" });
      await expect(dialog.getByRole("button", { name: "ยืนยันความต้องการ" })).toBeInViewport();
      if (member === page) {
        await dialog.getByRole("textbox", { name: "อยากกินอะไร" }).fill("ข้าว แห้ง");
        await dialog.getByRole("textbox", { name: "ข้อจำกัด" }).fill("200 บาท");
        await dialog.getByLabel("เลือกรูปประกอบ").setInputFiles("tests/fixtures/crispy.png");
        await expect(dialog.getByAltText("รูปประกอบความต้องการ")).toBeVisible();
        await dialog.getByRole("button", { name: "อัดข้อความเสียง" }).click();
        await expect(dialog.getByRole("status")).toContainText("กำลังอัดเสียง");
        await page.waitForTimeout(450); // Capture a short sample from Chromium's fake microphone.
        await dialog.getByRole("button", { name: "หยุดอัดเสียง" }).click();
        await expect(dialog.getByLabel("ฟังข้อความเสียง")).toBeVisible();
      }
      await expect(dialog.getByRole("textbox", { name: "ข้อจำกัด" })).toHaveValue("200 บาท");
      await dialog
        .getByRole("button", { name: "ยืนยันความต้องการ", exact: true })
        .click();
      await expect(dialog).toHaveCount(0);
      if (member === page) {
        await page.reload();
        await page.getByRole("button", { name: "แก้ความต้องการของฉัน" }).click();
        await expect(dialog.getByRole("textbox", { name: "อยากกินอะไร" })).toHaveValue("ข้าว แห้ง");
        await expect.poll(() => dialog.getByAltText("รูปประกอบความต้องการ").evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        await expect.poll(() => dialog.getByLabel("ฟังข้อความเสียง").evaluate(el => (el as HTMLAudioElement).readyState)).toBeGreaterThan(0);
        const mediaUrl = await dialog.getByLabel("ฟังข้อความเสียง").getAttribute("src");
        expect((await guest.request.get(mediaUrl!)).status()).toBe(404);
        await dialog.getByRole("button", { name: "ปิดความต้องการของฉัน" }).click();
        await expect(page.getByText("ยืนยันแล้ว 1/2 คน", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "ค้นหาจากคนที่ยืนยันแล้ว" }).click();
        await expect(page.getByRole("region", { name: "ผลค้นหาเบื้องต้น" })).toBeVisible();
        await expect(guest.getByRole("button", { name: "ค้นหาจากคนที่ยืนยันแล้ว" })).toHaveCount(0);
      }
    }
    await page.bringToFront();
    await expect(
      page
        .getByRole("log")
        .getByText("อยากกินกรอบ ๆ งบ 200 บาท", { exact: true }),
    ).toHaveCount(1);
    await expect(page.getByText("ยืนยันแล้ว 2/2 คน", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "ผลค้นหาเบื้องต้น" })).toHaveCount(0);
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
