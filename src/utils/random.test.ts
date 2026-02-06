import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { pickRandom, safePickRandom, shuffle } from "./random";

describe("random utilities", () => {
    describe("pickRandom", () => {
        it("should pick an item from array", () => {
            const items = ["a", "b", "c"];
            const result = pickRandom(items);
            expect(items).toContain(result);
        });

        it("should work with single item", () => {
            const items = ["only"];
            expect(pickRandom(items)).toBe("only");
        });
    });

    describe("safePickRandom", () => {
        it("should pick an item from array", () => {
            const items = ["a", "b", "c"];
            const result = safePickRandom(items, "fallback");
            expect(items).toContain(result);
        });

        it("should return fallback for empty array", () => {
            const result = safePickRandom([], "fallback");
            expect(result).toBe("fallback");
        });

        it("should work with single item", () => {
            const items = ["only"];
            expect(safePickRandom(items, "fallback")).toBe("only");
        });
    });

    describe("shuffle", () => {
        it("should preserve all items", () => {
            const items = [1, 2, 3, 4, 5];
            const shuffled = shuffle([...items]);
            expect(shuffled.sort()).toEqual(items.sort());
        });

        it("should not modify original array", () => {
            const items = [1, 2, 3];
            const original = [...items];
            shuffle(items);
            expect(items).toEqual(original);
        });

        it("should handle empty array", () => {
            expect(shuffle([])).toEqual([]);
        });

        it("should handle single item", () => {
            expect(shuffle([1])).toEqual([1]);
        });

        it("should eventually produce different orders", () => {
            const items = [1, 2, 3, 4, 5];
            let foundDifferent = false;
            
            // Try multiple times - statistical chance of different order
            for (let i = 0; i < 10; i++) {
                const shuffled = shuffle([...items]);
                if (JSON.stringify(shuffled) !== JSON.stringify(items)) {
                    foundDifferent = true;
                    break;
                }
            }
            
            expect(foundDifferent).toBe(true);
        });
    });
});
