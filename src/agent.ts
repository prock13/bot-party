import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-5.2";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export type PromptType = "ask a question" | "answer a question" | "vote" | "guess the location";

export type PromptEntry = {
    phase: PromptType;
    agentName: string;
    messages: Msg[];
    response: string;
};

export class Agent {
    private memory: Msg[] = [];
    private onPrompt?: (entry: PromptEntry) => void;

    constructor(public name: string, systemPrompt: string, onPrompt?: (entry: PromptEntry) => void) {
        this.memory.push({ role: "system", content: systemPrompt });
        this.onPrompt = onPrompt;
    }

    async say(userContent: string, phase: PromptType = "ask a question"): Promise<string> {
        this.memory.push({ role: "user", content: userContent });
        const messagesSent = [...this.memory];

        const resp = await openai.chat.completions.create({
            model: MODEL,
            messages: this.memory,
            reasoning_effort: "medium",
        });

        const text = resp.choices[0]?.message?.content?.trim() || "(no response)";
        this.memory.push({ role: "assistant", content: text });

        this.onPrompt?.({ phase, agentName: this.name, messages: messagesSent, response: text });
        return text;
    }
}
