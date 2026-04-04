import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export const analyzeTaskUrgency = async (taskDetails: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following task details and determine the urgency (REGULAR, URGENT, MOST_URGENT) and provide a brief reason.
    Task Details: ${taskDetails}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          urgency: { type: Type.STRING, enum: ["REGULAR", "URGENT", "MOST_URGENT"] },
          reason: { type: Type.STRING }
        },
        required: ["urgency", "reason"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const predictDelay = async (task: any) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Predict if the following task might be delayed based on its deadline and current progress.
    Task: ${JSON.stringify(task)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isLikelyDelayed: { type: Type.BOOLEAN },
          probability: { type: Type.NUMBER },
          reason: { type: Type.STRING }
        },
        required: ["isLikelyDelayed", "probability", "reason"]
      }
    }
  });
  return JSON.parse(response.text);
};
