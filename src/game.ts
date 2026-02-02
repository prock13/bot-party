import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { allLocationsList, LOCATIONS } from "./data";
import { Agent } from "./agent";
import { AIController, HumanController, PlayerController } from "./controllers";
import { GameConfig, Player, PlayerId, PlayerSecret, Turn } from "./types";
import { parseField, buildPlayerSystemPrompt, secretToBrief } from "./prompts";

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

/** * Resolve a target by name.
 * Enforces: 
 * 1. Target is not the asker (selfId)
 * 2. Target is not the person who just asked (lastAskerId)
 */
function resolveOtherPlayer(
    players: Player[],
    targetName: string,
    selfId: PlayerId,
    lastAskerId?: PlayerId
): Player {
    const normalized = normalizeName(targetName);
    const candidate = players.find(p => normalizeName(p.name) === normalized);

    // Logic: Illegal if target is self OR target is the person who just asked you
    const isIllegal = (p: Player) => p.id === selfId || (lastAskerId && p.id === lastAskerId);

    // If the chosen candidate is valid, use them
    if (candidate && !isIllegal(candidate)) {
        return candidate;
    }

    // Fallback: Filter all players to find those who are legal targets
    const validOptions = players.filter(p => !isIllegal(p));

    // Safety check: if everyone is illegal (rare), just pick someone not self
    if (validOptions.length === 0) {
        return safePickRandom(players.filter(p => p.id !== selfId), players[0]);
    }

    return safePickRandom(validOptions, validOptions[0]);
}

/** ---------- Game Engine ---------- */

type GameSetup = {
    pack: (typeof LOCATIONS)[number];
    players: Player[];
    controllers: Map<PlayerId, PlayerController>;
};

type TallyResult = {
    accusedName: string | null;
    isTie: boolean;
    spy: Player;
};

export type GameReporter = (line: string) => void;

export class SpyfallGame {
    private rl: ReturnType<typeof readline.createInterface> | null = null;
    private running = false;
    /** When set, each log line is also sent here (e.g. for SSE streaming to a web client). */
    public onOutput?: GameReporter;

    private log(msg: string): void {
        console.log(msg);
        this.onOutput?.(msg);
    }

    async run(config: GameConfig) {
        if (this.running) return;
        this.running = true;
        if (config.includeHuman) {
            this.rl = readline.createInterface({ input, output });
        }

        try {
            const { pack, players, controllers } = this.setupGame(config);
            this.revealHumanIdentity(players);
            const turns = await this.runQuestionRounds(config.rounds, players, controllers);
            const votes = await this.runVotingPhase(players, controllers, turns);
            const { accusedName, isTie, spy } = this.tallyVotes(votes, players);
            this.logVerdict(accusedName, isTie, spy);
            const spyGuessedRight = await this.runSpyGuessIfEligible(accusedName, isTie, spy, pack, controllers, turns);
            this.printFinalScore(pack, accusedName, spy, spyGuessedRight);
        } finally {
            this.rl?.close();
            this.rl = null;
            this.running = false;
        }
    }

    private setupGame(config: GameConfig): GameSetup {
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
                ? new HumanController(this.rl!)
                : new AIController(new Agent(p.name, buildPlayerSystemPrompt(p.name, p.secret)))
            );
        }
        return { pack, players, controllers };
    }

    private revealHumanIdentity(players: Player[]): void {
        const human = players.find(p => p.isHuman);
        if (human) this.log(`\n=== YOUR IDENTITY ===\n${secretToBrief(human.secret)}\n=====================\n`);
    }

    private async runQuestionRounds(
        numRounds: number,
        players: Player[],
        controllers: Map<PlayerId, PlayerController>
    ): Promise<Turn[]> {
        const turns: Turn[] = [];
        let roundCount = 0;
        let currentAsker = pickRandom(players);
        let lastAsker: Player | null = null;

        this.log(`🚀 Game started! ${currentAsker.name} will ask the first question.`);

        while (roundCount < numRounds) {
            roundCount++;
            const askerCtl = controllers.get(currentAsker.id)!;
            const rawAsk = await askerCtl.ask(players, currentAsker);

            if (rawAsk.thought) this.log(`\n💭 ${currentAsker.name}'s Strategy: "${rawAsk.thought}"`);

            const target = resolveOtherPlayer(players, rawAsk.targetName, currentAsker.id, lastAsker?.id);
            const targetCtl = controllers.get(target.id)!;
            const rawAnswer = await targetCtl.answer(currentAsker.name, rawAsk.question);

            const targetThought = parseField("THOUGHT", rawAnswer);
            const publicAnswer = parseField("ANSWER", rawAnswer) || rawAnswer;
            if (targetThought) this.log(`💭 ${target.name}'s Logic: "${targetThought}"`);

            turns.push({ askerId: currentAsker.name, targetId: target.name, question: rawAsk.question, answer: publicAnswer });
            this.log(`\n[Round ${roundCount}] ${currentAsker.name} ➔ ${target.name}`);
            this.log(`Q: ${rawAsk.question}`);
            this.log(`A: ${publicAnswer}`);

            lastAsker = currentAsker;
            currentAsker = target;
        }
        return turns;
    }

    private async runVotingPhase(
        players: Player[],
        controllers: Map<PlayerId, PlayerController>,
        turns: Turn[]
    ): Promise<Map<string, number>> {
        this.log("\n=== 🗳️ VOTING PHASE ===");
        const votes = new Map<string, number>();
        for (const p of players) {
            const rawVote = await controllers.get(p.id)!.vote(players, turns, p);
            const thought = parseField("THOUGHT", rawVote);
            const voteName = parseField("VOTE", rawVote);
            const why = parseField("WHY", rawVote);

            if (thought) this.log(`\n💭 ${p.name}'s Voting Logic: "${thought}"`);

            const candidates = players.filter(x => x.id !== p.id);
            const validCandidate = candidates.find(x => normalizeName(x.name) === normalizeName(voteName));
            const finalVote = validCandidate?.name || safePickRandom(candidates, players[0]).name;

            votes.set(finalVote, (votes.get(finalVote) || 0) + 1);
            this.log(`${p.name} voted for: ${finalVote} (${why})`);
        }
        return votes;
    }

    private tallyVotes(votes: Map<string, number>, players: Player[]): TallyResult {
        const sortedVotes = [...votes.entries()].sort((a, b) => b[1] - a[1]);
        const isTie = sortedVotes.length > 1 && sortedVotes[0][1] === sortedVotes[1][1];
        const accusedName = isTie ? null : sortedVotes[0][0];
        const spy = players.find(p => p.secret.kind === "SPY")!;
        return { accusedName, isTie, spy };
    }

    private logVerdict(accusedName: string | null, isTie: boolean, spy: Player): void {
        this.log(`\n⚖️ VERDICT: ${isTie ? "A tie! The group is paralyzed by doubt." : `The group accuses ${accusedName}!`}`);
        this.log(`🕵️ REVEAL: The Spy was indeed ${spy.name}!`);
    }

    private async runSpyGuessIfEligible(
        accusedName: string | null,
        isTie: boolean,
        spy: Player,
        pack: (typeof LOCATIONS)[number],
        controllers: Map<PlayerId, PlayerController>,
        turns: Turn[]
    ): Promise<boolean> {
        if (accusedName !== spy.name && !isTie) return false;

        this.log(`\n${spy.name} attempts a final guess...`);
        const guessRaw = await controllers.get(spy.id)!.guessLocation(turns, spy) ?? "";
        const guess = parseField("GUESS", guessRaw);
        const reason = parseField("REASON", guessRaw);

        this.log(`${spy.name}: "I believe we are at the ${guess.toUpperCase()}!"`);
        if (reason) this.log(`Reason: "${reason}"`);

        return normalizeName(guess) === normalizeName(pack.location);
    }

    private printFinalScore(
        pack: (typeof LOCATIONS)[number],
        accusedName: string | null,
        spy: Player,
        spyGuessedRight: boolean
    ): void {
        this.log("\n" + "=".repeat(30));
        this.log(`📍 ACTUAL LOCATION: ${pack.location}`);
        if (spyGuessedRight) {
            this.log("🏆 RESULT: SPY WINS! (Correctly identified the location)");
        } else if (accusedName === spy.name) {
            this.log("🏆 RESULT: CIVILIANS WIN! (Spy was caught)");
        } else {
            this.log("🏆 RESULT: SPY WINS! (Total deception)");
        }
        this.log("=".repeat(30) + "\n");
    }
}