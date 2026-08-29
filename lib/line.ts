/**
 * lib/line.ts
 * Helper: verify signature ของ LINE webhook + ส่ง reply message ผ่าน Messaging API (พร้อม retry)
 */

import { messagingApi, validateSignature } from "@line/bot-sdk";
import type { WebhookEvent } from "@line/bot-sdk";
import { log } from "./log";

/**
 * ตรวจสอบ x-line-signature เทียบกับ raw body + LINE_CHANNEL_SECRET
 * ต้องใช้ raw body string (ไม่ใช่ parsed JSON) เพราะ signature คำนวณจาก byte ดิบ
 */
export function verifySignature(
  rawBody: string,
  signature: string | null
): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret || !signature) return false;

  try {
    return validateSignature(rawBody, channelSecret, signature);
  } catch (err) {
    log.error("line.signature_validation_error", { err: String(err) });
    return false;
  }
}

let client: messagingApi.MessagingApiClient | null = null;

function getClient(): messagingApi.MessagingApiClient {
  if (!client) {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!channelAccessToken) {
      throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
    }
    client = new messagingApi.MessagingApiClient({ channelAccessToken });
  }
  return client;
}

/**
 * ส่งข้อความ reply กลับผ่าน replyToken · retry แบบ exponential backoff (LINE API ตอบช้าบางครั้ง)
 * ตาม error handling table: ถ้าส่งไม่สำเร็จทุก attempt ให้ log error ไว้ ไม่ throw ต่อ
 * เพราะถ้า throw จะทำให้ webhook response fail แล้ว LINE จะ retry event ซ้ำ
 */
export async function replyText(
  replyToken: string,
  text: string,
  attempts = 3
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await getClient().replyMessage({
        replyToken,
        messages: [{ type: "text", text }],
      });
      return;
    } catch (err) {
      const isLastAttempt = i === attempts - 1;
      log.error("line.reply_message_failed", {
        attempt: i + 1,
        isLastAttempt,
        err: String(err),
      });
      if (isLastAttempt) return; // replyToken อาจหมดอายุแล้ว — swallow ไม่ throw ต่อ
      await new Promise((r) => setTimeout(r, 300 * (i + 1))); // exponential backoff
    }
  }
}

export type { WebhookEvent };
