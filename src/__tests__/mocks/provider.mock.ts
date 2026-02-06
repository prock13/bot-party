import type { AIProvider, ChatMessage, ProviderType } from "../../providers/types";

export class MockAIProvider implements AIProvider {
    readonly type: ProviderType;
    readonly displayName: string;
    readonly supportsStateful: boolean;
    
    private responses: string[] = [];
    private responseIndex = 0;
    
    constructor(type: ProviderType = "openai", displayName: string = "MockGPT", supportsStateful = false) {
        this.type = type;
        this.displayName = displayName;
        this.supportsStateful = supportsStateful;
    }
    
    setResponses(responses: string[]): void {
        this.responses = responses;
        this.responseIndex = 0;
    }
    
    async init(_systemPrompt: string): Promise<void> {
        // No-op for mock
    }
    
    async chat(_messages: ChatMessage[]): Promise<string> {
        if (this.responseIndex >= this.responses.length) {
            return "THOUGHT: Default response\nANSWER: I don't know.";
        }
        return this.responses[this.responseIndex++];
    }
    
    async chatStateful(_userContent: string): Promise<string> {
        if (!this.supportsStateful) {
            throw new Error("Stateful mode not supported by mock provider");
        }
        return this.chat([]);
    }
    
    async cleanup(): Promise<void> {
        // No-op for mock
    }
}

export function createMockProvider(type: ProviderType = "openai"): MockAIProvider {
    const displayNames: Record<ProviderType, string> = {
        openai: "MockGPT",
        anthropic: "MockClaude",
        google: "MockGemini",
    };
    return new MockAIProvider(type, displayNames[type], type !== "anthropic");
}
