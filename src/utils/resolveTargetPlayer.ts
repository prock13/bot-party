import { Player, PlayerId } from "../types";
import { normalizeName } from "./normalizeName";
import { safePickRandom } from "./random";

/**
 * Resolve a target by name (name-based matching).
 * Enforces:
 * 1. Target is not the asker (selfId)
 * 2. Target is not the person who just asked (lastAskerId)
 *
 * Matching: exact normalized name first, then substring (target contains name or name contains target).
 * If multiple substring matches, prefer the longest name (most specific).
 */
export function resolveTargetPlayer(
    players: Player[],
    targetName: string,
    selfId: PlayerId,
    lastAskerId?: PlayerId
): Player {
    const target = normalizeName(targetName);
    const isIllegal = (p: Player) => p.id === selfId || (lastAskerId && p.id === lastAskerId);

    const exact = players.find(p => normalizeName(p.name) === target && !isIllegal(p));
    if (exact) return exact;

    const candidates = players
        .filter(p => !isIllegal(p))
        .filter(p => {
            const name = normalizeName(p.name);
            return name && target && (target.includes(name) || name.includes(target));
        });

    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
        candidates.sort((a, b) => normalizeName(b.name).length - normalizeName(a.name).length);
        return candidates[0];
    }

    const validOptions = players.filter(p => !isIllegal(p));
    if (validOptions.length === 0) {
        return safePickRandom(players.filter(p => p.id !== selfId), players[0]);
    }
    return safePickRandom(validOptions, validOptions[0]);
}
