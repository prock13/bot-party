import { Player, Turn } from "../types";

export type AskResult = { targetName: string; question: string; thought?: string; };
export type ReactionResult = { emoji: string; reaction: string; suspicion: string };

export interface PlayerController {
    ask(players: Player[], self: Player): Promise<AskResult>;
    answer(askerName: string, question: string): Promise<string>;
    guessLocation(turns: Turn[], self: Player): Promise<string | null>;
    vote(players: Player[], turns: Turn[], self: Player): Promise<string>;
    react(eventType: "question" | "answer", authorName: string, content: string): Promise<ReactionResult>;
}
