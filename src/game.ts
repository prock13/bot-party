import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { allLocationsList, LOCATIONS } from "./data";
import { Agent } from "./agent";
import { GameConfig, Player, PlayerId, PlayerSecret, Turn } from "./types";

/** ---------- small utilities ---------- */

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function safePickRandom<T>(arr: T[], fallback: T): T {
    return arr.length ? pickRandom(arr) : fallback;
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function normalizeName(s: string): string {
    return s.trim().toLowerCase();
}

/** Resolve a target by name, but never allow selecting self; always fall back to a valid alternative. */
function resolveOtherPlayer(players: Player[], targetName: string, excludeId: PlayerId): Player {
    const byName = players.find(p => normalizeName(p.name) === normalizeName(targetName));
    if (byName && byName.id !== excludeId) return byName;

    const notSelf = players.filter(p => p.id !== excludeId);
    return safePickRandom(notSelf, players.find(p => p.id !== excludeId) ?? players[0]);
}

/** ---------- prompt helpers ---------- */

function secretToBrief(secret: PlayerSecret): string {
    if (secret.kind === "SPY") return "🕵️ YOU ARE THE SPY. You do NOT know the location. Blend in!";
    return `📍 Location: ${secret.location}\n👤 Your role: ${secret.role}`;
}

function buildPlayerSystemPrompt(name: string, secret: PlayerSecret): string {
    const common = `
        You are playing Spyfall in a group chat.

        All possible locations in this game are:
        ${allLocationsList()}

        Rules:
        - If you are NOT the spy: you know the location. Answer questions naturally without being too obvious.
        - If you ARE the spy: you do not know the location. Infer it from others' answers.
        - Never explicitly reveal the location name.
        - Keep answers natural (1–3 sentences). Stay in-character.
        - Prefer vague, indirect phrasing.
        `;

    const personal = `\nYour name is ${name}.\n${secretToBrief(secret)}\n`;
    return common + personal;
}

function buildAskerInstruction(players: Player[], self: Player): string {
    const names = players.map(p => p.name).filter(n => n !== self.name).join(", ");
    return `
        Players you can ask: ${names}
        Your job: Ask ONE clever question to ONE player to gather info.
        Return exactly:
        TARGET: <player name>
        QUESTION: <your question>
    `;
}

function buildAnswerInstruction(askerName: string, question: string): string {
    return `${askerName} asked you: "${question}"\nAnswer appropriately for Spyfall (1-3 sentences).`;
}

function buildSpyGuessPrompt(turns: Turn[]): string {
    const recap = turns
        .map(t => `${t.askerId} -> ${t.targetId}\nQ: ${t.question}\nA: ${t.answer}`)
        .join("\n\n");
    return `
        You have been caught! This is your final chance to win. 
        Based on the transcript, guess the location. Be dramatic.
        Reply exactly with:
        GUESS: <location name>
        REASON: <one sentence explaining what clue gave it away>

    Transcript:
    ${recap}`;
}

function buildVotePrompt(players: Player[], turns: Turn[], selfName: string): string {
    const recap = turns
        .map(t => `${t.askerId} asked ${t.targetId}: ${t.question}\nAnswer: ${t.answer}`)
        .join("\n\n");

    const names = players.map(p => p.name).filter(n => n !== selfName).join(", ");
    return `
        Review the transcript. Who is the SPY? 
        Candidates: ${names}
        Reply exactly with:
        VOTE: <player name>
        WHY: <one sentence reasoning>

    Transcript:
    ${recap}`;
}

function parseField(text: string, field: string): string {
    const regex = new RegExp(`${field}:\\s*(.*)`, "i");
    const match = text.match(regex);
    return match ? match[1].trim() : "";
}

/** ---------- PlayerControllers ---------- */

type AskResult = { targetName: string; question: string };

interface PlayerController {
    ask(players: Player[], self: Player): Promise<AskResult>;
    answer(askerName: string, question: string): Promise<string>;
    guessLocation(turns: Turn[], self: Player): Promise<string | null>;
    vote(players: Player[], turns: Turn[], self: Player): Promise<string>;
}

class HumanController implements PlayerController {
    constructor(private rl: ReturnType<typeof readline.createInterface>) {}

    async ask(players: Player[], self: Player): Promise<AskResult> {
        const others = players.filter(p => p.id !== self.id).map(p => p.name);
        console.log(`\nIt is your turn to ask.`);
        const targetName = await this.rl.question(`Choose a target (${others.join(", ")}): `);
        const question = await this.rl.question(`Your question: `);
        return { targetName, question };
    }

    async answer(askerName: string, question: string): Promise<string> {
        console.log(`\n❓ ${askerName} asked you: ${question}`);
        return await this.rl.question(`Your answer: `);
    }

    async guessLocation(_turns: Turn[], self: Player): Promise<string | null> {
        console.log("\n🚨 You've been accused! One last chance to guess the location.");
        const guess = await this.rl.question("Your final guess: ");
        return `GUESS: ${guess}\nREASON: Human intuition.`;
    }

    async vote(players: Player[], _turns: Turn[], self: Player): Promise<string> {
        const candidates = players.map(p => p.name).filter(n => n !== self.name);
        const vote = await this.rl.question(`\n🗳️ Vote for the SPY (${candidates.join(", ")}): `);
        return `VOTE: ${vote}`;
    }
}

class AgentController implements PlayerController {
    constructor(private agent: Agent) {}

    async ask(players: Player[], self: Player): Promise<AskResult> {
        const askText = await this.agent.say(buildAskerInstruction(players, self));
        return {
            targetName: parseField(askText, "TARGET"),
            question: parseField(askText, "QUESTION") || "What do you think of the atmosphere here?"
        };
    }

    async answer(askerName: string, question: string): Promise<string> {
        return await this.agent.say(buildAnswerInstruction(askerName, question));
    }

    async guessLocation(turns: Turn[], self: Player): Promise<string | null> {
        if (self.secret.kind !== "SPY") return null;
        return await this.agent.say(buildSpyGuessPrompt(turns));
    }

    async vote(players: Player[], turns: Turn[], self: Player): Promise<string> {
        return await this.agent.say(buildVotePrompt(players, turns, self.name));
    }
}

/** ---------- Game Engine ---------- */

export class SpyfallGame {
    private rl: ReturnType<typeof readline.createInterface> | null = null;
    private running = false;

    async run(config: GameConfig) {
        if (this.running) return;
        this.running = true;
        this.rl = readline.createInterface({ input, output });

        try {
            const pack = pickRandom(LOCATIONS);
            const spyIndex = Math.floor(Math.random() * config.numPlayers);
            const roles = shuffle(pack.roles).slice(0, config.numPlayers - 1);

            const players: Player[] = [];
            for (let i = 0; i < config.numPlayers; i++) {
                const isHuman = config.includeHuman && i === 0;
                const name = isHuman ? "You" : `Agent${i}`;
                const secret: PlayerSecret = (i === spyIndex) 
                    ? { kind: "SPY" } 
                    : { kind: "CIVILIAN", location: pack.location, role: roles.pop() || "Visitor" };
                
                players.push({ id: name, name, isHuman, secret });
            }

            const controllers = new Map<PlayerId, PlayerController>();
            for (const p of players) {
                controllers.set(p.id, p.isHuman 
                    ? new HumanController(this.rl) 
                    : new AgentController(new Agent(p.name, buildPlayerSystemPrompt(p.name, p.secret)))
                );
            }

            const human = players.find(p => p.isHuman);
            if (human) console.log(`\n=== YOUR IDENTITY ===\n${secretToBrief(human.secret)}\n=====================\n`);

            const turns: Turn[] = [];
            const order = shuffle(players);

            // 1. QUESTION ROUNDS
            for (let r = 0; r < config.rounds; r++) {
                const asker = order[r % order.length];
                const askerCtl = controllers.get(asker.id)!;
                const result = await askerCtl.ask(players, asker);
                
                const target = resolveOtherPlayer(players, result.targetName, asker.id);
                const answer = await controllers.get(target.id)!.answer(asker.name, result.question);

                turns.push({ askerId: asker.name, targetId: target.name, question: result.question, answer });
                console.log(`\n[Turn ${r + 1}] ${asker.name} ➔ ${target.name}\nQ: ${result.question}\nA: ${answer}`);
            }

            // 2. VOTING
            console.log("\n=== 🗳️ VOTING PHASE ===");
            const votes = new Map<string, number>();
            for (const p of players) {
                const rawVote = await controllers.get(p.id)!.vote(players, turns, p);
                const voteName = parseField(rawVote, "VOTE");
                const validCandidate = players.find(x => normalizeName(x.name) === normalizeName(voteName) && x.id !== p.id);
                const finalVote = validCandidate?.name || safePickRandom(players.filter(x => x.id !== p.id), players[0]).name;
                
                votes.set(finalVote, (votes.get(finalVote) || 0) + 1);
                console.log(`${p.name} voted for: ${finalVote}`);
            }

            // 3. TALLY & REVEAL
            const sortedVotes = [...votes.entries()].sort((a, b) => b[1] - a[1]);
            const isTie = sortedVotes.length > 1 && sortedVotes[0][1] === sortedVotes[1][1];
            const accusedName = isTie ? null : sortedVotes[0][0];
            const spy = players.find(p => p.secret.kind === "SPY")!;

            console.log(`\n⚖️ VERDICT: ${isTie ? "A tie! The group is paralyzed by doubt." : `The group accuses ${accusedName}!`}`);
            console.log(`🕵️ REVEAL: The Spy was indeed ${spy.name}!`);

            // 4. THE SPY'S REDEMPTION GUESS
            let spyGuessedRight = false;
            if (accusedName === spy.name || isTie) {
                console.log(`\n${spy.name} attempts a final guess...`);
                const guessRaw = await controllers.get(spy.id)!.guessLocation(turns, spy);
                const guessLoc = parseField(guessRaw || "", "GUESS");
                const reason = parseField(guessRaw || "", "REASON");

                console.log(`${spy.name}: "I believe we are at the ${guessLoc.toUpperCase()}!"`);
                if (reason) console.log(`Reason: "${reason}"`);

                spyGuessedRight = normalizeName(guessLoc) === normalizeName(pack.location);
            }

            // 5. FINAL SCORE
            console.log("\n" + "=".repeat(30));
            console.log(`📍 ACTUAL LOCATION: ${pack.location}`);
            if (spyGuessedRight) {
                console.log("🏆 RESULT: SPY WINS! (Correctly identified the location)");
            } else if (accusedName === spy.name) {
                console.log("🏆 RESULT: CIVILIANS WIN! (Spy was caught)");
            } else {
                console.log("🏆 RESULT: SPY WINS! (Total deception)");
            }
            console.log("=".repeat(30) + "\n");

        } finally {
            this.rl?.close();
            this.rl = null;
            this.running = false;
        }
    }
}