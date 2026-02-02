import readline from "node:readline/promises";
import { Player, Turn } from "../types";
import { PlayerController, AskResult, ReactionResult } from "./player.controller";

export class HumanController implements PlayerController {
    constructor(private rl: ReturnType<typeof readline.createInterface>) {}

    async ask(players: Player[], self: Player): Promise<AskResult> {
        const others = players.filter(p => p.id !== self.id).map(p => p.name);
        console.log(`\nIt is your turn to ask.`);
        const targetName = await this.rl.question(`Choose a target (${others.join(", ")}): `);
        const question = await this.rl.question(`Your question: `);
        return { targetName, question };
    }

    async answer(askerName: string, question: string, _self: Player): Promise<string> {
        console.log(`\n❓ ${askerName} asked you: ${question}`);
        return await this.rl.question(`Your answer: `);
    }

    async guessLocation(_turns: Turn[], self: Player): Promise<string | null> {
        console.log("\n🚨 You've been accused! One last chance to guess the location.");
        const guess = await this.rl.question("Your final guess: ");
        return `GUESS: ${guess}\nREASON: Human intuition.`;
    }

    async vote(players: Player[], _turns: Turn[], self: Player): Promise<string> {
        const candidates = players.map(p => p.name).filter(n => n !== self.name);
        const vote = await this.rl.question(`\n🗳️ Vote for the SPY (${candidates.join(", ")}): `);
        return `VOTE: ${vote}`;
    }

    async react(_eventType: "question" | "answer", _authorName: string, _content: string, _self: Player): Promise<ReactionResult> {
        // Humans don't auto-react; skip
        return { emoji: "", reaction: "", suspicion: "" };
    }
}