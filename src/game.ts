import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { allLocationsList, LOCATIONS } from "./data";
import { Agent } from "./agent";
import { GameConfig, Player, PlayerId, PlayerSecret, Turn } from "./types";

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

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

function buildAskerInstruction(players: Player[], asker: Player): string {
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

export class SpyfallGame {
    private rl: ReturnType<typeof readline.createInterface> | null = null;
    private running = false;

    async run(config: GameConfig) {
        // ✅ Prevent double execution in the same process
        if (this.running) return;
        this.running = true;

        // ✅ Create readline inside run (so a restarted process doesn't reuse a weird handle)
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

            const agents = new Map<PlayerId, Agent>();
            for (const p of players) {
                if (!p.isHuman) {
                    agents.set(p.id, new Agent(p.name, buildPlayerSystemPrompt(p.name, p.secret)));
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
            const startingSpy = order.find(p => p.secret.kind === "SPY");
            console.log("SPY IS:", startingSpy?.name, "Location is:", pack.location);

            for (let r = 0; r < config.rounds; r++) {
                const asker = order[r % order.length];

                let targetName = "";
                let question = "";

                if (asker.isHuman) {
                    console.log(`Your turn to ask a question.`);
                    targetName = await this.rl.question(`Choose a target (${players.map(p => p.name).join(", ")}): `);
                    question = await this.rl.question(`Your question: `);
                } else {
                    const agent = agents.get(asker.id)!;
                    const askText = await agent.say(buildAskerInstruction(players, asker));
                    const parsed = parseAsk(askText);
                    targetName = parsed.targetName || pickRandom(players).name;
                    question = parsed.question || "What’s something you’d expect to see around you right now?";
                }

                const target =
                    players.find(p => p.name.toLowerCase() === targetName.toLowerCase()) ||
                    pickRandom(players.filter(p => p.id !== asker.id));

                let answer = "";
                if (target.isHuman) {
                    console.log(`\n${asker.name} asked you: ${question}`);
                    answer = await this.rl.question(`Your answer: `);
                } else {
                    const agent = agents.get(target.id)!;
                    answer = await agent.say(buildAnswerInstruction(asker.name, question));
                }

                turns.push({ askerId: asker.name, targetId: target.name, question, answer });

                console.log(`\n[Turn ${r + 1}] ${asker.name} -> ${target.name}`);
                console.log(`Q: ${question}`);
                console.log(`A: ${answer}\n`);
            }

            const spy = players.find(p => p.secret.kind === "SPY")!;
            console.log("=== SPY GUESS PHASE ===");
            if (spy.isHuman) {
                const guess = await this.rl.question("You are the SPY. Guess the location (or press Enter to skip): ");
                console.log(guess.trim() ? `You guessed: ${guess.trim()}` : "You skipped guessing.");
            } else {
                const spyAgent = agents.get(spy.id)!;
                const guessText = await spyAgent.say(buildSpyGuessPrompt(turns));
                console.log(`${spy.name}:\n${guessText}\n`);
            }

            console.log("=== VOTING PHASE ===");
            const votes = new Map<string, number>();

            for (const p of players) {
                let voteName = "";
                if (p.isHuman) {
                    voteName = await this.rl.question(`Your vote for SPY (${players.map(x => x.name).join(", ")}): `);
                } else {
                    const agent = agents.get(p.id)!;
                    const voteText = await agent.say(buildVotePrompt(players, turns, p.name));
                    voteName = parseField(voteText, "VOTE");
                }

                const normalized = players.find(x => x.name.toLowerCase() === voteName.toLowerCase())?.name;
                const finalVote = normalized || pickRandom(players).name;
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

            // ✅ Optional: hard-stop (useful while debugging watch issues)
            // process.exit(0);

        } finally {
            // ✅ Always close readline exactly once
            try {
                this.rl?.close();
            } catch { }
            this.rl = null;
            this.running = false;
        }
    }
}
