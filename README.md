# Moda Coffee — LINE Bot AI

LINE Bot ร้านกาแฟ **Moda Coffee** — ตอบลูกค้าในนาม **"พี่กะชาย"** ด้วย Gemini AI โดยอ้างอิงคำตอบจาก FAQ ใน Google Sheet เท่านั้น (production-grade: hallucination guard, retry, structured logging, timeout)

## Stack

- Next.js 14 (App Router) + TypeScript
- [@line/bot-sdk](https://www.npmjs.com/package/@line/bot-sdk) — verify signature + reply message (พร้อม retry)
- [@google/genai](https://www.npmjs.com/package/@google/genai) — เรียก `gemini-3.5-flash`
- Deploy บน Vercel

## โครงไฟล์

```
app/
  api/
    line-webhook/
      route.ts        # webhook endpoint หลัก (POST /api/line-webhook)
lib/
  sheet.ts             # ดึง + cache + parse FAQ จาก Google Sheet CSV (60 วิ, 3 คอลัมน์: หมวด/คำถาม/คำตอบ)
  gemini.ts            # build hallucination-guard system prompt + เรียก Gemini API (มี client-side timeout)
  line.ts              # verify signature + reply message (retry + exponential backoff)
  log.ts               # structured JSON logging
rich-menu/
  rich-menu.json        # rich menu config (3 ปุ่ม: เมนู/สินค้า, เวลาเปิด-ปิด, ที่ตั้ง)
  rich-menu.jpg          # (เตรียมเอง) รูป 2500x843 px — ดู rich-menu/README.md
scripts/
  install-rich-menu.mjs # ติดตั้ง rich menu ผ่าน LINE API
CLAUDE.md              # project doc สำหรับ Claude Code
PRD.md                 # requirements + acceptance criteria
TESTING.md             # real conversation library สำหรับทดสอบบอท
```

## Setup

1. ติดตั้ง dependencies

   ```bash
   npm install
   ```

2. คัดลอก `.env.example` เป็น `.env.local` แล้วกรอกค่า

   ```bash
   cp .env.example .env.local
   ```

   | ตัวแปร | คำอธิบาย |
   |---|---|
   | `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console > Messaging API |
   | `LINE_CHANNEL_SECRET` | LINE Developers Console > Basic settings |
   | `GEMINI_API_KEY` | Google AI Studio API key |
   | `SHEET_CSV_URL` | Google Sheet > File > Share > Publish to web > CSV |

3. Google Sheet FAQ ต้องมี 3 คอลัมน์: `หมวด (category)`, `คำถาม (question)`, `คำตอบ (answer)` แล้ว publish เป็น CSV (public URL)

4. รัน dev server

   ```bash
   npm run dev
   ```

## Deploy บน Vercel

```bash
git add .
git commit -m "feat: production-grade upgrade for Moda Coffee bot"
git push origin main
```

- ตั้ง environment variables ทั้ง 4 ตัวใน Vercel Project Settings
- หลัง deploy สำเร็จ → ตั้ง webhook URL ใน LINE Developers Console เป็น:
  `https://<your-vercel-url>/api/line-webhook`
- `vercel.json` ระบุ `"framework": "nextjs"` ไว้ตรง ๆ กัน Vercel auto-detect ผิด

## ติดตั้ง Rich Menu

ดู [`rich-menu/README.md`](./rich-menu/README.md) — ต้องเตรียมรูป `.jpg` ขนาด 2500x843px เองก่อน แล้วรัน:

```bash
npm run install-rich-menu
```

## ทดสอบบอท

ดู [`TESTING.md`](./TESTING.md) — บทสนทนาทดสอบ 25 บท (คำถามตรง, paraphrase, out-of-FAQ, prompt injection, out-of-scope trigger) อิงจาก FAQ จริงของ Moda Coffee

## หมายเหตุการ implement (สำคัญ)

- `temperature: 1.0` — ค่า default ของ Gemini 3.x ห้ามปรับลด ไม่งั้น output จะเพี้ยน
- `maxOutputTokens: 1024` + `thinkingBudget: 512` — Gemini 3.x นับ thinking tokens + output tokens รวมกัน ตั้งต่ำไปจะโดนตัดกลางประโยค
- Client-side timeout 8 วิ บน Gemini call (`lib/gemini.ts`) — กันแขวนเกิน LINE reply window (10 วิ)
- Reply ไป LINE มี retry (exponential backoff, 3 ครั้ง) — กัน LINE API ตอบช้าเป็นครั้งคราว
- ทุก request log แบบ JSON structured (`lib/log.ts`) — `finishReason`, token counts, latency — ไม่ log ข้อความลูกค้าเต็มๆ หรือ userId เต็มๆ (PII)
- ถ้า `finishReason === "MAX_TOKENS"` → ส่ง default_reply แทนคำตอบที่อาจขาดกลางประโยค
- FAQ ต้องมาก่อน question เสมอในโครง prompt (context ก่อน task)
- System prompt มี hallucination guard 3 ชั้น: `<guardrails>` (ห้ามทำอะไร) + `<reasoning_protocol>` (คิดเป็นขั้นก่อนตอบ) + `<out_of_scope_triggers>` (keyword ที่ควรตอบ "ขอแอดมินติดต่อกลับ" แทนการเดา)
- Error handling: sheet ดึงไม่ได้ใช้ cache เก่า/default_reply, Gemini error/timeout → default_reply ทันที, LINE reply ส่งไม่สำเร็จ → retry แล้ว log อย่างเดียวไม่ throw (กัน LINE retry event ซ้ำ), signature ไม่ตรง → 401 ทันที
- **Smart Handoff ยังไม่เปิดใช้** (ยังไม่มีกลุ่มแอดมิน) — ดู `CLAUDE.md` และ `PRD.md > Future` สำหรับวิธีเปิดทีหลัง
