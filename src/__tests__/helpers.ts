import { MockAIProvider } from "./mocks/provider.mock";
import { mockLocations } from "./fixtures";
import type { GameConfig, PlayerSlotConfig } from "../types";

export function createTestConfig(overrides?: Partial<GameConfig>): GameConfig {
    return {
        rounds: 3,
        allowEarlyVote: true,
        ...overrides,
    };
}

export function createTestPlayerSlots(count: number): PlayerSlotConfig[] {
    const slots: PlayerSlotConfig[] = [];
    for (let i = 0; i < count; i++) {
        slots.push({
            type: "openai",
            mode: "memory",
        });
    }
    return slots;
}

export function seedRandom(seed: number): void {
    // Simple seeded random for deterministic tests
    let state = seed;
    Math.random = () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

export function restoreRandom(): void {
    // Restore original Math.random
    delete (Math as any).random;
}
