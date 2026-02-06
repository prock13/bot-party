import { AIProvider, ProviderType, ChatMessage, AgentMode, createProvider } from "./providers";

type Msg = ChatMessage;

export type PromptType = "ask a question" | "answer a question" | "vote" | "guess the location" | "react" | "choose action";

// Re-export AgentMode from providers for convenience
export type { AgentMode } from "./providers";

export type PromptEntry = {
    /** Unique ID to correlate sent/received events */
    id: string;
    /** "sent" = prompt going out; "received" = response back */
    kind: "sent" | "received";
    phase: PromptType;
    agentName: string;
    /** Provider used (e.g., "openai", "anthropic", "google") */
    provider: ProviderType;
    /** Messages sent (in "sent") or empty (in "received"). */
    messages: Msg[];
    /** Empty in "sent", populated in "received". */
    response: string;
};

export type AgentCreatedEntry = {
    agentName: string;
    provider: ProviderType;
    mode: AgentMode;
    systemPrompt: string;
};

export type AgentOptions = {
    name: string;
    systemPrompt: string;
    /** AI provider to use. Default: "openai" */
    provider?: ProviderType;
    /** Optional model override for the provider */
    model?: string;
    /** "memory" = client-side history; "stateful" = server-side history. Default: "memory". */
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
    public readonly providerType: ProviderType;
    public readonly displayName: string;
    
    private readonly _mode: AgentMode;
    private readonly systemPrompt: string;
    private readonly provider: AIProvider;
    private onPrompt?: (entry: PromptEntry) => void;
    private onAgentCreated?: (entry: AgentCreatedEntry) => void;

    // Memory mode state (client-side history)
    private memory: Msg[] = [];

    /** Resolves when the agent is fully initialized (awaitable before using). */
    public readonly ready: Promise<void>;
    
    /** Get the agent's mode (memory or stateful) */
    public get mode(): AgentMode {
        return this._mode;
    }

    constructor(opts: AgentOptions) {
        this.name = opts.name;
        this.systemPrompt = opts.systemPrompt;
        this.providerType = opts.provider ?? "openai";
        this.onPrompt = opts.onPrompt;
        this.onAgentCreated = opts.onAgentCreated;

        // Create the provider
        this.provider = createProvider({ type: this.providerType, model: opts.model });
        this.displayName = this.provider.displayName;

        // Determine mode - fall back to memory if provider doesn't support stateful
        const requestedMode = opts.mode ?? "memory";
        if (requestedMode === "stateful" && !this.provider.supportsStateful) {
            console.warn(`Stateful mode not supported by ${this.providerType}. Falling back to memory mode.`);
            this._mode = "memory";
        } else {
            this._mode = requestedMode;
        }

        // Initialize based on mode
        if (this._mode === "memory") {
            this.memory.push({ role: "system", content: this.systemPrompt });
            this.ready = Promise.resolve();
        } else {
            // Stateful mode - provider manages history
            this.ready = this.provider.init(this.systemPrompt);
        }
    }

    /** Emit the agent created event. Call this after the agent is ready and when you want it logged. */
    emitCreated(): void {
        this.onAgentCreated?.({ 
            agentName: this.name, 
            provider: this.providerType,
            mode: this._mode, 
            systemPrompt: this.systemPrompt 
        });
    }

    async say(userContent: string, phase: PromptType = "ask a question"): Promise<string> {
        if (this._mode === "memory") {
            return this.sayWithMemory(userContent, phase);
        } else {
            return this.sayStateful(userContent, phase);
        }
    }

    private async sayWithMemory(userContent: string, phase: PromptType): Promise<string> {
        this.memory.push({ role: "user", content: userContent });
        const messagesSent = [...this.memory];
        const id = nextPromptId();

        // Fire "sent" before API call
        this.onPrompt?.({ 
            id, kind: "sent", phase, 
            agentName: this.name, 
            provider: this.providerType,
            messages: messagesSent, 
            response: "" 
        });

        const text = await this.provider.chat(this.memory);
        this.memory.push({ role: "assistant", content: text });

        // Fire "received" after response
        this.onPrompt?.({ 
            id, 
            kind: "received", 
            phase, 
            agentName: this.name, 
            provider: this.providerType,
            messages: [], 
            response: text 
        });
        return text;
    }

    private async sayStateful(userContent: string, phase: PromptType): Promise<string> {
        await this.ready;
        const id = nextPromptId();

        // For inspection: only show user message (system prompt was logged on agent creation)
        const messagesForInspect: Msg[] = [
            { role: "user", content: userContent },
        ];

        // Fire "sent" before API call
        this.onPrompt?.({ 
            id, kind: "sent", phase, 
            agentName: this.name, 
            provider: this.providerType,
            messages: messagesForInspect, 
            response: "" 
        });

        try {
            const text = await this.provider.chatStateful(userContent);

            // Fire "received" after response
            this.onPrompt?.({ 
                id, kind: "received", phase, 
                agentName: this.name, 
                provider: this.providerType,
                messages: [], 
                response: text 
            });
            return text;
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            this.onPrompt?.({ 
                id, 
                kind: "received", 
                phase, 
                agentName: this.name, 
                provider: this.providerType,
                messages: [], 
                response: `Error: ${errMsg}` 
            });
            return `Error: ${errMsg}`;
        }
    }

    /** Cleanup any provider resources (threads, sessions, etc.). */
    async cleanup(): Promise<void> {
        await this.provider.cleanup();
    }
}
