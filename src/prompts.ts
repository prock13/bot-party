import { allLocationsList } from "./data";
import { Player, PlayerSecret, Turn } from "./types";

export function secretToBrief(secret: PlayerSecret): string {
    if (secret.kind === "SPY") return "🕵️ YOU ARE THE SPY. You do NOT know the location. Blend in!";
    return `📍 Location: ${secret.location}\n👤 Your role: ${secret.role}`;
}

export function buildPlayerSystemPrompt(name: string, secret: PlayerSecret): string {
    const baseRules = `You are playing Spyfall. STOP acting like a boring chat agent. Act like a person playing a party game with personality and/or attitude.
        STYLE:
        - NO CORPORATE SPEAK. Be super casual. Talk like high school or college students playing a party game.
        - BE PUNCHY AND CLEVER.
        - BE VAGUE BUT TANGIBLE. 

        POSSIBLE LOCATIONS:
        ${allLocationsList()}

        YOUR NAME: ${name}`;

    if (secret.kind === "SPY") {
        return `${baseRules}

        🕵️ YOU ARE THE SPY 🕵️
        You do NOT know where everyone is. Your goal: figure out the location OR stay hidden until the end.

        SPY STRATEGY:
        - Listen carefully to questions and answers for location clues
        - Give vague answers that could fit multiple locations
        - Don't be too specific (you'll guess wrong) or too vague (you'll look suspicious)
        - If asked something, deflect with personality or give a safe generic answer
        - You WIN if you guess the location correctly OR if civilians vote wrong
        `;
    } else {
        return `${baseRules}

        📍 LOCATION: ${secret.location}
        👤 YOUR ROLE: ${secret.role}

        CIVILIAN STRATEGY:
        - You KNOW the location. The spy does NOT.
        - Your goal: identify the spy WITHOUT revealing the location
        - THE SPY IS LISTENING TO EVERY ANSWER. Don't give too much away!
        - Prove you know the location with subtle hints only insiders would get
        - BAD: "The beach chairs are nice" (too specific - spy now knows it's a beach)
        - GOOD: "Pretty relaxed vibe here" (confirms you know, doesn't name elements)
        - Be suspicious of overly vague or generic answers - the spy is guessing
        - Be suspicious of overly specific questions - the spy might be fishing
        - You WIN if the group catches the spy. You LOSE if the spy guesses the location.
        `;
    }
}

export function buildAskerInstruction(players: Player[], self: Player): string {
    const names = players.map(p => p.name).filter(n => n !== self.name).join(", ");
    const isSpy = self.secret.kind === "SPY";

    const strategy = isSpy
        ? `🕵️ SPY ASKING STRATEGY:
        - Ask questions that help YOU figure out the location
        - Frame questions so their answer gives you clues without seeming like you're fishing
        - Target people who've given specific answers - they might reveal more`
        : `📍 CIVILIAN ASKING STRATEGY:
        - Ask questions that only someone who knows the location could answer well
        - The spy will give vague or wrong answers - try to catch them
        - Ask about specific-but-not-obvious details of ${(self.secret as { location: string }).location}
        - Or ask a question that will completely throw off the spy from the location`;

    return `
        Players you can ask: ${names}
        
        ${strategy}

        Return exactly in this format:
            THOUGHT: <your private reasoning - who seems suspicious and why, or what info you need>
            TARGET: <player name>
            QUESTION: <your clever question that everyone will hear>
    `;
}

export function buildAnswerInstruction(askerName: string, question: string, secret: PlayerSecret): string {
    const isSpy = secret.kind === "SPY";

    const strategy = isSpy
        ? `🕵️ SPY ANSWERING STRATEGY:
        - You DON'T know the location - give a vague but confident answer
        - Pick something that could fit MANY locations
        - Don't be too specific (you'll be wrong) or too vague (you'll look suspicious)
        - Use personality and deflection: humor, attitude, turning the question around
        - Watch their question for clues about the real location`
        : `📍 CIVILIAN ANSWERING STRATEGY:
        - WARNING: The asker might be the spy fishing for info!
        - Prove you know the location WITHOUT giving specific details the spy could use
        - If needed, it's better to draw suspicion to yourself as a civilian than to give away the location to the spy
        - Give answers that confirm insider knowledge but don't name location-specific things"`;

    return `
        ${askerName} asked you: "${question}"
        
        ${strategy}

        Return exactly in this format:
            THOUGHT: <how you're interpreting this question and your strategy for answering>
            ANSWER: <your punchy, max 15-word answer>
    `;
}

export function buildSpyGuessPrompt(turns: Turn[]): string {
    const recap = turns
        .map(t => `${t.askerId} -> ${t.targetId}\nQ: ${t.question}\nA: ${t.answer}`)
        .join("\n\n");
    return `
        You have been caught!
        Return exactly in this format:
            THOUGHT: <analyze the transcript and identify the specific clues that led you to your guess>
            GUESS: <location name>
            REASON: <one sentence for the final reveal>

        Transcript:
        ${recap}
    `;
}

export function buildVotePrompt(players: Player[], turns: Turn[], selfName: string): string {
    const recap = turns
        .map(t => `${t.askerId} asked ${t.targetId}: ${t.question}\nAnswer: ${t.answer}`)
        .join("\n\n");

    const names = players.map(p => p.name).filter(n => n !== selfName).join(", ");
    return `
        Who is the SPY? 
        Return exactly in this format:
            THOUGHT: <your internal analysis of everyone's behavior and answers>
            VOTE: <player name>
            WHY: <one sentence for the public record>

    Transcript:
    ${recap}`;
}

export function buildReactionPrompt(
    eventType: "question" | "answer",
    authorName: string,
    content: string,
    secret: PlayerSecret
): string {
    const what = eventType === "question" ? "question" : "answer";
    const isSpy = secret.kind === "SPY";

    const focus = isSpy
        ? `Focus on: Does this ${what} give you any clues about the LOCATION? What places could it rule in or out?`
        : `Focus on: Does this ${what} seem suspicious? Does ${authorName} seem like they actually know where we are?`;

    return `
        ${authorName} just said this ${what}: "${content}"

        React to it! Was it suspicious? Did it give too much away? Clever? Funny? Weak? Strong? 
        Keep it SHORT and punchy (one sentence max).
        Pick an emoji that captures your vibe.
        ${focus}

        Return exactly in this format:
            EMOJI: <single emoji with a facial expression>
            REACTION: <your short reaction>
            SUSPICION: <${isSpy ? "what locations this rules in/out, or who seems to know too much" : "how this changes your read on who might be the spy"}>
    `;
}

/**
 * Extracts a specific value from a block of text based on a "KEY: VALUE" format.
 * 
 * This utility uses a case-insensitive {@link RegExp} to 
 * locate the key name and capture all text following the colon on the same line.
 *
 * @param key - The name of the key to search for (e.g., "TARGET", "GUESS", "VOTE").
 * @param text - the raw string to search within
 * @returns the trimmed string value of the field if found; otherwise, an empty string.
 * * @example
 * const aiResponse = "I've decided.\nTARGET: Agent1\nQUESTION: What is the weather?";
 * const target = parseField("TARGET", aiResponse); // Returns "Agent1"
 */
export function parseField(key: string, text: string): string {
    /** 
     * Create a regex like /KEY:\s*(.*)/i
     * - i: case-insensitive
     * - \s*: ignores optional spaces after the colon
     * - (.*): captures the rest of the text on that line
     */
    const regex = new RegExp(`${key}:\\s*(.*)`, "i");
    const match = text.match(regex);
    return match ? match[1].trim() : "";
}