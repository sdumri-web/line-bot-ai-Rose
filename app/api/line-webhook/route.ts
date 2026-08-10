/**
 * app/api/line-webhook/route.ts
 * Webhook endpoint หลัก — รับ event จาก LINE, ถาม Gemini โดยอ้างอิง FAQ, แล้ว reply กลับ
 *
 * Flow (ตามบรีฟ):
 *  1. verify signature (x-line-signature + LINE_CHANNEL_SECRET) — ไม่ตรง → 401 ทันที
 *  2. parse events → filter message.type === "text"
 *  3. fetch FAQ จาก sheet.ts (cache 60 วิ)
 *  4. build prompt → call gemini.ts
 *  5. finishReason === "MAX_TOKENS" → ใช้ default_reply แทน (ทำใน gemini.ts แล้ว)
 *  6. reply กลับผ่าน LINE Messaging API (ต้องเสร็จภายใน 10 วิ ตาม LINE timeout)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySignature, replyText, type WebhookEvent } from "@/lib/line";
import { getFaqCsv } from "@/lib/sheet";
import { askGemini, DEFAULT_REPLY } from "@/lib/gemini";

// ต้องใช้ Node.js runtime (ไม่ใช่ edge) เพราะ @line/bot-sdk + @google/genai พึ่ง Node APIs
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifySignature(rawBody, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let events: WebhookEvent[] = [];
  try {
    const parsed = JSON.parse(rawBody);
    events = Array.isArray(parsed.events) ? parsed.events : [];
  } catch (err) {
    console.error("[webhook] invalid JSON body:", err);
    return new NextResponse("Bad Request", { status: 400 });
  }

  // ประมวลผลทุก event แบบขนาน แล้วรอให้เสร็จก่อนตอบ LINE (ต้องอยู่ในกรอบ 10 วิของ LINE timeout)
  await Promise.all(events.map(handleEvent));

  return NextResponse.json({ status: "ok" });
}

// LINE บางกรณี (เช่น verify webhook URL ในหน้า console) จะยิง GET เข้ามาเช็คว่า endpoint ตอบ 200
export async function GET() {
  return NextResponse.json({ status: "ok" });
}

async function handleEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== "message" || event.message.type !== "text") {
    return;
  }

  const { replyToken } = event;
  const userMessage = event.message.text;

  let faqCsv: string;
  try {
    faqCsv = await getFaqCsv();
  } catch (err) {
    // Sheet ดึงไม่ได้ + ไม่มี cache เก่าให้ fallback → ส่ง default_reply
    console.error("[webhook] failed to load FAQ, sending default reply:", err);
    await replyText(replyToken, DEFAULT_REPLY);
    return;
  }

  // askGemini เองก็ catch error/MAX_TOKENS ภายในแล้วคืน DEFAULT_REPLY ถ้าจำเป็น
  const reply = await askGemini(faqCsv, userMessage);
  await replyText(replyToken, reply);
}
