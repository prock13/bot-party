import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { LOCATIONS, allLocationsList } from "./data";
import { Agent, type PromptEntry, type AgentCreatedEntry } from "./agent";
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
    agents: Agent[];
};

type TallyResult = {
    accusedName: string | null;
    isTie: boolean;
    spy: Player;
};

export type GameReporter = (line: string) => void;

export type GameInfoEntry = {
    location: string;
    allLocations: string[];
    roles: string[];
    players: Array<{ name: string; role: string; isSpy: boolean }>;
    config: GameConfig;
};

export class SpyfallGame {
    private rl: ReturnType<typeof readline.createInterface> | null = null;
    private running = false;
    /** When set, each log line is also sent here (e.g. for SSE streaming to a web client). */
    public onOutput?: GameReporter;
    /** When set, each AI prompt/response pair is sent here (e.g. for inspection). */
    public onPrompt?: (entry: PromptEntry) => void;
    /** When set, game setup info is sent here (for debug/inspection). */
    public onGameInfo?: (info: GameInfoEntry) => void;
    /** When set, agent creation info is sent here (for debug/inspection). */
    public onAgentCreated?: (entry: AgentCreatedEntry) => void;

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

        let agents: Agent[] = [];
        try {
            const setup = await this.setupGame(config);
            const { pack, players, controllers } = setup;
            agents = setup.agents;
            this.revealHumanIdentity(players);
            this.emitGameInfo(pack, players, config);
            agents.forEach(a => a.emitCreated());
            const turns = await this.runQuestionRounds(config.rounds, players, controllers);
            const votes = await this.runVotingPhase(players, controllers, turns);
            const { accusedName, isTie, spy } = this.tallyVotes(votes, players);
            this.logVerdict(accusedName, isTie, spy);
            const spyGuessedRight = await this.runSpyGuessIfEligible(accusedName, isTie, spy, pack, controllers, turns);
            this.printFinalScore(pack, accusedName, spy, spyGuessedRight);
        } finally {
            // Cleanup agents (deletes assistants/threads in thread mode)
            await Promise.all(agents.map(a => a.cleanup()));
            this.rl?.close();
            this.rl = null;
            this.running = false;
        }
    }

    private async setupGame(config: GameConfig): Promise<GameSetup> {
        const pack = pickRandom(LOCATIONS);
        const spyIndex = Math.floor(Math.random() * config.numPlayers);
        const roles = shuffle(pack.roles).slice(0, config.numPlayers - 1);
        const agentMode = config.agentMode ?? "memory";

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
        const agents: Agent[] = [];
        for (const p of players) {
            if (p.isHuman) {
                controllers.set(p.id, new HumanController(this.rl!));
            } else {
                const agent = new Agent({
                    name: p.name,
                    systemPrompt: buildPlayerSystemPrompt(p.name, p.secret),
                    mode: agentMode,
                    onPrompt: this.onPrompt,
                    onAgentCreated: this.onAgentCreated,
                });
                agents.push(agent);
                controllers.set(p.id, new AIController(agent));
            }
        }

        // Wait for all agents to be fully initialized before proceeding
        await Promise.all(agents.map(a => a.ready));

        return { pack, players, controllers, agents };
    }

    private revealHumanIdentity(players: Player[]): void {
        const human = players.find(p => p.isHuman);
        if (human) this.log(`\n=== YOUR IDENTITY ===\n${secretToBrief(human.secret)}\n=====================\n`);
    }

    private emitGameInfo(pack: (typeof LOCATIONS)[number], players: Player[], config: GameConfig): void {
        if (!this.onGameInfo) return;

        const allLocs = LOCATIONS.map(l => l.location);
        const playerInfo = players.map(p => ({
            name: p.name,
            role: p.secret.kind === "SPY" ? "SPY" : p.secret.role,
            isSpy: p.secret.kind === "SPY",
        }));

        this.onGameInfo({
            location: pack.location,
            allLocations: allLocs,
            roles: pack.roles,
            players: playerInfo,
            config,
        });
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
            this.log(`\n[Round ${roundCount}]`);

            const askerCtl = controllers.get(currentAsker.id)!;
            const rawAsk = await askerCtl.ask(players, currentAsker);
            if (rawAsk.thought) this.log(`💭 ${currentAsker.name}'s Strategy: "${rawAsk.thought}"`);

            const target = resolveOtherPlayer(players, rawAsk.targetName, currentAsker.id, lastAsker?.id);
            this.log(`${currentAsker.name} ➔ ${target.name}`);
            this.log(`Q: ${rawAsk.question}`);

            // Reactions to the question (from players not involved)
            const questionReactors = players.filter(p => p.id !== currentAsker.id && p.id !== target.id && !p.isHuman);
            await this.collectReactions(questionReactors, controllers, "question", currentAsker.name, rawAsk.question);

            const targetCtl = controllers.get(target.id)!;
            const rawAnswer = await targetCtl.answer(currentAsker.name, rawAsk.question);
            const targetThought = parseField("THOUGHT", rawAnswer);
            const publicAnswer = parseField("ANSWER", rawAnswer) || rawAnswer;
            if (targetThought) this.log(`💭 ${target.name}'s Logic: "${targetThought}"`);
            this.log(`A: ${publicAnswer}`);

            // Reactions to the answer (from players not involved)
            const answerReactors = players.filter(p => p.id !== currentAsker.id && p.id !== target.id && !p.isHuman);
            await this.collectReactions(answerReactors, controllers, "answer", target.name, publicAnswer);

            turns.push({ askerId: currentAsker.name, targetId: target.name, question: rawAsk.question, answer: publicAnswer });

            lastAsker = currentAsker;
            currentAsker = target;
        }
        return turns;
    }

    private async collectReactions(
        reactors: Player[],
        controllers: Map<PlayerId, PlayerController>,
        eventType: "question" | "answer",
        authorName: string,
        content: string
    ): Promise<void> {
        if (reactors.length === 0) return;

        const reactions = await Promise.all(
            reactors.map(async (p) => {
                const ctl = controllers.get(p.id)!;
                const result = await ctl.react(eventType, authorName, content);
                return { name: p.name, ...result };
            })
        );

        const validReactions = reactions.filter(r => r.emoji && r.reaction);
        if (validReactions.length > 0) {
            for (const r of validReactions) {
                this.log(`  ${r.emoji} ${r.name}: "${r.reaction}"`);
                if (r.suspicion) this.log(`     ↳ ${r.suspicion}`);
            }
        }
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