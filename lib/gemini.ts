/**
 * lib/gemini.ts
 * Build prompt จาก FAQ + คำถามลูกค้า แล้วเรียก Gemini API (@google/genai)
 */

import { GoogleGenAI } from "@google/genai";

export const DEFAULT_REPLY =
  "ขออภัยค่ะ เรื่องนี้พี่ยังไม่มีข้อมูลในระบบ 🙏 รบกวนติดต่อทางร้านโดยตรงเพื่อความถูกต้องนะคะ";

const MODEL = "gemini-3.5-flash";

// Gemini 3.x: temperature default = 1.0 — อย่าปรับลด ไม่งั้น output จะเพี้ยน (ตามบรีฟ)
const TEMPERATURE = 1.0;

// Gemini 3.x: maxOutputTokens นับรวม thinking tokens + output tokens
// ตั้งต่ำเกินไป (เช่น 200) จะโดนตัดกลางประโยคก่อนได้คำตอบจริง
const MAX_OUTPUT_TOKENS = 1024;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

function buildPrompt(faqCsv: string, userMessage: string): string {
  return `<role>
คุณคือ "พี่ที่ร้าน" ร้านอาหารตามสั่ง ตอบลูกค้าทาง LINE ในนามร้าน
</role>

<constraints>
- ตอบโดยใช้ข้อมูลใน <faq> เท่านั้น ห้ามแต่งราคา เวลา หรือที่ตั้งเอง
- ถ้าไม่มีข้อมูลใน FAQ ให้ตอบด้วยข้อความนี้เท่านั้น:
  "${DEFAULT_REPLY}"
- โทนภาษา: สุภาพแบบมีระยะ (ไม่สนิทสนมเกินไป) ใช้ emoji ได้เล็กน้อย (1 ตัวต่อคำตอบพอ)
- ความยาวคำตอบ: 1-3 ประโยค กระชับ ตรงประเด็น
</constraints>

<output_format>
ตอบเป็นภาษาไทย ห้ามใช้ markdown (ไม่มี **, #, -, ตาราง)
</output_format>

<faq>
${faqCsv}
</faq>

<question>
${userMessage}
</question>`;
}

/**
 * เรียก Gemini ด้วย FAQ + คำถามลูกค้า
 * - log finishReason, thoughtsTokenCount, candidatesTokenCount ทุกครั้ง
 * - ถ้า finishReason === "MAX_TOKENS" → คืน DEFAULT_REPLY (กันส่งข้อความขาดกลางประโยค)
 * - ถ้า error/timeout ใด ๆ → catch แล้วคืน DEFAULT_REPLY ทันที ไม่ปล่อยให้ throw ขึ้นไปหา webhook
 */
export async function askGemini(
  faqCsv: string,
  userMessage: string
): Promise<string> {
  try {
    const ai = getClient();
    const prompt = buildPrompt(faqCsv, userMessage);

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    });

    const finishReason = response.candidates?.[0]?.finishReason;
    const thoughtsTokenCount = response.usageMetadata?.thoughtsTokenCount;
    const candidatesTokenCount = response.usageMetadata?.candidatesTokenCount;

    console.log("[gemini] request result:", {
      finishReason,
      thoughtsTokenCount,
      candidatesTokenCount,
    });

    if (finishReason === "MAX_TOKENS") {
      console.warn(
        "[gemini] finishReason=MAX_TOKENS, falling back to default reply"
      );
      return DEFAULT_REPLY;
    }

    const text = response.text?.trim();
    if (!text) {
      console.warn("[gemini] empty response text, falling back to default reply");
      return DEFAULT_REPLY;
    }

    return text;
  } catch (err) {
    console.error("[gemini] request failed:", err);
    return DEFAULT_REPLY;
  }
}
