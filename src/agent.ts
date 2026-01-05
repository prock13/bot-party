import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export class Agent {
    private memory: Msg[] = [];

    constructor(public name: string, systemPrompt: string) {
        this.memory.push({ role: "system", content: systemPrompt });
    }

    async say(userContent: string): Promise<string> {
        this.memory.push({ role: "user", content: userContent });

        const resp = await openai.chat.completions.create({
            model: MODEL,
            messages: this.memory
        });

        const text = resp.choices[0]?.message?.content?.trim() || "(no response)";
        this.memory.push({ role: "assistant", content: text });
        return text;
    }
}
