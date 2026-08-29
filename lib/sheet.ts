/**
 * lib/sheet.ts
 * ดึง FAQ จาก Google Sheet ที่ publish เป็น CSV (public URL) แล้ว cache ไว้ใน memory 60 วิ
 * รูปแบบ Sheet: 3 คอลัมน์ — หมวด(category), คำถาม(question), คำตอบ(answer)
 *
 * หมายเหตุ: cache เป็น in-memory ธรรมดา — บน serverless (Vercel) แต่ละ instance/cold start
 * จะมี cache แยกกัน ซึ่งเป็นพฤติกรรมที่ยอมรับได้สำหรับ use case นี้ (ลดจำนวนครั้งที่ยิงไป Google Sheet)
 */

import { log } from "./log";

const CACHE_TTL_MS = 60_000;

let cache: { csv: string; fetchedAt: number } | null = null;

/**
 * ดึง FAQ CSV ดิบ (raw text) จาก Sheet หรือ cache
 * - ถ้ามี cache ที่ยังไม่หมดอายุ (< 60 วิ) → คืน cache ทันที ไม่ยิง network
 * - ถ้า cache หมดอายุแล้ว → พยายามดึงใหม่
 *   - สำเร็จ → อัปเดต cache แล้วคืนค่าใหม่
 *   - ล้มเหลว แต่มี cache เก่าอยู่ → คืน cache เก่า (stale) แทน ไม่ throw
 *   - ล้มเหลว และไม่เคยมี cache เลย → throw ให้ caller จัดการ (ส่ง default_reply)
 */
async function getFaqCsv(): Promise<string> {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.csv;
  }

  const sheetUrl = process.env.SHEET_CSV_URL;
  if (!sheetUrl) {
    if (cache) return cache.csv;
    throw new Error("SHEET_CSV_URL is not set");
  }

  try {
    const res = await fetch(sheetUrl, {
      // อย่า cache ระดับ fetch/CDN เอง เพราะเราคุม cache เองด้วย in-memory variable ข้างบนแล้ว
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Sheet fetch failed with status ${res.status}`);
    }

    const csv = await res.text();
    cache = { csv, fetchedAt: now };
    return csv;
  } catch (err) {
    // ดึงไม่ได้จริง ๆ → ใช้ cache เก่าถ้ามี ไม่มีก็โยน error ต่อให้ caller ตัดสินใจส่ง default_reply
    if (cache) {
      log.warn("sheet.fetch_failed_stale_cache", { err: String(err) });
      return cache.csv;
    }
    log.error("sheet.fetch_failed_no_cache", { err: String(err) });
    throw err;
  }
}

/**
 * แปลง CSV แถวเดียว → 3 field (รองรับ field ที่มี comma อยู่ในเครื่องหมายคำพูด)
 */
function parseCSVLine(line: string): [string, string, string] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else current += char;
  }
  result.push(current.trim());
  return [result[0] || "", result[1] || "", result[2] || ""];
}

/**
 * แปลง CSV ดิบ (หมวด,คำถาม,คำตอบ) → ข้อความ FAQ ที่อ่านง่ายสำหรับใส่ใน system prompt
 * ข้าม header แถวแรกเสมอ + ข้ามแถวว่าง
 */
function csvToFaqText(csv: string): string {
  const lines = csv.split("\n").slice(1);
  return lines
    .filter((line) => line.trim())
    .map((line) => {
      const [category, question, answer] = parseCSVLine(line);
      return `[${category}] ${question}\n→ ${answer}`;
    })
    .join("\n\n");
}

/**
 * ดึง FAQ ที่ format พร้อมใส่ใน prompt แล้ว (ใช้จาก webhook)
 */
export async function getFaqText(): Promise<string> {
  const csv = await getFaqCsv();
  return csvToFaqText(csv);
}
