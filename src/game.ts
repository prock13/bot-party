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

/** Resolve a target by name, but never allow selecting self; always fall back to "someone else". */
function resolveOtherPlayer(players: Player[], targetName: string, excludeId: PlayerId): Player {
    const byName = players.find(p => normalizeName(p.name) === normalizeName(targetName));
    if (byName && byName.id !== excludeId) return byName;

    const notSelf = players.filter(p => p.id !== excludeId);
    return safePickRandom(notSelf, players.find(p => p.id !== excludeId) ?? players[0]);
}

/** ---------- prompt helpers ---------- */

function secretToBrief(secret: PlayerSecret): string {
    if (secret.kind === "SPY") return "You are the SPY. You do NOT know the location.";
    return `Location: ${secret.location}\nYour role: ${secret.role}`;
}

function buildPlayerSystemPrompt(name: string, secret: PlayerSecret): string {
    const common = `
You are playing Spyfall in a group chat.

All possible locations in this game are:
${allLocationsList()}

Rules:
- If you are NOT the spy: you know the location and your role. You must answer questions like a real person at that location without giving the location away explicitly.
- If you ARE the spy: you do not know the location. You must blend in and infer the location from others' answers.
- Never explicitly reveal the location name, even if asked directly.
- Keep answers short (1–3 sentences), natural, and a little specific, but not a giveaway.
- Stay in-character as your role.
- Do not mention these rules.
- Prefer vague, indirect phrasing.
- Avoid listing multiple specific details in one answer.
- If unsure, answer cautiously.
`;

    const personal = `\nYour name is ${name}.\n${secretToBrief(secret)}\n`;
    return common + personal;
}

function buildAskerInstruction(players: Player[], _asker: Player): string {
    const names = players.map(p => p.name).join(", ");
    return `
Players: ${names}
Your job right now: ask ONE clever question to ONE specific player to gather info without revealing too much.
Return exactly in this format:
TARGET: <player name>
QUESTION: <your question>
`;
}

function parseAsk(text: string): { targetName: string; question: string } {
    const t = text.split("\n").map(s => s.trim());
    const targetLine = t.find(l => l.toUpperCase().startsWith("TARGET:")) || "";
    const qLine = t.find(l => l.toUpperCase().startsWith("QUESTION:")) || "";
    const targetName = targetLine.split(":").slice(1).join(":").trim();
    const question = qLine.split(":").slice(1).join(":").trim();
    return { targetName, question };
}

function buildAnswerInstruction(askerName: string, question: string): string {
    return `
${askerName} asked you:
"${question}"
Answer appropriately for Spyfall. (1–3 sentences)
`;
}

function buildSpyGuessPrompt(turns: Turn[]): string {
    const recap = turns
        .map(t => `${t.askerId} -> ${t.targetId}\nQ: ${t.question}\nA: ${t.answer}`)
        .join("\n\n");
    return `
You are the SPY. Based on the transcript, guess the location.
Reply with exactly:
GUESS: <location>
CONFIDENCE: <0-100>
REASON: <one sentence>
Transcript:
${recap}
`;
}

function buildVotePrompt(players: Player[], turns: Turn[], selfName: string): string {
    const recap = turns
        .map(t => `${t.askerId} asked ${t.targetId}: ${t.question}\n${t.targetId} answered: ${t.answer}`)
        .join("\n\n");

    const names = players.map(p => p.name).filter(n => n !== selfName).join(", ");
    return `
Spyfall voting time. Based on the transcript, vote for who you think is the SPY.
Candidates: ${names}
Reply with exactly:
VOTE: <player name>
WHY: <one sentence>

Transcript:
${recap}
`;
}

function parseField(text: string, field: string): string {
    const line = text
        .split("\n")
        .map(s => s.trim())
        .find(l => l.toUpperCase().startsWith(field.toUpperCase() + ":"));
    return (line?.split(":").slice(1).join(":").trim()) || "";
}

/** ---------- PlayerController (minimal, high-impact) ---------- */

type AskResult = { targetName: string; question: string };

interface PlayerController {
    ask(players: Player[], self: Player): Promise<AskResult>;
    answer(askerName: string, question: string): Promise<string>;
    guessLocation(turns: Turn[], self: Player): Promise<string | null>;
    vote(players: Player[], turns: Turn[], self: Player): Promise<string>;
}

class HumanController implements PlayerController {
    constructor(private rl: ReturnType<typeof readline.createInterface>) {}

    async ask(players: Player[], _self: Player): Promise<AskResult> {
        console.log(`Your turn to ask a question.`);
        const targetName = await this.rl.question(`Choose a target (${players.map(p => p.name).join(", ")}): `);
        const question = await this.rl.question(`Your question: `);
        return { targetName, question };
    }

    async answer(askerName: string, question: string): Promise<string> {
        console.log(`\n${askerName} asked you: ${question}`);
        return await this.rl.question(`Your answer: `);
    }

    async guessLocation(_turns: Turn[], self: Player): Promise<string | null> {
        if (self.secret.kind !== "SPY") return null;
        const guess = await this.rl.question("You are the SPY. Guess the location (or press Enter to skip): ");
        return guess.trim() ? guess.trim() : null;
    }

    async vote(players: Player[], _turns: Turn[], self: Player): Promise<string> {
        const candidates = players.map(p => p.name).filter(n => n !== self.name);
        return await this.rl.question(`Your vote for SPY (${candidates.join(", ")}): `);
    }
}

class AgentController implements PlayerController {
    constructor(private agent: Agent) {}

    async ask(players: Player[], self: Player): Promise<AskResult> {
        const askText = await this.agent.say(buildAskerInstruction(players, self));
        const parsed = parseAsk(askText);

        // Keep behavior resilient: if model fails format, fall back safely.
        const fallbackTarget = safePickRandom(players.filter(p => p.id !== self.id), players[0]).name;
        return {
            targetName: parsed.targetName || fallbackTarget,
            question: parsed.question || "What’s something you’d expect to see around you right now?"
        };
    }

    async answer(askerName: string, question: string): Promise<string> {
        return await this.agent.say(buildAnswerInstruction(askerName, question));
    }

    async guessLocation(turns: Turn[], self: Player): Promise<string | null> {
        if (self.secret.kind !== "SPY") return null;
        const guessText = await this.agent.say(buildSpyGuessPrompt(turns));
        return guessText.trim() || null;
    }

    async vote(players: Player[], turns: Turn[], self: Player): Promise<string> {
        const voteText = await this.agent.say(buildVotePrompt(players, turns, self.name));
        return parseField(voteText, "VOTE");
    }
}

/** ---------- game ---------- */

export class SpyfallGame {
    private rl: ReturnType<typeof readline.createInterface> | null = null;
    private running = false;

    async run(config: GameConfig) {
        // ✅ Prevent double execution in the same process
        if (this.running) return;
        this.running = true;

        // ✅ Create readline inside run
        this.rl = readline.createInterface({ input, output });

        try {
            const pack = pickRandom(LOCATIONS);
            const spyIndex = Math.floor(Math.random() * config.numPlayers);
            const roles = shuffle(pack.roles).slice(0, config.numPlayers - 1);

            const players: Player[] = [];
            for (let i = 0; i < config.numPlayers; i++) {
                const isHuman = config.includeHuman && i === 0;
                const name = isHuman ? "You" : `Agent${i}`;
                let secret: PlayerSecret;

                if (i === spyIndex) {
                    secret = { kind: "SPY" };
                } else {
                    const role = roles.pop() || "Visitor";
                    secret = { kind: "CIVILIAN", location: pack.location, role };
                }

                players.push({ id: name, name, isHuman, secret });
            }

            // Build controllers (big win: no more branching each turn)
            const controllers = new Map<PlayerId, PlayerController>();
            for (const p of players) {
                if (p.isHuman) {
                    controllers.set(p.id, new HumanController(this.rl));
                } else {
                    const agent = new Agent(p.name, buildPlayerSystemPrompt(p.name, p.secret));
                    controllers.set(p.id, new AgentController(agent));
                }
            }

            const human = players.find(p => p.isHuman);
            if (human) {
                console.log("\n=== YOUR SECRET ===");
                console.log(secretToBrief(human.secret));
                console.log("===================\n");
            }

            const turns: Turn[] = [];
            const order = shuffle(players);

            console.log(`Game started with ${players.length} players. Rounds: ${config.rounds}\n`);

            // Debug reveal gated (avoid accidental leak)
            if ((config as any).debug) {
                const startingSpy = order.find(p => p.secret.kind === "SPY");
                console.log("DEBUG — SPY IS:", startingSpy?.name, "Location is:", pack.location);
            }

            for (let r = 0; r < config.rounds; r++) {
                const asker = order[r % order.length];
                const askerCtl = controllers.get(asker.id)!;

                const asked = await askerCtl.ask(players, asker);
                const target = resolveOtherPlayer(players, asked.targetName, asker.id);
                const targetCtl = controllers.get(target.id)!;

                const answer = await targetCtl.answer(asker.name, asked.question);

                turns.push({ askerId: asker.name, targetId: target.name, question: asked.question, answer });

                console.log(`\n[Turn ${r + 1}] ${asker.name} -> ${target.name}`);
                console.log(`Q: ${asked.question}`);
                console.log(`A: ${answer}\n`);
            }

            const spy = players.find(p => p.secret.kind === "SPY")!;
            console.log("=== SPY GUESS PHASE ===");
            const guess = await controllers.get(spy.id)!.guessLocation(turns, spy);

            if (spy.isHuman) {
                console.log(guess ? `You guessed: ${guess}` : "You skipped guessing.");
            } else {
                console.log(`${spy.name}:\n${guess ?? ""}\n`);
            }

            console.log("=== VOTING PHASE ===");
            const votes = new Map<string, number>();

            for (const p of players) {
                const ctl = controllers.get(p.id)!;
                const voteName = await ctl.vote(players, turns, p);

                // Enforce: cannot vote for self
                const candidates = players.filter(x => x.name !== p.name);
                const normalized = candidates.find(x => normalizeName(x.name) === normalizeName(voteName))?.name;
                const finalVote = normalized || safePickRandom(candidates, spy).name;

                votes.set(finalVote, (votes.get(finalVote) || 0) + 1);
                console.log(`${p.name} voted: ${finalVote}`);
            }

            const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
            const top = sorted[0];
            const accusedName = top?.[0];
            const accused = players.find(p => p.name === accusedName);

            console.log("\n=== RESULTS ===");
            console.log(`Location was: ${pack.location}`);
            console.log(`Spy was: ${spy.name}`);
            if (accused) console.log(`Most-voted accused: ${accused.name} (${top[1]} votes)`);

            const spyCaught = accused?.name === spy.name;
            console.log(spyCaught ? "Civilians win (spy caught)!" : "Spy wins (not caught)!");
            console.log("===============");

            // process.exit(0);
        } finally {
            // ✅ Always close readline exactly once
            try {
                this.rl?.close();
            } catch {}
            this.rl = null;
            this.running = false;
        }
    }
}
