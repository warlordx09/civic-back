
import { GoogleGenAI } from "@google/genai";

const ALLOWED_CATEGORIES = [
  "Potholes / Road Maintenance",
  "Garbage Overflow / Waste Management",
  "Street Lights",
  "Water Supply",
  "Parks & Gardens",
  "Traffic Signals",
];

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});


export async function classifyIssueWithAI(imageBuffer: Buffer) {
  try {
    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `You will be given an image inline. Classify the civic issue and reply ONLY with JSON matching this schema:

{
  "title": "short title (max 8 words)",
  "description": "brief description (1-2 sentences)",
  "category": "one of: Potholes / Road Maintenance, Garbage Overflow / Waste Management, Street Lights, Water Supply, Parks & Gardens, Traffic Signals, or Spam"
}

If the image does not belong to any of the six categories, set "category" to "Spam".`,
          },
          {
            inlineData: {
              data: imageBuffer.toString("base64"),
              mimeType: "image/jpeg",
            },
          },
        ],
      },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents,
    });

    let rawText =
      response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";


    rawText = rawText.replace(/```json|```/g, "").trim();

    let parsed = { title: "Spam Report", description: "", category: "Spam" };

    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      console.warn("⚠️ Gemini returned unparseable JSON; marking as Spam", err);
      return parsed;
    }

    if (!ALLOWED_CATEGORIES.includes(parsed.category)) {
      parsed.category = "Spam";
      parsed.title = "Spam Report";
    }

    return parsed;
  } catch (err) {
    console.error("❌ Gemini classify error:", err);
    return { title: "Spam Report", description: "", category: "Spam" };
  }
}

export async function verifyImageWithText(imageBuffer: Buffer, textDescription: string) {
  try {
    const prompt = [
      {
        role: "user",
        parts: [
          {
            text: `Does the image match this description? "${textDescription}" Reply in JSON: {"match": true/false, "confidence": 0-1, "reason":"short"}`,
          },
          {
            inlineData: {
              data: imageBuffer.toString("base64"),
              mimeType: "image/jpeg",
            },
          },
        ],
      },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
    });

    let rawText =
      response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    rawText = rawText.replace(/```json|```/g, "").trim();

    let parsed = { match: false, confidence: 0, reason: "Could not parse" };

    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      console.warn("⚠️ Could not parse Gemini verification JSON", err);
    }

    return parsed;
  } catch (err) {
    console.error("❌ Gemini verification error:", err);
    return { match: false, confidence: 0, reason: "Verification error" };
  }
}
