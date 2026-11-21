import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Restaurant } from "../../src/contracts";
const sourceCatalog = JSON.parse(
  readFileSync(
    new URL("../../data/catalog.seed.json", import.meta.url),
    "utf8",
  ),
) as Restaurant[];

test("delivery home searches synthetic catalog facts and recovers from an empty result", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByTestId("delivery-shortcuts")).toBeVisible();
  await expect(page.getByTestId("delivery-bottom-nav")).toBeVisible();
  const search = page.getByRole("searchbox", { name: "ค้นหาร้านหรือเมนู" });
  await search.fill("นมและชานมไข่มุก");
  const bubbleTea = page.getByTestId("home-menu-sf-demo-30970-m01");
  await expect(bubbleTea).toContainText("ชานมไข่มุกน้ำตาลทรายแดง");
  await bubbleTea.click();
  const teaDetail = page.getByRole("dialog", { name: "ชานมไข่มุกน้ำตาลทรายแดง" });
  await expect(teaDetail).toContainText("นมและชานมไข่มุก");
  await teaDetail.getByRole("button", { name: "ปิดรายละเอียดเมนู" }).click();
  await search.fill("ร้านจำลอง ครัวบ้านสวน");
  const catalog = page.getByTestId("delivery-catalog");
  const cards = catalog.getByTestId(/^home-menu-r\d+-m\d+$/);
  await expect(cards.first()).toBeVisible();
  for (const card of await cards.all()) {
    const id = (await card.getAttribute("data-testid"))!.replace(
      "home-menu-",
      "",
    );
    const source = sourceCatalog.find((restaurant) => restaurant.id === "r01")!;
    const menu = source.menus.find((item) => item.id === id)!;
    expect(menu).toBeDefined();
    await expect(card).toContainText(source.name);
    await expect(card).toContainText(menu.name);
    await expect(card).toContainText(
      new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }).format(menu.prices.delivery! / 100),
    );
  }
  await search.fill("zzzz-no-catalog-match-993");
  await expect(page.getByTestId("home-no-results")).toBeVisible();
  await expect(cards).toHaveCount(0);
  await search.fill("");
  await expect(cards.first()).toBeVisible();
  await page
    .getByTestId("delivery-bottom-nav")
    .getByRole("button", { name: "หน้าหลัก", exact: true })
    .click();
  await page.getByRole("button", { name: "มังสวิรัติ", exact: true }).click();
  await expect(cards.first()).toBeVisible();
  for (const card of await cards.all()) {
    const id = (await card.getAttribute("data-testid"))!.replace(
      "home-menu-",
      "",
    );
    const menu = sourceCatalog
      .flatMap((restaurant) => restaurant.menus)
      .find((item) => item.id === id)!;
    expect(
      (menu.dietaryEvidence as Record<string, { verified: boolean }>).vegetarian
        ?.verified,
    ).toBe(true);
  }
  await page.getByRole("button", { name: "เลือกพื้นที่จัดส่ง", exact: true }).click();
  const zone = page.getByRole("dialog", { name: "พื้นที่จัดส่งร่วมกัน", exact: true });
  await expect(zone).toBeVisible();
  await zone
    .getByRole("button", { name: "ใช้โซน Bangkok demo", exact: true })
    .click();
  await expect(zone).toHaveCount(0);
  await page
    .getByTestId("delivery-bottom-nav")
    .getByRole("button", { name: "ตะกร้ากลุ่ม", exact: true })
    .click();
  const group = page.getByRole("dialog", { name: "ตะกร้ากลุ่ม", exact: true });
  await group.getByLabel("ลิงก์ Group Order").fill("not-a-group-link");
  await group
    .getByRole("button", { name: "เปิดกลุ่มและตรวจตะกร้า", exact: true })
    .click();
  await expect(group.getByRole("alert")).toContainText("ใส่ลิงก์");
  await group.getByRole("button", { name: "ปิดหน้าข้อมูล", exact: true }).click();
  await page
    .getByTestId("delivery-bottom-nav")
    .getByRole("button", { name: "หน้าหลัก", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/delivery-home-reference-mobile.png",
    fullPage: true,
  });
});
