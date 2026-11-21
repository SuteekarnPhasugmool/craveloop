import { test, expect, type Page } from "@playwright/test";
import type { ChatResponse } from "../../src/contracts/chat";
const state = (p: Page) =>
  p.evaluate(async () => {
    const id = location.pathname.split("/").pop();
    return (await (await fetch(`/api/sessions/${id}/chat`)).json())
      .data as ChatResponse;
  });
test("editing preferences visibly acknowledges a fresh calculation even when the same restaurants remain best", async ({
  page,
}) => {
  await page.goto("/legacy-line");
  await page.getByLabel("ชื่อของคุณ").fill("Replan");
  await page.getByRole("button", { name: "สร้างกลุ่มจำลอง" }).click();
  await page.waitForURL("**/line/**");
  await page.getByRole("button", { name: "เพิ่ม CraveLoop เข้ากลุ่ม" }).click();
  await page.getByRole("button", { name: "เริ่มมื้อใหม่", exact: true }).click();
  const setup = page.getByRole("dialog", { name: "ตั้งค่ามื้อนี้" });
  await setup
    .getByRole("button", { name: "ยืนยันและเริ่มมื้อ", exact: true })
    .click();
  await page.getByRole("button", { name: "เข้าร่วมมื้อนี้", exact: true }).click();
  await page
    .getByRole("button", { name: "กรอกความต้องการของฉัน", exact: true })
    .first()
    .click();
  const review = page.getByRole("dialog", { name: "ตรวจ draft ก่อนยืนยัน" });
  await review.getByLabel("งบสูงสุด (บาท)").fill("200");
  await review
    .getByRole("checkbox", { name: "ตรวจสอบและยืนยันข้อมูลของฉัน" })
    .check();
  await review.getByRole("button", { name: /^ยืนยันความต้องการ/ }).click();
  await page.getByRole("button", { name: /^หาให้หน่อย/ }).click();
  await expect(page.getByTestId("chat-results")).toBeVisible();
  const before = (await state(page)).session.ranking!;
  await page
    .getByRole("button", { name: "แก้ความต้องการของฉัน", exact: true })
    .first()
    .click();
  await review.getByLabel("งบสูงสุด (บาท)").fill("180");
  await review
    .getByRole("checkbox", { name: "ตรวจสอบและยืนยันข้อมูลของฉัน" })
    .check();
  await review.getByRole("button", { name: /^ยืนยันความต้องการ/ }).click();
  await expect(review).toHaveCount(0);
  await expect(page.getByTestId("ranking-update")).toContainText(
    "คำนวณตามข้อมูลที่ยืนยันล่าสุดแล้ว",
  );
  await expect(page.getByTestId("ranking-update")).toContainText("ยังเหมือนเดิม");
  await expect(page.getByTestId("ranking-update")).toBeInViewport();
  const after = (await state(page)).session;
  expect(after.ranking!.id).not.toBe(before.id);
  expect(after.ranking!.options).toEqual(before.options);
  expect(after.ranking!.update!.outcome).toBe("unchanged");
  expect(after.acceptances).toHaveLength(0);
  await page.reload();
  await expect(page.getByTestId("ranking-update")).toContainText("ยังเหมือนเดิม");
});
