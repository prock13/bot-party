import { LOCATIONS } from "../data";
import { Agent } from "../agent";
import { AIController, HumanController, PlayerController } from "../controllers";
import { GameConfig, Player, PlayerId, PlayerSecret, PlayerSlotConfig } from "../types";
import { buildPlayerSystemPrompt, secretToBrief } from "../prompts";
import { DEFAULT_PROVIDER_ROTATION, getProviderDisplayName, type ProviderType } from "../providers";
import { pickRandom, shuffle } from "../utils/random";
import type { GameSetup, SetupDeps } from "./types";

export function legacyConfigToSlots(config: GameConfig): PlayerSlotConfig[] {
    const numPlayers = config.numPlayers ?? 3;
    const includeHuman = config.includeHuman ?? false;
    const agentMode = config.agentMode ?? "memory";
    const providers = config.providers ?? DEFAULT_PROVIDER_ROTATION;

    const slots: PlayerSlotConfig[] = [];
    let aiIndex = 0;

    for (let i = 0; i < numPlayers; i++) {
        if (includeHuman && i === 0) {
            slots.push({ type: "human" });
        } else {
            const provider = providers[aiIndex % providers.length];
            slots.push({ type: provider, mode: agentMode });
            aiIndex++;
        }
    }

    return slots;
}

export async function setupGame(config: GameConfig, deps: SetupDeps): Promise<GameSetup> {
    const slots: PlayerSlotConfig[] = config.playerSlots ?? legacyConfigToSlots(config);

    // Select location: use specified location if provided, otherwise pick random
    let pack;
    if (config.locationName) {
        const found = LOCATIONS.find(loc => 
            loc.location.toLowerCase() === config.locationName!.toLowerCase()
        );
        if (!found) {
            throw new Error(`Location "${config.locationName}" not found`);
        }
        pack = found;
    } else {
        pack = pickRandom(LOCATIONS);
    }
    
    const numPlayers = slots.length;
    const spyIndex = Math.floor(Math.random() * numPlayers);
    const roles = shuffle(pack.roles).slice(0, numPlayers - 1);

    const providerCounts: Record<string, number> = {};
    const providerInstanceNum: Record<string, number> = {};
    for (const slot of slots) {
        if (slot.type !== "human") {
            providerCounts[slot.type] = (providerCounts[slot.type] || 0) + 1;
        }
    }

    const players: Player[] = [];
    for (let i = 0; i < numPlayers; i++) {
        const slot = slots[i];
        const isHuman = slot.type === "human";
        let name: string;

        if (isHuman) {
            name = "You";
        } else {
            const baseName = getProviderDisplayName(slot.type);
            providerInstanceNum[slot.type] = (providerInstanceNum[slot.type] || 0) + 1;
            name = providerCounts[slot.type] > 1
                ? `${baseName}-${providerInstanceNum[slot.type]}`
                : baseName;
        }

        const secret: PlayerSecret = (i === spyIndex)
            ? { kind: "SPY" }
            : { kind: "CIVILIAN", location: pack.location, role: roles.pop() || "Visitor" };
        players.push({ id: name, name, isHuman, secret });
    }

    const controllers = new Map<PlayerId, PlayerController>();
    const agents: Agent[] = [];

    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const slot = slots[i];

        if (p.isHuman) {
            controllers.set(p.id, new HumanController(deps.rl!));
            console.log(`\n=== YOUR IDENTITY ===\n${secretToBrief(p.secret)}\n=====================\n`);
        } else {
            const aiSlot = slot as { type: ProviderType; mode: "memory" | "stateful"; personality?: string };
            const personality = getPersonalityById(aiSlot.personality || "neutral");
            const agent = new Agent({
                name: p.name,
                systemPrompt: buildPlayerSystemPrompt(p.name, p.secret, personality, pack),
                provider: aiSlot.type,
                mode: aiSlot.mode,
                onPrompt: deps.onPrompt,
                onAgentCreated: deps.onAgentCreated,
            });
            agents.push(agent);
            controllers.set(p.id, new AIController(agent));
        }
    }

    await Promise.all(agents.map(a => a.ready));

    return { pack, players, controllers, agents };
}
