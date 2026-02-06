import { describe, it, expect } from "vitest";
import { tallyVotes } from "./voting";
import type { Player } from "../types";

describe("tallyVotes", () => {
    const players: Player[] = [
        { 
            id: "1" as any, 
            name: "Alice", 
            isHuman: false,
            secret: { kind: "CIVILIAN", location: "Airplane", role: "Pilot" }
        },
        { 
            id: "2" as any, 
            name: "Bob", 
            isHuman: false,
            secret: { kind: "CIVILIAN", location: "Airplane", role: "Passenger" }
        },
        { 
            id: "3" as any, 
            name: "Charlie", 
            isHuman: false,
            secret: { kind: "SPY" }
        },
    ];

    it("should identify accused with most votes", () => {
        const votes = new Map<string, number>([
            ["Alice", 1],
            ["Bob", 2],
            ["Charlie", 0],
        ]);
        
        const result = tallyVotes(votes, players);
        expect(result.accusedName).toBe("Bob");
        expect(result.isTie).toBe(false);
        expect(result.spy.name).toBe("Charlie");
    });

    it("should detect ties", () => {
        const votes = new Map<string, number>([
            ["Alice", 2],
            ["Bob", 2],
            ["Charlie", 1],
        ]);
        
        const result = tallyVotes(votes, players);
        expect(result.accusedName).toBe(null);
        expect(result.isTie).toBe(true);
    });

    it("should handle unanimous vote", () => {
        const votes = new Map<string, number>([
            ["Charlie", 3],
        ]);
        
        const result = tallyVotes(votes, players);
        expect(result.accusedName).toBe("Charlie");
        expect(result.isTie).toBe(false);
    });

    it("should handle all tied votes", () => {
        const votes = new Map<string, number>([
            ["Alice", 1],
            ["Bob", 1],
            ["Charlie", 1],
        ]);
        
        const result = tallyVotes(votes, players);
        expect(result.isTie).toBe(true);
        expect(result.accusedName).toBe(null);
    });

    it("should identify spy correctly", () => {
        const votes = new Map<string, number>([
            ["Alice", 1],
        ]);
        
        const result = tallyVotes(votes, players);
        expect(result.spy.id).toBe("3");
        expect(result.spy.name).toBe("Charlie");
    });
});
