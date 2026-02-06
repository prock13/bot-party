import { describe, it, expect } from "vitest";
import { resolveTargetPlayer } from "./resolveTargetPlayer";
import type { PlayerId, Player } from "../types";

describe("resolveTargetPlayer", () => {
    const players: Player[] = [
        { id: "1" as PlayerId, name: "Alice", isHuman: false, secret: { kind: "CIVILIAN", location: "Test", role: "Role1" } },
        { id: "2" as PlayerId, name: "Bob", isHuman: false, secret: { kind: "CIVILIAN", location: "Test", role: "Role2" } },
        { id: "3" as PlayerId, name: "Charlie", isHuman: false, secret: { kind: "CIVILIAN", location: "Test", role: "Role3" } },
        { id: "4" as PlayerId, name: "GPT-1", isHuman: false, secret: { kind: "CIVILIAN", location: "Test", role: "Role4" } },
    ];

    it("should match exact name", () => {
        const result = resolveTargetPlayer(players, "Alice", "2" as PlayerId);
        expect(result.name).toBe("Alice");
    });

    it("should match case-insensitively", () => {
        const result = resolveTargetPlayer(players, "alice", "2" as PlayerId);
        expect(result.name).toBe("Alice");
        
        const result2 = resolveTargetPlayer(players, "BOB", "1" as PlayerId);
        expect(result2.name).toBe("Bob");
    });

    it("should match partial names", () => {
        const result = resolveTargetPlayer(players, "Char", "1" as PlayerId);
        expect(result.name).toBe("Charlie");
    });

    it("should exclude asker", () => {
        // When asker is Alice (1), trying to target Alice should pick someone else
        const result = resolveTargetPlayer(players, "Alice", "1" as PlayerId);
        expect(result.name).not.toBe("Alice");
    });

    it("should exclude lastAsker if provided", () => {
        // When asker is Alice (1) and lastAsker is Bob (2), should not pick Bob
        const result = resolveTargetPlayer(players, "Bob", "1" as PlayerId, "2" as PlayerId);
        expect(result.name).not.toBe("Bob");
    });

    it("should return fallback player if no match", () => {
        const result = resolveTargetPlayer(players, "InvalidName", "1" as PlayerId, "2" as PlayerId);
        expect(result).toBeDefined();
        expect(result.id).not.toBe("1");
        expect(result.id).not.toBe("2");
    });

    it("should match GPT-style names", () => {
        const result = resolveTargetPlayer(players, "GPT-1", "2" as PlayerId);
        expect(result.name).toBe("GPT-1");
    });

    it("should handle single valid player", () => {
        const singlePlayer: Player[] = [{ id: "1" as PlayerId, name: "Alice", isHuman: false, secret: { kind: "CIVILIAN", location: "Test", role: "Role1" } }];
        const result = resolveTargetPlayer(singlePlayer, "Alice", "2" as PlayerId);
        expect(result.name).toBe("Alice");
    });
});
