import { ProviderType, AgentMode } from "./providers";

export type PlayerId = string;

export type PlayerSecret =
    | { kind: "SPY" }
    | { kind: "CIVILIAN"; location: string; role: string };

export type Player = {
    id: PlayerId;
    name: string;
    isHuman: boolean;
    secret: PlayerSecret;
};

export type Turn = {
    askerId: PlayerId;
    targetId: PlayerId;
    question: string;
    answer: string;
};

/** Actions available once all players have answered at least once */
export type TurnAction = "question" | "guess" | "vote";

/** Result of choosing an action for a turn */
export type ActionChoice = {
    action: TurnAction;
    thought?: string;
};

/** Result of an early game termination */
export type EarlyEndResult = {
    ended: true;
    winner: "spy" | "civilians";
    reason: string;
} | {
    ended: false;
};

/** Configuration for a single player slot */
export type PlayerSlotConfig = 
    | { type: "human" }
    | { type: ProviderType; mode: AgentMode };

export type GameConfig = {
    rounds: number; // number of Q/A turns (not "full cycles")
    /** Allow players to call early votes (once per game). Default: true */
    allowEarlyVote?: boolean;
    /** Specific location to use (by name). If not provided, picks random. */
    locationName?: string;
    /** Player configurations in order. If not provided, uses legacy config. */
    playerSlots?: PlayerSlotConfig[];
    // Legacy config (used if playerSlots not provided)
    numPlayers?: number;
    includeHuman?: boolean;
    agentMode?: AgentMode;
    providers?: ProviderType[];
};
