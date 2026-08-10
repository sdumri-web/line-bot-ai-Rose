/**
 * lib/sheet.ts
 * ดึง FAQ จาก Google Sheet ที่ publish เป็น CSV (public URL) แล้ว cache ไว้ใน memory 60 วิ
 *
 * หมายเหตุ: cache เป็น in-memory ธรรมดา — บน serverless (Vercel) แต่ละ instance/cold start
 * จะมี cache แยกกัน ซึ่งเป็นพฤติกรรมที่ยอมรับได้สำหรับ use case นี้ (ลดจำนวนครั้งที่ยิงไป Google Sheet)
 */

const CACHE_TTL_MS = 60_000;

let cache: { csv: string; fetchedAt: number } | null = null;

/**
 * ดึง FAQ CSV ดิบ (raw text) สำหรับใส่ใน prompt
 * - ถ้ามี cache ที่ยังไม่หมดอายุ (< 60 วิ) → คืน cache ทันที ไม่ยิง network
 * - ถ้า cache หมดอายุแล้ว → พยายามดึงใหม่
 *   - สำเร็จ → อัปเดต cache แล้วคืนค่าใหม่
 *   - ล้มเหลว แต่มี cache เก่าอยู่ → คืน cache เก่า (stale) แทน ไม่ throw
 *   - ล้มเหลว และไม่เคยมี cache เลย → throw ให้ caller จัดการ (ส่ง default_reply)
 */
export async function getFaqCsv(): Promise<string> {
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
      console.error(
        "[sheet] fetch failed, falling back to stale cache:",
        err
      );
      return cache.csv;
    }
    console.error("[sheet] fetch failed, no cache available:", err);
    throw err;
  }
}
