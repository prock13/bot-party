import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { LOCATIONS, allLocationsList } from "./data";
import { Agent, type PromptEntry, type AgentCreatedEntry } from "./agent";
import { AIController, HumanController, PlayerController } from "./controllers";
import { EarlyEndResult, GameConfig, Player, PlayerId, PlayerSecret, PlayerSlotConfig, Turn } from "./types";
import { buildPlayerSystemPrompt, secretToBrief } from "./prompts";
import { DEFAULT_PROVIDER_ROTATION, getProviderDisplayName, type ProviderType } from "./providers";
import { parseField } from "./utils/parseField";
import { normalizeName } from "./utils/normalizeName";
import { pickRandom, safePickRandom, shuffle } from "./utils/random";
import { resolveTargetPlayer } from "./utils/resolveTargetPlayer";

type GameSetup = {
    pack: (typeof LOCATIONS)[number];
    players: Player[];
    controllers: Map<PlayerId, PlayerController>;
    agents: Agent[];
};

type TallyResult = {
    accusedName: string | null;
    isTie: boolean;
    spy: Player;
};

type RoundsResult = {
    turns: Turn[];
    earlyEnd: EarlyEndResult;
};

export type GameReporter = (line: string) => void;

export type GameInfoEntry = {
    location: string;
    allLocations: string[];
    roles: string[];
    players: Array<{ name: string; role: string; isSpy: boolean }>;
    config: GameConfig;
};

export class SpyfallGame {
    private rl: ReturnType<typeof readline.createInterface> | null = null;
    private running = false;
    /** When set, each log line is also sent here (e.g. for SSE streaming to a web client). */
    public onOutput?: GameReporter;
    /** When set, each AI prompt/response pair is sent here (e.g. for inspection). */
    public onPrompt?: (entry: PromptEntry) => void;
    /** When set, game setup info is sent here (for debug/inspection). */
    public onGameInfo?: (info: GameInfoEntry) => void;
    /** When set, agent creation info is sent here (for debug/inspection). */
    public onAgentCreated?: (entry: AgentCreatedEntry) => void;

    private log(msg: string): void {
        console.log(msg);
        this.onOutput?.(msg);
    }

    async run(config: GameConfig) {
        if (this.running) return;
        this.running = true;
        if (config.includeHuman) {
            this.rl = readline.createInterface({ input, output });
        }

        let agents: Agent[] = [];
        try {
            const setup = await this.setupGame(config);
            const { pack, players, controllers } = setup;
            agents = setup.agents;
            const spy = players.find(p => p.secret.kind === "SPY")!;
            
            this.revealHumanIdentity(players);
            this.emitGameInfo(pack, players, config);
            agents.forEach(a => a.emitCreated());
            
            const allowEarlyVote = config.allowEarlyVote ?? true;
            const { turns, earlyEnd } = await this.runQuestionRounds(config.rounds, players, controllers, pack, allowEarlyVote);
            
            // Check for early game termination (from spy guess or early vote)
            if (earlyEnd.ended) {
                this.printEarlyEndResult(pack, spy, earlyEnd);
            } else {
                // Normal game flow: final voting phase
                const votes = await this.runVotingPhase(players, controllers, turns);
                const { accusedName, isTie } = this.tallyVotes(votes, players);
                this.logVerdict(accusedName, isTie, spy);
                const spyGuessedRight = await this.runSpyGuessIfEligible(accusedName, isTie, spy, pack, controllers, turns);
                this.printFinalScore(pack, accusedName, spy, spyGuessedRight);
            }
        } finally {
            // Cleanup agents (deletes assistants/threads in thread mode)
            await Promise.all(agents.map(a => a.cleanup()));
            this.rl?.close();
            this.rl = null;
            this.running = false;
        }
    }

    private async setupGame(config: GameConfig): Promise<GameSetup> {
        // Convert legacy config to playerSlots if needed
        const slots: PlayerSlotConfig[] = config.playerSlots ?? this.legacyConfigToSlots(config);
        
        const pack = pickRandom(LOCATIONS);
        const numPlayers = slots.length;
        const spyIndex = Math.floor(Math.random() * numPlayers);
        const roles = shuffle(pack.roles).slice(0, numPlayers - 1);

        // Count occurrences of each provider to handle duplicate names
        const providerCounts: Record<string, number> = {};
        const providerInstanceNum: Record<string, number> = {};
        for (const slot of slots) {
            if (slot.type !== "human") {
                providerCounts[slot.type] = (providerCounts[slot.type] || 0) + 1;
            }
        }

        // Build player list from slots
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
                // Add suffix only if there are multiple of this provider
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
                controllers.set(p.id, new HumanController(this.rl!));
            } else {
                const aiSlot = slot as { type: ProviderType; mode: "memory" | "stateful" };
                const agent = new Agent({
                    name: p.name,
                    systemPrompt: buildPlayerSystemPrompt(p.name, p.secret),
                    provider: aiSlot.type,
                    mode: aiSlot.mode,
                    onPrompt: this.onPrompt,
                    onAgentCreated: this.onAgentCreated,
                });
                agents.push(agent);
                controllers.set(p.id, new AIController(agent));
            }
        }

        // Wait for all agents to be fully initialized before proceeding
        await Promise.all(agents.map(a => a.ready));

        return { pack, players, controllers, agents };
    }

    /** Convert legacy config format to playerSlots */
    private legacyConfigToSlots(config: GameConfig): PlayerSlotConfig[] {
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

    private revealHumanIdentity(players: Player[]): void {
        const human = players.find(p => p.isHuman);
        if (human) this.log(`\n=== YOUR IDENTITY ===\n${secretToBrief(human.secret)}\n=====================\n`);
    }

    private emitGameInfo(pack: (typeof LOCATIONS)[number], players: Player[], config: GameConfig): void {
        if (!this.onGameInfo) return;

        const allLocs = LOCATIONS.map(l => l.location);
        const playerInfo = players.map(p => ({
            name: p.name,
            role: p.secret.kind === "SPY" ? "SPY" : p.secret.role,
            isSpy: p.secret.kind === "SPY",
        }));

        this.onGameInfo({
            location: pack.location,
            allLocations: allLocs,
            roles: pack.roles,
            players: playerInfo,
            config,
        });
    }

    private async runQuestionRounds(
        numRounds: number,
        players: Player[],
        controllers: Map<PlayerId, PlayerController>,
        pack: (typeof LOCATIONS)[number],
        allowEarlyVote: boolean
    ): Promise<RoundsResult> {
        const turns: Turn[] = [];
        const playersWhoAnswered = new Set<PlayerId>();
        const usedVote = new Set<PlayerId>();
        let actionsUnlockAnnounced = false;
        let roundCount = 0;
        let currentAsker = pickRandom(players);
        let lastAsker: Player | null = null;

        this.log(`🚀 Game started! ${currentAsker.name} will ask the first question.`);

        while (roundCount < numRounds) {
            roundCount++;
            this.log(`\n[Round ${roundCount}]`);

            const askerCtl = controllers.get(currentAsker.id)!;
            const actionsUnlocked = playersWhoAnswered.size >= players.length;
            
            // If actions are unlocked, let the player choose what to do
            if (actionsUnlocked) {
                // canAccuse only if early accusations are enabled AND player hasn't used their accusation
                const canAccuse = allowEarlyVote && !usedVote.has(currentAsker.id);
                const choice = await askerCtl.chooseAction(players, turns, currentAsker, canAccuse);
                
                if (choice.thought) {
                    this.log(`💭 ${currentAsker.name}'s Decision: "${choice.thought}"`);
                }
                
                // Handle SPY GUESS action
                if (choice.action === "guess") {
                    if (currentAsker.secret.kind !== "SPY") {
                        this.log(`${currentAsker.name} tried to guess but isn't the spy! Defaulting to question.`);
                    } else {
                        const earlyEnd = await this.handleEarlySpyGuess(currentAsker, pack, controllers, turns);
                        if (earlyEnd.ended) {
                            return { turns, earlyEnd };
                        }
                        // If spy guessed wrong, game ends (spy loses)
                    }
                }
                
                // Handle ACCUSE action (vote action type = accusation)
                if (choice.action === "vote" && canAccuse) {
                    usedVote.add(currentAsker.id);
                    const earlyEnd = await this.handleAccusation(currentAsker, players, controllers, turns, pack);
                    if (earlyEnd.ended) {
                        return { turns, earlyEnd };
                    }
                    // If accusation failed (no majority), game continues
                    this.log(`Accusation failed. Game continues...`);
                    lastAsker = currentAsker;
                    currentAsker = pickRandom(players.filter(p => p.id !== currentAsker.id));
                    continue;
                }
            }
            
            // Default action: Ask a question
            const rawAsk = await askerCtl.ask(players, currentAsker);
            if (rawAsk.thought) this.log(`💭 ${currentAsker.name}'s Strategy: "${rawAsk.thought}"`);

            const target = resolveTargetPlayer(players, rawAsk.targetName, currentAsker.id, lastAsker?.id);
            this.log(`${currentAsker.name} ➔ ${target.name}`);
            this.log(`Q: ${rawAsk.question}`);

            // Reactions to the question (from players not involved)
            const questionReactors = players.filter(p => p.id !== currentAsker.id && p.id !== target.id && !p.isHuman);
            await this.collectReactions(questionReactors, controllers, "question", currentAsker.name, rawAsk.question);

            const targetCtl = controllers.get(target.id)!;
            const rawAnswer = await targetCtl.answer(currentAsker.name, rawAsk.question, target);
            const targetThought = parseField("THOUGHT", rawAnswer);
            const publicAnswer = parseField("ANSWER", rawAnswer) || rawAnswer;
            if (targetThought) this.log(`💭 ${target.name}'s Logic: "${targetThought}"`);
            this.log(`A: ${publicAnswer}`);

            // Track that this player has answered
            playersWhoAnswered.add(target.id);
            
            // Announce when actions unlock (once per game)
            if (!actionsUnlockAnnounced && playersWhoAnswered.size >= players.length) {
                actionsUnlockAnnounced = true;
                const accuseMsg = allowEarlyVote ? " and ACCUSE (once per game)" : "";
                this.log(`\n🔓 All players have answered! New actions unlocked: GUESS (spy)${accuseMsg}`);
            }

            // Reactions to the answer (from players not involved)
            const answerReactors = players.filter(p => p.id !== currentAsker.id && p.id !== target.id && !p.isHuman);
            await this.collectReactions(answerReactors, controllers, "answer", target.name, publicAnswer);

            turns.push({ askerId: currentAsker.name, targetId: target.name, question: rawAsk.question, answer: publicAnswer });

            lastAsker = currentAsker;
            currentAsker = target;
        }
        return { turns, earlyEnd: { ended: false } };
    }
    
    private async handleEarlySpyGuess(
        spy: Player,
        pack: (typeof LOCATIONS)[number],
        controllers: Map<PlayerId, PlayerController>,
        turns: Turn[]
    ): Promise<EarlyEndResult> {
        this.log(`\n🎲 ${spy.name} is taking a risk and guessing the location!`);
        
        const guessRaw = await controllers.get(spy.id)!.guessLocation(turns, spy, false) ?? "";
        const guess = parseField("GUESS", guessRaw);
        const reason = parseField("REASON", guessRaw);
        
        this.log(`${spy.name}: "I believe we are at the ${guess.toUpperCase()}!"`);
        if (reason) this.log(`Reason: "${reason}"`);
        
        const correct = normalizeName(guess) === normalizeName(pack.location);
        
        if (correct) {
            return { ended: true, winner: "spy", reason: "Spy correctly guessed the location!" };
        } else {
            return { ended: true, winner: "civilians", reason: "Spy guessed wrong!" };
        }
    }
    
    private async handleAccusation(
        accuser: Player,
        players: Player[],
        controllers: Map<PlayerId, PlayerController>,
        turns: Turn[],
        pack: (typeof LOCATIONS)[number]
    ): Promise<EarlyEndResult> {
        const spy = players.find(p => p.secret.kind === "SPY")!;
        const accuserCtl = controllers.get(accuser.id)!;
        
        // Step 1: Accuser picks who to accuse
        const accusation = await accuserCtl.accuse(players, turns, accuser);
        const accusedName = accusation.targetName;
        const accused = players.find(p => normalizeName(p.name) === normalizeName(accusedName));
        
        if (!accused || accused.id === accuser.id) {
            this.log(`${accuser.name} tried to make an invalid accusation. Skipping.`);
            return { ended: false };
        }
        
        this.log(`\n🚨 ${accuser.name} accuses ${accused.name} of being the spy!`);
        if (accusation.reason) this.log(`"${accusation.reason}"`);
        
        // Step 2: Accused defends themselves
        const accusedCtl = controllers.get(accused.id)!;
        const defenseResult = await accusedCtl.defendAgainstAccusation(
            accuser.name, 
            accusation.reason || "No reason given", 
            turns, 
            accused
        );
        
        this.log(`\n🛡️ ${accused.name} defends themselves:`);
        if (defenseResult.thought) this.log(`💭 ${accused.name}'s Strategy: "${defenseResult.thought}"`);
        this.log(`"${defenseResult.defense}"`);
        
        // Step 3: Everyone else votes yes/no (skip the accused - they obviously vote no)
        const voters = players.filter(p => p.id !== accuser.id && p.id !== accused.id);
        let yesVotes = 1; // Accuser implicitly votes yes
        let noVotes = 1;  // Accused implicitly votes no
        
        this.log(`\n⚖️ Voting on the accusation...`);
        this.log(`${accuser.name}: YES (accuser)`);
        this.log(`${accused.name}: NO (accused)`);
        
        for (const voter of voters) {
            const voterCtl = controllers.get(voter.id)!;
            const result = await voterCtl.voteOnAccusation(accuser.name, accused.name, defenseResult.defense, turns, voter);
            
            if (result.vote === "yes") {
                yesVotes++;
            } else {
                noVotes++;
            }
            
            this.log(`${voter.name}: ${result.vote.toUpperCase()} — "${result.reason}"`);
        }
        
        // Step 4: Check majority
        const majority = Math.floor(players.length / 2) + 1;
        this.log(`\n📊 Results: ${yesVotes} YES, ${noVotes} NO (need ${majority} for majority)`);
        
        if (yesVotes >= majority) {
            // Majority voted yes - accusation succeeds
            this.log(`✅ The group convicts ${accused.name}!`);
            this.log(`🕵️ REVEAL: The Spy was ${spy.name}!`);
            
            if (accused.id === spy.id) {
                // Correct! Spy caught! But spy gets one last chance to guess
                this.log(`\n${spy.name} was caught! But gets one last chance to guess the location...`);
                const guessRaw = await controllers.get(spy.id)!.guessLocation(turns, spy, true) ?? "";
                const guess = parseField("GUESS", guessRaw);
                const reason = parseField("REASON", guessRaw);
                
                this.log(`${spy.name}: "I believe we are at the ${guess.toUpperCase()}!"`);
                if (reason) this.log(`Reason: "${reason}"`);
                
                const correct = normalizeName(guess) === normalizeName(pack.location);
                if (correct) {
                    return { ended: true, winner: "spy", reason: "Spy was caught but correctly guessed the location!" };
                } else {
                    return { ended: true, winner: "civilians", reason: "Spy was caught and couldn't guess the location!" };
                }
            } else {
                // Wrong person convicted - spy wins!
                return { ended: true, winner: "spy", reason: `Civilians convicted ${accused.name} but the spy was ${spy.name}!` };
            }
        } else {
            // No majority - accusation fails, game continues
            this.log(`❌ Not enough votes. ${accused.name} is NOT convicted.`);
            return { ended: false };
        }
    }
    
    private printEarlyEndResult(
        pack: (typeof LOCATIONS)[number],
        spy: Player,
        result: EarlyEndResult & { ended: true }
    ): void {
        this.log("\n" + "=".repeat(30));
        this.log(`📍 ACTUAL LOCATION: ${pack.location}`);
        this.log(`🕵️ THE SPY WAS: ${spy.name}`);
        if (result.winner === "spy") {
            this.log(`🏆 RESULT: SPY WINS! (${result.reason})`);
        } else {
            this.log(`🏆 RESULT: CIVILIANS WIN! (${result.reason})`);
        }
        this.log("=".repeat(30) + "\n");
    }

    private async collectReactions(
        reactors: Player[],
        controllers: Map<PlayerId, PlayerController>,
        eventType: "question" | "answer",
        authorName: string,
        content: string
    ): Promise<void> {
        if (reactors.length === 0) return;

        const reactions = await Promise.all(
            reactors.map(async (p) => {
                const ctl = controllers.get(p.id)!;
                const result = await ctl.react(eventType, authorName, content, p);
                return { name: p.name, ...result };
            })
        );

        const validReactions = reactions.filter(r => r.emoji && r.reaction);
        if (validReactions.length > 0) {
            for (const r of validReactions) {
                this.log(`  ${r.emoji} ${r.name}: "${r.reaction}"`);
                if (r.suspicion) this.log(`     ↳ ${r.suspicion}`);
            }
        }
    }

    private async runVotingPhase(
        players: Player[],
        controllers: Map<PlayerId, PlayerController>,
        turns: Turn[]
    ): Promise<Map<string, number>> {
        this.log("\n=== 🗳️ VOTING PHASE ===");
        const votes = new Map<string, number>();
        for (const p of players) {
            const rawVote = await controllers.get(p.id)!.vote(players, turns, p);
            const thought = parseField("THOUGHT", rawVote);
            const voteName = parseField("VOTE", rawVote);
            const why = parseField("WHY", rawVote);

            if (thought) this.log(`\n💭 ${p.name}'s Voting Logic: "${thought}"`);

            const candidates = players.filter(x => x.id !== p.id);
            const validCandidate = candidates.find(x => normalizeName(x.name) === normalizeName(voteName));
            const finalVote = validCandidate?.name || safePickRandom(candidates, players[0]).name;

            votes.set(finalVote, (votes.get(finalVote) || 0) + 1);
            this.log(`${p.name} voted for: ${finalVote} (${why})`);
        }
        return votes;
    }

    private tallyVotes(votes: Map<string, number>, players: Player[]): TallyResult {
        const sortedVotes = [...votes.entries()].sort((a, b) => b[1] - a[1]);
        const isTie = sortedVotes.length > 1 && sortedVotes[0][1] === sortedVotes[1][1];
        const accusedName = isTie ? null : sortedVotes[0][0];
        const spy = players.find(p => p.secret.kind === "SPY")!;
        return { accusedName, isTie, spy };
    }

    private logVerdict(accusedName: string | null, isTie: boolean, spy: Player): void {
        this.log(`\n⚖️ VERDICT: ${isTie ? "A tie! The group is paralyzed by doubt." : `The group accuses ${accusedName}!`}`);
        this.log(`🕵️ REVEAL: The Spy was indeed ${spy.name}!`);
    }

    private async runSpyGuessIfEligible(
        accusedName: string | null,
        isTie: boolean,
        spy: Player,
        pack: (typeof LOCATIONS)[number],
        controllers: Map<PlayerId, PlayerController>,
        turns: Turn[]
    ): Promise<boolean> {
        if (accusedName !== spy.name && !isTie) return false;

        this.log(`\n${spy.name} attempts a final guess...`);
        const guessRaw = await controllers.get(spy.id)!.guessLocation(turns, spy, true) ?? "";
        const guess = parseField("GUESS", guessRaw);
        const reason = parseField("REASON", guessRaw);

        this.log(`${spy.name}: "I believe we are at the ${guess.toUpperCase()}!"`);
        if (reason) this.log(`Reason: "${reason}"`);

        return normalizeName(guess) === normalizeName(pack.location);
    }

    private printFinalScore(
        pack: (typeof LOCATIONS)[number],
        accusedName: string | null,
        spy: Player,
        spyGuessedRight: boolean
    ): void {
        this.log("\n" + "=".repeat(30));
        this.log(`📍 ACTUAL LOCATION: ${pack.location}`);
        if (spyGuessedRight) {
            this.log("🏆 RESULT: SPY WINS! (Correctly identified the location)");
        } else if (accusedName === spy.name) {
            this.log("🏆 RESULT: CIVILIANS WIN! (Spy was caught)");
        } else {
            this.log("🏆 RESULT: SPY WINS! (Total deception)");
        }
        this.log("=".repeat(30) + "\n");
    }
}