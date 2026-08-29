/**
 * app/api/line-webhook/route.ts
 * Webhook endpoint หลัก — รับ event จาก LINE, ถาม Gemini โดยอ้างอิง FAQ, แล้ว reply กลับ
 *
 * Flow (ตามบรีฟ):
 *  1. verify signature (x-line-signature + LINE_CHANNEL_SECRET) — ไม่ตรง → 401 ทันที
 *  2. parse events → filter message.type === "text"
 *  3. fetch FAQ จาก sheet.ts (cache 60 วิ)
 *  4. build prompt → call gemini.ts (มี client-side timeout กันแขวนเกิน 8s)
 *  5. finishReason === "MAX_TOKENS" → ใช้ default_reply แทน (ทำใน gemini.ts แล้ว)
 *  6. reply กลับผ่าน LINE Messaging API พร้อม retry (ต้องเสร็จภายใน 10 วิ ตาม LINE timeout)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySignature, replyText, type WebhookEvent } from "@/lib/line";
import { getFaqText } from "@/lib/sheet";
import { askGemini, DEFAULT_REPLY } from "@/lib/gemini";
import { log } from "@/lib/log";

// ต้องใช้ Node.js runtime (ไม่ใช่ edge) เพราะ @line/bot-sdk + @google/genai พึ่ง Node APIs
export const runtime = "nodejs";

// Vercel function timeout — ให้เผื่อขอบเยอะกว่า LINE reply window (10s) เล็กน้อยเพื่อให้ cleanup/log ทัน
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifySignature(rawBody, signature)) {
    log.warn("webhook.invalid_signature");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let events: WebhookEvent[] = [];
  try {
    const parsed = JSON.parse(rawBody);
    events = Array.isArray(parsed.events) ? parsed.events : [];
  } catch (err) {
    log.error("webhook.invalid_json_body", { err: String(err) });
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
  // อย่า log userId เต็มๆ ถ้าไม่จำเป็น — เก็บแค่ 8 ตัวท้ายพอสำหรับ trace โดยไม่กระทบ PII มาก
  const userIdTail =
    event.source.type === "user" ? event.source.userId?.slice(-8) : undefined;
  const startedAt = Date.now();

  try {
    let faqText: string;
    try {
      faqText = await getFaqText();
    } catch (err) {
      // Sheet ดึงไม่ได้ + ไม่มี cache เก่าให้ fallback → ส่ง default_reply
      log.error("webhook.faq_fetch_failed", { err: String(err), userIdTail });
      await replyText(replyToken, DEFAULT_REPLY);
      return;
    }

    // askGemini เองก็ catch error/timeout/MAX_TOKENS ภายในแล้วคืน DEFAULT_REPLY ถ้าจำเป็น
    const reply = await askGemini(faqText, userMessage);
    await replyText(replyToken, reply);

    log.info("webhook.reply_sent", {
      userIdTail,
      latencyMs: Date.now() - startedAt,
      replyLength: reply.length,
    });
  } catch (err) {
    log.error("webhook.unhandled_error", {
      err: String(err),
      userIdTail,
      latencyMs: Date.now() - startedAt,
    });
    // best-effort fallback — ถ้า replyToken หมดอายุไปแล้ว replyText จะ swallow เอง
    await replyText(replyToken, DEFAULT_REPLY);
  }
}
