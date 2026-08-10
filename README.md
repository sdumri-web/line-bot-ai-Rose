# line-bot-ai-Rose

LINE Bot ร้านอาหารตามสั่ง — ตอบลูกค้าในนาม **"พี่ที่ร้าน"** ด้วย Gemini AI โดยอ้างอิงคำตอบจาก FAQ ใน Google Sheet เท่านั้น

## Stack

- Next.js 14 (App Router) + TypeScript
- [@line/bot-sdk](https://www.npmjs.com/package/@line/bot-sdk) — verify signature + reply message
- [@google/genai](https://www.npmjs.com/package/@google/genai) — เรียก `gemini-3.5-flash`
- Deploy บน Vercel

## โครงไฟล์

```
app/
  api/
    line-webhook/
      route.ts        # webhook endpoint หลัก (POST /api/line-webhook)
lib/
  sheet.ts             # ดึง + cache FAQ จาก Google Sheet CSV (60 วิ)
  gemini.ts            # build prompt + เรียก Gemini API
  line.ts              # verify signature + reply message helper
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

3. Google Sheet FAQ ต้องมี 2 คอลัมน์: `question`, `answer` แล้ว publish เป็น CSV (public URL)

4. รัน dev server

   ```bash
   npm run dev
   ```

## Deploy บน Vercel

```bash
git add .
git commit -m "feat: LINE bot with Gemini AI for restaurant FAQ"
git push origin main
```

- ตั้ง environment variables ทั้ง 4 ตัวใน Vercel Project Settings
- หลัง deploy สำเร็จ → ตั้ง webhook URL ใน LINE Developers Console เป็น:
  `https://<your-vercel-url>/api/line-webhook`
- `vercel.json` ระบุ `"framework": "nextjs"` ไว้ตรง ๆ กัน Vercel auto-detect ผิด

## หมายเหตุการ implement (สำคัญ)

- `temperature: 1.0` — ค่า default ของ Gemini 3.x ห้ามปรับลด ไม่งั้น output จะเพี้ยน
- `maxOutputTokens: 1024` — Gemini 3.x นับ thinking tokens + output tokens รวมกัน ตั้งต่ำไปจะโดนตัดกลางประโยค
- ทุก request log `finishReason`, `thoughtsTokenCount`, `candidatesTokenCount`
- ถ้า `finishReason === "MAX_TOKENS"` → ส่ง default_reply แทนคำตอบที่อาจขาดกลางประโยค
- FAQ ต้องมาก่อน question เสมอในโครง prompt (context ก่อน task)
- Error handling: sheet ดึงไม่ได้ใช้ cache เก่า/default_reply, Gemini error/timeout → default_reply ทันที, LINE reply ส่งไม่สำเร็จ → log อย่างเดียวไม่ throw (กัน LINE retry event ซ้ำ), signature ไม่ตรง → 401 ทันที
