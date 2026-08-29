#!/usr/bin/env node
/**
 * scripts/install-rich-menu.mjs
 * ติดตั้ง Rich Menu ให้ LINE OA — สร้าง menu, อัปโหลดรูป, ตั้งเป็น default ให้ทุกคน
 *
 * ก่อนรัน:
 *  1. เตรียมรูป rich-menu/rich-menu.jpg ขนาด 2500x843 px (ตรงกับ "size" ใน rich-menu.json)
 *     - ต้องเป็น .jpg (LINE ไม่รับ PNG transparency)
 *  2. ตั้ง env var LINE_CHANNEL_ACCESS_TOKEN (หรือมี .env.local ที่ Next.js โหลดอยู่แล้วก็ export เองก่อนรัน)
 *
 * วิธีรัน:
 *   node scripts/install-rich-menu.mjs
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

const RICH_MENU_DIR = path.join(process.cwd(), "rich-menu");
const JSON_PATH = path.join(RICH_MENU_DIR, "rich-menu.json");
const IMAGE_PATH = path.join(RICH_MENU_DIR, "rich-menu.jpg");

/** โหลด LINE_CHANNEL_ACCESS_TOKEN จาก .env.local ถ้ายังไม่มีใน process.env (ไม่พึ่ง dotenv) */
async function loadTokenFromEnvLocal() {
  try {
    const envContent = await readFile(
      path.join(process.cwd(), ".env.local"),
      "utf-8"
    );
    const match = envContent.match(/^LINE_CHANNEL_ACCESS_TOKEN=(.*)$/m);
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

async function main() {
  const TOKEN =
    process.env.LINE_CHANNEL_ACCESS_TOKEN || (await loadTokenFromEnvLocal());
  if (!TOKEN) {
    console.error(
      "❌ LINE_CHANNEL_ACCESS_TOKEN ไม่ถูกตั้งค่า — set env var นี้ก่อนรัน script"
    );
    process.exit(1);
  }

  const richMenuConfig = JSON.parse(await readFile(JSON_PATH, "utf-8"));

  console.log("1/3 · สร้าง rich menu...");
  const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(richMenuConfig),
  });
  if (!createRes.ok) {
    throw new Error(
      `สร้าง rich menu ไม่สำเร็จ: ${createRes.status} ${await createRes.text()}`
    );
  }
  const { richMenuId } = await createRes.json();
  console.log(`   ✅ richMenuId = ${richMenuId}`);

  console.log("2/3 · อัปโหลดรูป...");
  let imageBuffer;
  try {
    imageBuffer = await readFile(IMAGE_PATH);
  } catch {
    throw new Error(
      `หารูปไม่เจอที่ ${IMAGE_PATH} — เตรียมรูป .jpg ขนาด ${richMenuConfig.size.width}x${richMenuConfig.size.height} px ไว้ก่อนรัน script นี้`
    );
  }
  const uploadRes = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "image/jpeg",
      },
      body: imageBuffer,
    }
  );
  if (!uploadRes.ok) {
    throw new Error(
      `อัปโหลดรูปไม่สำเร็จ: ${uploadRes.status} ${await uploadRes.text()}`
    );
  }
  console.log("   ✅ อัปโหลดรูปสำเร็จ");

  console.log("3/3 · ตั้งเป็น default rich menu ให้ทุกคน...");
  const setDefaultRes = await fetch(
    `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
    { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  if (!setDefaultRes.ok) {
    throw new Error(
      `ตั้ง default rich menu ไม่สำเร็จ: ${setDefaultRes.status} ${await setDefaultRes.text()}`
    );
  }
  console.log("   ✅ ตั้ง default สำเร็จ");

  console.log(`\n🎉 ติดตั้ง Rich Menu สำเร็จ · richMenuId = ${richMenuId}`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
