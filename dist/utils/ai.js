"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyIssueWithAI = classifyIssueWithAI;
exports.verifyImageWithText = verifyImageWithText;
const genai_1 = require("@google/genai");
const ALLOWED_CATEGORIES = [
    "Potholes / Road Maintenance",
    "Garbage Overflow / Waste Management",
    "Street Lights",
    "Water Supply",
    "Parks & Gardens",
    "Traffic Signals",
];
const ai = new genai_1.GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});
function classifyIssueWithAI(imageBuffer) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
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
            const response = yield ai.models.generateContent({
                model: "gemini-2.5-pro",
                contents,
            });
            let rawText = ((_f = (_e = (_d = (_c = (_b = (_a = response.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text) === null || _f === void 0 ? void 0 : _f.trim()) || "";
            rawText = rawText.replace(/```json|```/g, "").trim();
            let parsed = { title: "Spam Report", description: "", category: "Spam" };
            try {
                parsed = JSON.parse(rawText);
            }
            catch (err) {
                console.warn("⚠️ Gemini returned unparseable JSON; marking as Spam", err);
                return parsed;
            }
            if (!ALLOWED_CATEGORIES.includes(parsed.category)) {
                parsed.category = "Spam";
                parsed.title = "Spam Report";
            }
            return parsed;
        }
        catch (err) {
            console.error("❌ Gemini classify error:", err);
            return { title: "Spam Report", description: "", category: "Spam" };
        }
    });
}
function verifyImageWithText(imageBuffer, textDescription) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
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
            const response = yield ai.models.generateContent({
                model: "gemini-2.5-pro",
                contents: prompt,
            });
            let rawText = ((_f = (_e = (_d = (_c = (_b = (_a = response.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text) === null || _f === void 0 ? void 0 : _f.trim()) || "";
            rawText = rawText.replace(/```json|```/g, "").trim();
            let parsed = { match: false, confidence: 0, reason: "Could not parse" };
            try {
                parsed = JSON.parse(rawText);
            }
            catch (err) {
                console.warn("⚠️ Could not parse Gemini verification JSON", err);
            }
            return parsed;
        }
        catch (err) {
            console.error("❌ Gemini verification error:", err);
            return { match: false, confidence: 0, reason: "Verification error" };
        }
    });
}
