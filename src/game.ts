import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { GameConfig } from "./types";
import type { PromptEntry, AgentCreatedEntry } from "./agent";
import { AnalyticsService } from "./analytics";
import {
    setupGame,
    runQuestionRounds,
    runVotingPhase,
    tallyVotes,
    runSpyGuessIfEligible,
} from "./phases";
import {
    emitGameInfo,
    printEarlyEndResult,
    logVerdict,
    printFinalScore,
} from "./utils/output";

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
    private analytics: AnalyticsService;

    public onOutput?: GameReporter;
    public onPrompt?: (entry: PromptEntry) => void;
    public onGameInfo?: (info: GameInfoEntry) => void;
    public onAgentCreated?: (entry: AgentCreatedEntry) => void;

    constructor() {
        this.analytics = new AnalyticsService();
    }

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

        let agents: import("./agent").Agent[] = [];
        try {
            const setup = await setupGame(config, {
                rl: this.rl,
                onPrompt: this.onPrompt,
                onAgentCreated: this.onAgentCreated,
            });
            const { pack, players, controllers, agents: setupAgents } = setup;
            agents = setupAgents;
            const spy = players.find(p => p.secret.kind === "SPY")!;

            // Start analytics tracking
            this.analytics.startGame(config, pack.location, players);

            // Update player info for analytics
            agents.forEach(a => {
                const player = players.find(p => p.name === a.name);
                if (player) {
                    this.analytics.updatePlayerInfo(player.id, a.providerType, a.mode as "memory" | "stateful");
                }
            });

            emitGameInfo(pack, players, config, this.onGameInfo);
            agents.forEach(a => a.emitCreated());

            const allowEarlyVote = config.allowEarlyVote ?? true;
            const reactionFrequency = config.reactionFrequency ?? "sometimes";
            const ctx = { log: this.log.bind(this) };
            const { turns, earlyEnd } = await runQuestionRounds(
                config.rounds,
                players,
                controllers,
                pack,
                allowEarlyVote,
                reactionFrequency,
                ctx
            );

            // Record turns for analytics
            turns.forEach((turn, index) => {
                this.analytics.recordTurn(turn, Math.floor(index / players.length) + 1);
            });

            if (earlyEnd.ended) {
                printEarlyEndResult(pack, spy, earlyEnd, this.log.bind(this));
                // End analytics with early end result
                this.analytics.endGame(earlyEnd.winner, earlyEnd.reason);
            } else {
                const votes = await runVotingPhase(players, controllers, turns, ctx);
                this.analytics.recordVotes(votes);
                
                const { accusedName, isTie } = tallyVotes(votes, players);
                logVerdict(accusedName, isTie, spy, this.log.bind(this));
                const spyGuessedRight = await runSpyGuessIfEligible(
                    accusedName,
                    isTie,
                    spy,
                    pack,
                    controllers,
                    turns,
                    ctx
                );
                printFinalScore(pack, accusedName, spy, spyGuessedRight, this.log.bind(this));
                
                // Determine winner and end analytics
                const winner = (accusedName === spy.name && !spyGuessedRight) ? "civilians" : "spy";
                const reason = spyGuessedRight 
                    ? "Spy caught but guessed location correctly" 
                    : (accusedName === spy.name ? "Spy caught and failed location guess" : "Wrong person accused");
                this.analytics.endGame(winner, reason, spyGuessedRight);
            }
        } finally {
            await Promise.all(agents.map(a => a.cleanup()));
            this.rl?.close();
            this.rl = null;
            this.running = false;
        }
    }
}
