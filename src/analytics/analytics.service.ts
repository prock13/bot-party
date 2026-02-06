import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
    GameRecord,
    PlayerRecord,
    TurnRecord,
    VoteRecord,
    AccusationRecord,
    AnalyticsSummary,
    ProviderStats,
    LocationStats,
} from "./types";
import type { GameConfig, Turn, PlayerId, Player } from "../types";
import type { ProviderType } from "../providers/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data", "games");

export class AnalyticsService {
    private currentGame: Partial<GameRecord> | null = null;
    private startTime: number = 0;

    constructor() {
        // Ensure data directory exists
        if (!existsSync(DATA_DIR)) {
            mkdirSync(DATA_DIR, { recursive: true });
        }
    }

    /**
     * Start tracking a new game
     */
    startGame(config: GameConfig, location: string, players: Player[]): void {
        this.startTime = Date.now();
        const gameId = `game-${this.startTime}`;

        const playerRecords: PlayerRecord[] = players.map(p => ({
            id: p.id,
            name: p.name,
            role: p.secret.kind === "SPY" ? "Spy" : p.secret.role,
            isSpy: p.secret.kind === "SPY",
            // We'll set provider/mode from controllers if available
        }));

        this.currentGame = {
            gameId,
            timestamp: new Date(this.startTime).toISOString(),
            duration: 0,
            config,
            location,
            players: playerRecords,
            turns: [],
            votes: [],
            accusations: [],
            winner: "civilians", // default, will be updated
            endReason: "",
        };
    }

    /**
     * Record a turn (question/answer round)
     */
    recordTurn(turn: Turn, roundNum: number): void {
        if (!this.currentGame) return;

        const turnRecord: TurnRecord = {
            roundNum,
            asker: this.getPlayerName(turn.askerId),
            askerId: turn.askerId,
            target: this.getPlayerName(turn.targetId),
            targetId: turn.targetId,
            question: turn.question,
            answer: turn.answer,
        };

        this.currentGame.turns = [...(this.currentGame.turns || []), turnRecord];
    }

    /**
     * Record voting results
     */
    recordVotes(votes: Map<string, number>): void {
        if (!this.currentGame) return;

        const voteRecords: VoteRecord[] = Array.from(votes.entries()).map(([votedFor, voteCount]) => ({
            voter: "collective",
            votedFor,
            voteCount,
        }));

        this.currentGame.votes = voteRecords;
    }

    /**
     * Record an accusation
     */
    recordAccusation(accuser: string, accused: string, yesVotes: number, noVotes: number, convicted: boolean): void {
        if (!this.currentGame) return;

        const accusation: AccusationRecord = {
            accuser,
            accused,
            yesVotes,
            noVotes,
            convicted,
        };

        this.currentGame.accusations = [...(this.currentGame.accusations || []), accusation];
    }

    /**
     * Update player info (provider/mode)
     */
    updatePlayerInfo(playerId: PlayerId, provider: ProviderType, mode: "memory" | "stateful"): void {
        if (!this.currentGame) return;

        const player = this.currentGame.players?.find(p => p.id === playerId);
        if (player) {
            player.provider = provider;
            player.mode = mode;
        }
    }

    /**
     * End game and save to file
     */
    endGame(winner: "spy" | "civilians", endReason: string, spyGuessedCorrectly?: boolean): void {
        if (!this.currentGame) return;

        const duration = Date.now() - this.startTime;
        this.currentGame.duration = duration;
        this.currentGame.winner = winner;
        this.currentGame.endReason = endReason;
        if (spyGuessedCorrectly !== undefined) {
            this.currentGame.spyGuessedCorrectly = spyGuessedCorrectly;
        }

        // Save to file
        const filename = `${this.currentGame.gameId}.json`;
        const filepath = join(DATA_DIR, filename);
        writeFileSync(filepath, JSON.stringify(this.currentGame, null, 2));

        this.currentGame = null;
    }

    /**
     * Load all game records
     */
    loadAllGames(): GameRecord[] {
        if (!existsSync(DATA_DIR)) {
            return [];
        }

        const files = readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
        const games: GameRecord[] = [];

        for (const file of files) {
            try {
                const content = readFileSync(join(DATA_DIR, file), "utf-8");
                const game = JSON.parse(content) as GameRecord;
                games.push(game);
            } catch (err) {
                console.warn(`Failed to load game file ${file}:`, err);
            }
        }

        return games.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    /**
     * Load a specific game by ID
     */
    loadGame(gameId: string): GameRecord | null {
        const filepath = join(DATA_DIR, `${gameId}.json`);
        if (!existsSync(filepath)) {
            return null;
        }

        try {
            const content = readFileSync(filepath, "utf-8");
            return JSON.parse(content) as GameRecord;
        } catch (err) {
            console.warn(`Failed to load game ${gameId}:`, err);
            return null;
        }
    }

    /**
     * Generate analytics summary
     */
    generateSummary(): AnalyticsSummary {
        const games = this.loadAllGames();

        if (games.length === 0) {
            return {
                totalGames: 0,
                spyWins: 0,
                civilianWins: 0,
                spyWinRate: 0,
                avgGameDuration: 0,
                avgTurnsPerGame: 0,
                providerStats: {} as any,
                locationStats: [],
                recentGames: [],
            };
        }

        const spyWins = games.filter(g => g.winner === "spy").length;
        const civilianWins = games.filter(g => g.winner === "civilians").length;
        const totalDuration = games.reduce((sum, g) => sum + g.duration, 0);
        const totalTurns = games.reduce((sum, g) => sum + (g.turns?.length || 0), 0);

        // Provider stats
        const providerGames = new Map<ProviderType, GameRecord[]>();
        const providerWins = new Map<ProviderType, number>();

        for (const game of games) {
            for (const player of game.players) {
                if (!player.provider) continue;

                if (!providerGames.has(player.provider)) {
                    providerGames.set(player.provider, []);
                    providerWins.set(player.provider, 0);
                }

                providerGames.get(player.provider)!.push(game);

                // Count wins
                const playerWon = (player.isSpy && game.winner === "spy") || (!player.isSpy && game.winner === "civilians");
                if (playerWon) {
                    providerWins.set(player.provider, (providerWins.get(player.provider) || 0) + 1);
                }
            }
        }

        const providerStats: Record<string, ProviderStats> = {};
        for (const [provider, providerGamesList] of providerGames.entries()) {
            const wins = providerWins.get(provider) || 0;
            const gamesPlayed = providerGamesList.length;
            const avgDuration = gamesPlayed > 0 ? providerGamesList.reduce((sum, g) => sum + g.duration, 0) / gamesPlayed : 0;

            providerStats[provider] = {
                gamesPlayed,
                wins,
                losses: gamesPlayed - wins,
                winRate: gamesPlayed > 0 ? wins / gamesPlayed : 0,
                avgGameDuration: avgDuration,
            };
        }

        // Location stats
        const locationMap = new Map<string, { spy: number; civilian: number }>();
        for (const game of games) {
            if (!locationMap.has(game.location)) {
                locationMap.set(game.location, { spy: 0, civilian: 0 });
            }
            const stats = locationMap.get(game.location)!;
            if (game.winner === "spy") {
                stats.spy++;
            } else {
                stats.civilian++;
            }
        }

        const locationStats: LocationStats[] = Array.from(locationMap.entries()).map(([location, stats]) => {
            const total = stats.spy + stats.civilian;
            return {
                location,
                gamesPlayed: total,
                spyWins: stats.spy,
                civilianWins: stats.civilian,
                spyWinRate: total > 0 ? stats.spy / total : 0,
            };
        }).sort((a, b) => b.gamesPlayed - a.gamesPlayed);

        // Recent games
        const recentGames = games.slice(0, 10).map(g => ({
            gameId: g.gameId,
            timestamp: g.timestamp,
            location: g.location,
            winner: g.winner,
            duration: g.duration,
        }));

        return {
            totalGames: games.length,
            spyWins,
            civilianWins,
            spyWinRate: games.length > 0 ? spyWins / games.length : 0,
            avgGameDuration: games.length > 0 ? totalDuration / games.length : 0,
            avgTurnsPerGame: games.length > 0 ? totalTurns / games.length : 0,
            providerStats: providerStats as any,
            locationStats,
            recentGames,
        };
    }

    /**
     * Helper to get player name by ID
     */
    private getPlayerName(playerId: PlayerId): string {
        if (!this.currentGame) return "";
        const player = this.currentGame.players?.find(p => p.id === playerId);
        return player?.name || "";
    }
}
