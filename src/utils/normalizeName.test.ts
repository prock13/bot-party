import { describe, it, expect } from "vitest";
import { normalizeName } from "./normalizeName";

describe("normalizeName", () => {
    it("should convert to lowercase", () => {
        expect(normalizeName("Alice")).toBe("alice");
        expect(normalizeName("BOB")).toBe("bob");
        expect(normalizeName("ChArLiE")).toBe("charlie");
    });

    it("should trim whitespace", () => {
        expect(normalizeName("  Alice  ")).toBe("alice");
        expect(normalizeName("\tBob\n")).toBe("bob");
    });

    it("should handle empty strings", () => {
        expect(normalizeName("")).toBe("");
        expect(normalizeName("   ")).toBe("");
    });

    it("should handle special characters", () => {
        expect(normalizeName("Alice-123")).toBe("alice-123");
        expect(normalizeName("GPT-4")).toBe("gpt-4");
    });
});
