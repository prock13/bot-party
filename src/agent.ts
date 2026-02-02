import { openai, MODEL, type AgentMode } from "./openai";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export type PromptType = "ask a question" | "answer a question" | "vote" | "guess the location" | "react";

export type PromptEntry = {
    /** Unique ID to correlate sent/received events */
    id: string;
    /** "sent" = prompt going out; "received" = response back */
    kind: "sent" | "received";
    phase: PromptType;
    agentName: string;
    /** Messages sent (in "sent") or empty (in "received"). */
    messages: Msg[];
    /** Empty in "sent", populated in "received". */
    response: string;
};

export type AgentCreatedEntry = {
    agentName: string;
    mode: AgentMode;
    systemPrompt: string;
};

export type AgentOptions = {
    name: string;
    systemPrompt: string;
    /** "memory" = Chat Completions with full history; "thread" = Assistants API with server-side thread. Default: "memory". */
    mode?: AgentMode;
    onPrompt?: (entry: PromptEntry) => void;
    onAgentCreated?: (entry: AgentCreatedEntry) => void;
};

let promptIdCounter = 0;
function nextPromptId(): string {
    return `prompt-${++promptIdCounter}`;
}

export class Agent {
    public readonly name: string;
    private readonly mode: AgentMode;
    private readonly systemPrompt: string;
    private onPrompt?: (entry: PromptEntry) => void;
    private onAgentCreated?: (entry: AgentCreatedEntry) => void;

    // Memory mode state
    private memory: Msg[] = [];

    // Thread mode state
    private assistantId?: string;
    private threadId?: string;
    private threadReady?: Promise<void>;

    /** Resolves when the agent is fully initialized (awaitable before using). */
    public readonly ready: Promise<void>;

    constructor(opts: AgentOptions) {
        this.name = opts.name;
        this.systemPrompt = opts.systemPrompt;
        this.mode = opts.mode ?? "memory";
        this.onPrompt = opts.onPrompt;
        this.onAgentCreated = opts.onAgentCreated;

        if (this.mode === "memory") {
            this.memory.push({ role: "system", content: this.systemPrompt });
            this.ready = Promise.resolve();
        } else {
            // Initialize thread mode asynchronously
            this.threadReady = this.initThread();
            this.ready = this.threadReady;
        }
    }

    private async initThread(): Promise<void> {
        const assistant = await openai.beta.assistants.create({
            name: this.name,
            instructions: this.systemPrompt,
            model: MODEL,
        });
        this.assistantId = assistant.id;

        const thread = await openai.beta.threads.create();
        this.threadId = thread.id;
    }

    /** Emit the agent created event. Call this after the agent is ready and when you want it logged. */
    emitCreated(): void {
        this.onAgentCreated?.({ agentName: this.name, mode: this.mode, systemPrompt: this.systemPrompt });
    }

    async say(userContent: string, phase: PromptType = "ask a question"): Promise<string> {
        if (this.mode === "memory") {
            return this.sayWithMemory(userContent, phase);
        } else {
            return this.sayWithThread(userContent, phase);
        }
    }

    private async sayWithMemory(userContent: string, phase: PromptType): Promise<string> {
        this.memory.push({ role: "user", content: userContent });
        const messagesSent = [...this.memory];
        const id = nextPromptId();

        // Fire "sent" before API call
        this.onPrompt?.({ id, kind: "sent", phase, agentName: this.name, messages: messagesSent, response: "" });

        const resp = await openai.chat.completions.create({
            model: MODEL,
            messages: this.memory,
        });

        const text = resp.choices[0]?.message?.content?.trim() || "(no response)";
        this.memory.push({ role: "assistant", content: text });

        // Fire "received" after response
        this.onPrompt?.({ id, kind: "received", phase, agentName: this.name, messages: [], response: text });
        return text;
    }

    private async sayWithThread(userContent: string, phase: PromptType): Promise<string> {
        await this.threadReady;
        const id = nextPromptId();

        // For inspection: only show user message (system prompt was logged on agent creation)
        const messagesForInspect: Msg[] = [
            { role: "user", content: userContent },
        ];

        // Fire "sent" before API call
        this.onPrompt?.({ id, kind: "sent", phase, agentName: this.name, messages: messagesForInspect, response: "" });

        // Add user message to thread
        await openai.beta.threads.messages.create(this.threadId!, {
            role: "user",
            content: userContent,
        });

        // Run the assistant
        const run = await openai.beta.threads.runs.createAndPoll(this.threadId!, {
            assistant_id: this.assistantId!,
        });

        if (run.status !== "completed") {
            const errMsg = `Run failed with status: ${run.status}`;
            this.onPrompt?.({ id, kind: "received", phase, agentName: this.name, messages: [], response: errMsg });
            return errMsg;
        }

        // Get latest assistant message
        const messages = await openai.beta.threads.messages.list(this.threadId!, { limit: 1, order: "desc" });
        const lastMsg = messages.data[0];
        const textBlock = lastMsg?.content?.find((c) => c.type === "text");
        const text = (textBlock?.type === "text" ? textBlock.text?.value?.trim() : null) || "(no response)";

        // Fire "received" after response
        this.onPrompt?.({ id, kind: "received", phase, agentName: this.name, messages: [], response: text });
        return text;
    }

    /** Cleanup: delete assistant and thread (call when done with this agent). */
    async cleanup(): Promise<void> {
        if (this.mode === "thread" && this.assistantId) {
            try {
                await openai.beta.threads.delete(this.threadId!);
                await openai.beta.assistants.delete(this.assistantId);
            } catch {
                // Ignore cleanup errors
            }
        }
    }
}
