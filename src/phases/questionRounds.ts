import { Player, PlayerId, Turn } from "../types";
import { parseField } from "../utils/parseField";
import { pickRandom } from "../utils/random";
import { resolveTargetPlayer } from "../utils/resolveTargetPlayer";
import type { LogContext } from "./types";
import type { LocationPack } from "../data";
import type { PlayerController } from "../controllers";
import type { RoundsResult } from "./types";
import type { EarlyEndResult } from "../types";
import { handleEarlySpyGuess } from "./earlySpyGuess";
import { handleAccusation } from "./accusation";
import { collectReactions } from "./reactions";

export async function runQuestionRounds(
    numRounds: number,
    players: Player[],
    controllers: Map<PlayerId, PlayerController>,
    pack: LocationPack,
    allowEarlyVote: boolean,
    reactionFrequency: "always" | "frequent" | "sometimes" | "rare" | "never",
    ctx: LogContext
): Promise<RoundsResult> {
    const { log } = ctx;
    const turns: Turn[] = [];
    const playersWhoAnswered = new Set<PlayerId>();
    const usedVote = new Set<PlayerId>();
    let actionsUnlockAnnounced = false;
    let roundCount = 0;
    let currentAsker = pickRandom(players);
    let lastAsker: Player | null = null;

    log(`🚀 Game started! ${currentAsker.name} will ask the first question.`);

    while (roundCount < numRounds) {
        roundCount++;
        log(`\n[Round ${roundCount}]`);

        const askerCtl = controllers.get(currentAsker.id)!;
        const actionsUnlocked = playersWhoAnswered.size >= players.length;

        if (actionsUnlocked) {
            const canAccuse = allowEarlyVote && !usedVote.has(currentAsker.id);
            const choice = await askerCtl.chooseAction(players, turns, currentAsker, canAccuse);

            if (choice.thought) {
                log(`💭 ${currentAsker.name}'s Decision: "${choice.thought}"`);
            }

            if (choice.action === "guess") {
                if (currentAsker.secret.kind !== "SPY") {
                    log(`${currentAsker.name} tried to guess but isn't the spy! Defaulting to question.`);
                } else {
                    const earlyEnd = await handleEarlySpyGuess(currentAsker, pack, controllers, turns, ctx);
                    if (earlyEnd.ended) {
                        return { turns, earlyEnd };
                    }
                }
            }

            if (choice.action === "vote" && canAccuse) {
                usedVote.add(currentAsker.id);
                const earlyEnd = await handleAccusation(currentAsker, players, controllers, turns, pack, ctx);
                if (earlyEnd.ended) {
                    return { turns, earlyEnd };
                }
                log(`Accusation failed. Game continues...`);
                lastAsker = currentAsker;
                currentAsker = pickRandom(players.filter(p => p.id !== currentAsker.id));
                continue;
            }
        }

        const rawAsk = await askerCtl.ask(players, currentAsker);
        if (rawAsk.thought) log(`💭 ${currentAsker.name}'s Strategy: "${rawAsk.thought}"`);

        const target = resolveTargetPlayer(players, rawAsk.targetName, currentAsker.id, lastAsker?.id);
        log(`${currentAsker.name} ➔ ${target.name}`);
        log(`Q: ${rawAsk.question}`);

        const questionReactors = players.filter(p => p.id !== currentAsker.id && p.id !== target.id && !p.isHuman);
        await collectReactions(questionReactors, controllers, "question", currentAsker.name, rawAsk.question, ctx, reactionFrequency);

        const targetCtl = controllers.get(target.id)!;
        const rawAnswer = await targetCtl.answer(currentAsker.name, rawAsk.question, target);
        const targetThought = parseField("THOUGHT", rawAnswer);
        const publicAnswer = parseField("ANSWER", rawAnswer) || rawAnswer;
        if (targetThought) log(`💭 ${target.name}'s Logic: "${targetThought}"`);
        log(`A: ${publicAnswer}`);

        playersWhoAnswered.add(target.id);

        if (!actionsUnlockAnnounced && playersWhoAnswered.size >= players.length) {
            actionsUnlockAnnounced = true;
            const accuseMsg = allowEarlyVote ? " and ACCUSE (once per game)" : "";
            log(`\n🔓 All players have answered! New actions unlocked: GUESS (spy)${accuseMsg}`);
        }

        const answerReactors = players.filter(p => p.id !== currentAsker.id && p.id !== target.id && !p.isHuman);
        await collectReactions(answerReactors, controllers, "answer", target.name, publicAnswer, ctx, reactionFrequency);

        turns.push({ askerId: currentAsker.name, targetId: target.name, question: rawAsk.question, answer: publicAnswer });

        lastAsker = currentAsker;
        currentAsker = target;
    }

    return { turns, earlyEnd: { ended: false } };
}
