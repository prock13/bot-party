import { describe, it, expect } from "vitest";
import { parseField } from "../utils/parseField";

describe("parseField", () => {
    it("should extract a field from text", () => {
        const text = "THOUGHT: I'm thinking\nTARGET: Alice\nQUESTION: What's up?";
        expect(parseField("TARGET", text)).toBe("Alice");
        expect(parseField("THOUGHT", text)).toBe("I'm thinking");
        expect(parseField("QUESTION", text)).toBe("What's up?");
    });

    it("should return empty string when field is missing", () => {
        const text = "TARGET: Alice\nQUESTION: What's up?";
        expect(parseField("THOUGHT", text)).toBe("");
    });

    it("should handle multi-line field values", () => {
        const text = "THOUGHT: This is a long thought\nthat spans multiple lines\nTARGET: Bob";
        const thought = parseField("THOUGHT", text);
        expect(thought).toContain("This is a long thought");
    });

    it("should extract emoji field", () => {
        const text = "EMOJI: 🤔\nCOMMENT: Interesting";
        expect(parseField("EMOJI", text)).toBe("🤔");
    });

    it("should extract vote field", () => {
        const text = "THOUGHT: Bob seems suspicious\nVOTE: Bob";
        expect(parseField("VOTE", text)).toBe("Bob");
    });

    it("should extract guess field", () => {
        const text = "THOUGHT: I think I know\nGUESS: Casino";
        expect(parseField("GUESS", text)).toBe("Casino");
    });

    it("should handle windows line endings", () => {
        const text = "THOUGHT: Thinking\r\nTARGET: Alice\r\nQUESTION: What?";
        expect(parseField("TARGET", text)).toBe("Alice");
    });

    it("should trim whitespace", () => {
        const text = "TARGET:   Alice   \nQUESTION:  What?  ";
        expect(parseField("TARGET", text)).toBe("Alice");
        expect(parseField("QUESTION", text)).toBe("What?");
    });

    it("should handle case-insensitive field names", () => {
        const text = "target: Alice\nquestion: What?";
        expect(parseField("TARGET", text)).toBe("Alice");
    });
});
