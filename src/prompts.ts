import { allLocationsList, type LocationPack } from "./data";
import { Player, PlayerSecret, Turn } from "./types";
import { Personality, NEUTRAL_PERSONALITY, applyPersonalityToPrompt } from "./personalities";

export function secretToBrief(secret: PlayerSecret): string {
    if (secret.kind === "SPY") return "🕵️ YOU ARE THE SPY. You do NOT know the location. Blend in!";
    return `📍 Location: ${secret.location}\n👤 Your role: ${secret.role}`;
}

export function buildPlayerSystemPrompt(
    name: string, 
    secret: PlayerSecret, 
    personality: Personality = NEUTRAL_PERSONALITY,
    locationPack?: LocationPack
): string {
    const baseRules = `You are playing Spyfall. STOP acting like a boring chat agent. Act like a person playing a party game with personality and/or attitude.
        STYLE:
        - NO CORPORATE SPEAK. Be super casual. Talk like high school or college students playing a party game.
        - BE PUNCHY AND CLEVER.
        - BE VAGUE BUT TANGIBLE. 

        POSSIBLE LOCATIONS:
        ${allLocationsList()}

        YOUR NAME: ${name}`;

    if (secret.kind === "SPY") {
        const spyPrompt = `${baseRules}

        🕵️ YOU ARE THE SPY 🕵️
        You do NOT know where everyone is. Your goal: figure out the location OR stay hidden until the end.

        SPY STRATEGY:
        - Listen carefully to questions and answers for location clues
        - Give vague answers that could fit multiple locations
        - Don't be too specific (you'll guess wrong) or too vague (you'll look suspicious)
        - If asked something, deflect with personality or give a safe generic answer
        - You WIN if you guess the location correctly OR if civilians vote wrong
        `;
        return applyPersonalityToPrompt(spyPrompt, personality);
    } else {
        // Get role hints for civilians
        const roleHints = locationPack ? 
            `\n        💡 OTHER ROLES AT ${secret.location}: ${locationPack.roles.filter(r => r !== secret.role).slice(0, 4).join(", ")}...`
            : "";
        
        const civilianPrompt = `${baseRules}

        📍 LOCATION: ${secret.location}
        👤 YOUR ROLE: ${secret.role}${roleHints}

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
        return applyPersonalityToPrompt(civilianPrompt, personality);
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
        Players you can ask (use the EXACT name from this list): ${names}
        
        ${strategy}

        Return exactly in this format:
            THOUGHT: <your private reasoning - who seems suspicious and why, or what info you need>
            TARGET: <exact player name from the list above - copy it exactly, e.g. ${names.split(",").map(n => n.trim())[0] || "PlayerName"}>
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
        You have been caught! The group convicted you as the spy.
        You get ONE last chance: guess the location correctly and you still win!

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

export function buildActionChoicePrompt(
    players: Player[],
    turns: Turn[],
    self: Player,
    canAccuse: boolean
): string {
    const isSpy = self.secret.kind === "SPY";
    const recap = turns.slice(-5) // Last 5 turns for context
        .map(t => `${t.askerId} -> ${t.targetId}: Q: ${t.question} A: ${t.answer}`)
        .join("\n");

    const options = isSpy
        ? `Your options:
        - QUESTION: Ask someone a question (safe, gather more info)
        - GUESS: Guess the location NOW (risky - if wrong, you lose immediately!)${canAccuse ? `
        - ACCUSE: Accuse someone of being the spy (others vote yes/no - use to frame someone!)` : ""}`
        : `Your options:
        - QUESTION: Ask someone a question (gather more info, test someone)${canAccuse ? `
        - ACCUSE: Accuse someone of being the spy! Others vote yes/no. If majority agrees and you're right, civilians win. If wrong, spy wins!` : ""}`;

    const strategy = isSpy
        ? `🕵️ SPY DECISION:
        - If you're confident about the location, GUESS could win you the game
        - If you're unsure, keep asking questions to gather clues
        - ACCUSE can frame an innocent - risky but could cause chaos!`
        : `📍 CIVILIAN DECISION:
        - If you're confident who the spy is, ACCUSE them! Majority must agree.
        - If wrong, the spy wins immediately - be sure before accusing!
        - Keep asking questions if you need more info`;

    return `
        It's your turn. New actions are now available!

        Recent conversation:
        ${recap || "(no turns yet)"}

        ${options}

        ${strategy}

        Return exactly in this format:
            THOUGHT: <your reasoning for what to do>
            ACTION: <question OR guess OR accuse>
    `;
}

export function buildEarlySpyGuessPrompt(turns: Turn[]): string {
    const recap = turns
        .map(t => `${t.askerId} -> ${t.targetId}\nQ: ${t.question}\nA: ${t.answer}`)
        .join("\n\n");
    return `
        🎲 You're taking a risk and guessing the location NOW!
        
        If you're RIGHT, you WIN immediately!
        If you're WRONG, you LOSE immediately!

        Analyze the clues carefully.

        Return exactly in this format:
            THOUGHT: <analyze the clues - what location fits best?>
            GUESS: <location name>
            REASON: <one sentence explanation>

        Transcript:
        ${recap}
    `;
}

export function buildAccusationPrompt(players: Player[], turns: Turn[], self: Player): string {
    const names = players.map(p => p.name).filter(n => n !== self.name).join(", ");
    const recap = turns.slice(-5)
        .map(t => `${t.askerId} -> ${t.targetId}: Q: ${t.question} A: ${t.answer}`)
        .join("\n");

    return `
        🚨 You're making an ACCUSATION! This is serious!

        You will accuse someone of being the spy.
        Everyone else will vote YES or NO on your accusation.
        - If majority votes YES and you're RIGHT → Civilians win!
        - If majority votes YES and you're WRONG → Spy wins!
        - If majority votes NO → Accusation fails, game continues.

        Players you can accuse: ${names}

        Recent conversation:
        ${recap || "(no turns yet)"}

        Return exactly in this format:
            THOUGHT: <why you think this person is the spy>
            TARGET: <player name to accuse>
            REASON: <one dramatic sentence for the accusation - this is public!>
    `;
}

export function buildDefensePrompt(
    accuserName: string,
    accusation: string,
    turns: Turn[],
    self: Player
): string {
    const isSpy = self.secret.kind === "SPY";
    const recap = turns.slice(-5)
        .map(t => `${t.askerId} -> ${t.targetId}: Q: ${t.question} A: ${t.answer}`)
        .join("\n");

    const strategy = isSpy
        ? `🕵️ SPY STRATEGY:
        - Stay calm! Don't act guilty.
        - Point out how your answers were consistent with the location
        - Deflect suspicion onto others if possible
        - Act offended but not TOO defensive`
        : `📍 CIVILIAN STRATEGY:
        - Remind everyone of your helpful, specific answers
        - Point out how you clearly knew the location
        - Stay calm and logical - panic looks suspicious
        - Maybe redirect attention to who REALLY seems suspicious`;

    return `
        🚨 YOU'VE BEEN ACCUSED!

        ${accuserName} just accused you of being the spy!
        Their reason: "${accusation}"

        This is your chance to defend yourself before everyone votes!
        Make your case - your fate depends on it!

        ${strategy}

        Recent conversation:
        ${recap || "(no turns yet)"}

        Return exactly in this format:
            THOUGHT: <your private strategy for this defense>
            DEFENSE: <your public defense speech - be dramatic and persuasive!>
    `;
}

export function buildAccusationVotePrompt(
    accuserName: string,
    accusedName: string,
    defense: string,
    turns: Turn[],
    self: Player
): string {
    const isSpy = self.secret.kind === "SPY";
    const recap = turns.slice(-5)
        .map(t => `${t.askerId} -> ${t.targetId}: Q: ${t.question} A: ${t.answer}`)
        .join("\n");

    const strategy = isSpy
        ? `🕵️ SPY STRATEGY: 
        - Vote YES on innocent players to eliminate them!
        - Vote NO if they're accusing YOU
        - Create doubt and confusion`
        : `📍 CIVILIAN STRATEGY:
        - Vote YES only if you're confident ${accusedName} is the spy
        - If wrong, the spy wins immediately!
        - Vote NO if unsure - better to keep playing than lose`;

    return `
        ⚖️ ${accuserName} accuses ${accusedName} of being the spy!

        ${accusedName}'s defense: "${defense}"

        Do you agree with the accusation? Vote YES to convict or NO to reject.
        Majority rules - if most vote YES, ${accusedName} is convicted.

        ${strategy}

        Recent conversation:
        ${recap || "(no turns yet)"}

        Return exactly in this format:
            THOUGHT: <your reasoning>
            VOTE: <YES or NO>
            REASON: <one sentence explanation - this is public!>
    `;
}