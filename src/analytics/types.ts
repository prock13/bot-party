import type { GameConfig, Turn, PlayerId } from "../types";
import type { ProviderType } from "../providers/types";

export interface PlayerRecord {
    id: string;
    name: string;
    role: string;
    isSpy: boolean;
    provider?: ProviderType;
    mode?: "memory" | "stateful";
}

export interface TurnRecord {
    roundNum: number;
    asker: string;
    askerId: PlayerId;
    target: string;
    targetId: PlayerId;
    question: string;
    answer: string;
    reactions?: Array<{
        player: string;
        emoji: string;
        comment: string;
    }>;
}

export interface VoteRecord {
    voter: string;
    votedFor: string;
    voteCount: number;
}

export interface AccusationRecord {
    accuser: string;
    accused: string;
    yesVotes: number;
    noVotes: number;
    convicted: boolean;
}

export interface GameRecord {
    gameId: string;
    timestamp: string;
    duration: number; // milliseconds
    config: GameConfig;
    location: string;
    players: PlayerRecord[];
    turns: TurnRecord[];
    votes: VoteRecord[];
    accusations: AccusationRecord[];
    winner: "spy" | "civilians";
    endReason: string;
    spyGuessedCorrectly?: boolean;
}

export interface ProviderStats {
    gamesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
    avgGameDuration: number;
}

export interface LocationStats {
    location: string;
    gamesPlayed: number;
    spyWins: number;
    civilianWins: number;
    spyWinRate: number;
}

export interface AnalyticsSummary {
    totalGames: number;
    spyWins: number;
    civilianWins: number;
    spyWinRate: number;
    avgGameDuration: number;
    avgTurnsPerGame: number;
    providerStats: Record<ProviderType, ProviderStats>;
    locationStats: LocationStats[];
    recentGames: Array<{
        gameId: string;
        timestamp: string;
        location: string;
        winner: "spy" | "civilians";
        duration: number;
    }>;
}
