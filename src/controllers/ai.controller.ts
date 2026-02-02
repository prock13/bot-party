import { Agent } from "../agent";
import { buildAskerInstruction, parseField, buildAnswerInstruction, buildSpyGuessPrompt, buildVotePrompt, buildReactionPrompt } from "../prompts";
import { Player, Turn } from "../types";
import { PlayerController, AskResult, ReactionResult } from "./player.controller";

export class AIController implements PlayerController {
    constructor(private agent: Agent) {}

    async ask(players: Player[], self: Player): Promise<AskResult> {
        const askText = await this.agent.say(buildAskerInstruction(players, self), "ask a question");
        return {
            targetName: parseField("TARGET", askText),
            question: parseField("QUESTION", askText),
            thought: parseField("THOUGHT", askText)
        };
    }

    async answer(askerName: string, question: string): Promise<string> {
        return await this.agent.say(buildAnswerInstruction(askerName, question), "answer a question");
    }

    async guessLocation(turns: Turn[], self: Player): Promise<string | null> {
        if (self.secret.kind !== "SPY") return null;
        return await this.agent.say(buildSpyGuessPrompt(turns), "guess the location");
    }

    async vote(players: Player[], turns: Turn[], self: Player): Promise<string> {
        return await this.agent.say(buildVotePrompt(players, turns, self.name), "vote");
    }

    async react(eventType: "question" | "answer", authorName: string, content: string): Promise<ReactionResult> {
        const raw = await this.agent.say(buildReactionPrompt(eventType, authorName, content), "react");
        return {
            emoji: parseField("EMOJI", raw) || "🤔",
            reaction: parseField("REACTION", raw) || raw,
            suspicion: parseField("SUSPICION", raw) || "",
        };
    }
}