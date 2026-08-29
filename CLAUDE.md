# CLAUDE.md — LINE Bot AI Project

## What we're building

LINE Official Account bot for **Moda Coffee** (ร้านกาแฟ) · ตอบลูกค้า 24 ชม. ในนาม
"พี่กะชาย" โดยใช้ Gemini 3.5 Flash อ่าน FAQ จาก Google Sheet · ส่ง reply กลับ LINE

## Stack — locked

- Next.js 14 App Router + TypeScript
- `@line/bot-sdk` for LINE Messaging API
- `@google/genai` for Gemini
- Google Sheet CSV public URL for FAQ (3 คอลัมน์: หมวด, คำถาม, คำตอบ)
- Vercel for hosting (Hobby tier OK สำหรับ <100k req/เดือน)
- npm

## Repo conventions

- `app/api/line-webhook/route.ts` — POST handler (verify signature → process → reply)
- `lib/sheet.ts` — fetch + parse (CSV → FAQ text) + cache Google Sheet
- `lib/gemini.ts` — build system prompt (hallucination guard) + call Gemini
- `lib/line.ts` — verify signature + reply message (พร้อม retry)
- `lib/log.ts` — structured JSON logging helper
- `rich-menu/` — rich menu JSON config + รูป (เตรียมเองแยกต่างหาก)
- `scripts/install-rich-menu.mjs` — script ติดตั้ง rich menu ผ่าน LINE API

## Business facts (Moda Coffee)

- ชื่อบอท/persona: **พี่กะชาย**
- โทน: เป็นกันเอง อบอุ่น ขี้เล่นนิดๆ
- FAQ หมวดหลัก: เมนู, เวลาเปิด-ปิด, ที่ตั้ง, การจอง (ตอบเป็นข้อความ — ไม่มี Flex Card ยืนยันจองอัตโนมัติ เพราะร้านให้ลูกค้าทัก LINE บอกวัน-เวลา-จำนวนเอง)
- Smart Handoff (แจ้งกลุ่มแอดมิน LINE อัตโนมัติ) — **ยังไม่ implement** ในเวอร์ชันนี้ (ยังไม่มีกลุ่มแอดมิน) — บอทมี out-of-scope trigger ในระดับ prompt (ตอบ "ขอแอดมินติดต่อกลับ") แต่ไม่ push message เข้ากลุ่มอัตโนมัติ ถ้าต้องการเปิดใช้ทีหลัง ให้เพิ่ม `lib/handoff.ts` ตาม pattern เดียวกับ `line-bot-recipe.md` ส่วนที่ 4.4 แล้วเรียกก่อน `askGemini` ใน webhook

## Env vars (Vercel)

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `GEMINI_API_KEY`
- `SHEET_CSV_URL`

## Don'ts

- ❌ Hardcode any token/key — use env vars
- ❌ Skip signature verification — security risk
- ❌ Skip timeout on Gemini calls — webhook must reply within 10s (client-side timeout อยู่ใน `lib/gemini.ts` แล้ว — 8s)
- ❌ Cache FAQ for >60s — owner edits Sheet should reflect quickly
- ❌ Log full LINE message content or full userId — PII risk · log only metadata (ความยาวข้อความ, userId 8 ตัวท้าย, latency, finishReason)
