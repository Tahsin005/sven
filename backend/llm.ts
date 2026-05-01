import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./prompt";

const askLLMStream = async (prompt: string, client: OpenAI, model: string) => {
  try {
    const stream = await client.chat.completions.create({
        model,
        stream: true,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
        ],
    });

    return {
        success: true,
        stream,
    };
  } catch (error: unknown) {
    console.error("AI Gateway API Error:", error);

    return {
        success: false,
        error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
};

export default askLLMStream;