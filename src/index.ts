import { SpyfallGame } from "./game";

const game = new SpyfallGame();
console.log("Starting Spyfall...");

await game.run({
    numPlayers: 4,       // total players
    includeHuman: false,  // set false for AI-only
    rounds: 12            // number of Q/A turns
});