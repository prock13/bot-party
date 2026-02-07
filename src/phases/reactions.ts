import { Player } from "../types";
import type { PlayerController } from "../controllers";
import type { LogContext } from "./types";

/** Get probability of reaction based on frequency setting */
function getReactionProbability(frequency: "always" | "frequent" | "sometimes" | "rare" | "never"): number {
    switch (frequency) {
        case "always": return 1.0;
        case "frequent": return 0.75;
        case "sometimes": return 0.5;
        case "rare": return 0.25;
        case "never": return 0;
    }
}

export async function collectReactions(
    reactors: Player[],
    controllers: Map<Player["id"], PlayerController>,
    eventType: "question" | "answer",
    authorName: string,
    content: string,
    ctx: LogContext,
    reactionFrequency: "always" | "frequent" | "sometimes" | "rare" | "never" = "sometimes"
): Promise<void> {
    if (reactors.length === 0 || reactionFrequency === "never") return;

    const probability = getReactionProbability(reactionFrequency);
    
    // Filter reactors based on probability
    const activeReactors = reactionFrequency === "always" 
        ? reactors
        : reactors.filter(() => Math.random() < probability);
    
    if (activeReactors.length === 0) return;

    const { log } = ctx;
    const reactions = await Promise.all(
        activeReactors.map(async (p) => {
            const ctl = controllers.get(p.id)!;
            const result = await ctl.react(eventType, authorName, content, p);
            return { name: p.name, ...result };
        })
    );

    const validReactions = reactions.filter(r => r.emoji && r.reaction);
    if (validReactions.length > 0) {
        for (const r of validReactions) {
            log(`  ${r.emoji} ${r.name}: "${r.reaction}"`);
            if (r.suspicion) log(`     ↳ ${r.suspicion}`);
        }
    }
}
