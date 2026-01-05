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

export type GameConfig = {
    numPlayers: number; // includes human if enabled
    includeHuman: boolean;
    rounds: number; // number of Q/A turns (not “full cycles”)
};
