/**
 * lib/line.ts
 * Helper: verify signature ของ LINE webhook + ส่ง reply message ผ่าน Messaging API
 */

import { messagingApi, validateSignature } from "@line/bot-sdk";
import type { WebhookEvent } from "@line/bot-sdk";

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
    console.error("[line] signature validation error:", err);
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
 * ส่งข้อความ reply กลับผ่าน replyToken
 * ตาม error handling table: ถ้าส่งไม่สำเร็จ ให้ log error ไว้ ไม่ throw ต่อ
 * เพราะถ้า throw จะทำให้ webhook response fail แล้ว LINE จะ retry event ซ้ำ
 */
export async function replyText(replyToken: string, text: string): Promise<void> {
  try {
    await getClient().replyMessage({
      replyToken,
      messages: [{ type: "text", text }],
    });
  } catch (err) {
    console.error("[line] replyMessage failed:", err);
  }
}

export type { WebhookEvent };
