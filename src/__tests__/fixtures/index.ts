import type { LocationPack } from "../../data";

export const mockLocations: LocationPack[] = [
    {
        location: "Test Airplane",
        roles: ["Pilot", "Flight Attendant", "Passenger", "Mechanic", "Air Marshal", "Co-Pilot", "Baggage Handler"],
    },
    {
        location: "Test Bank",
        roles: ["Teller", "Manager", "Security Guard", "Customer", "Robber", "Accountant", "Janitor"],
    },
    {
        location: "Test Casino",
        roles: ["Dealer", "Pit Boss", "Player", "Bartender", "Security", "Cashier", "Waitress"],
    },
];

export const mockAIResponses = {
    validQuestion: "THOUGHT: I need to figure out if they're the spy\nTARGET: Alice\nQUESTION: What do you like most about being here?",
    validAnswer: "THOUGHT: I should answer carefully\nANSWER: I love the atmosphere and the people!",
    validVote: "THOUGHT: Bob seems suspicious\nVOTE: Bob",
    validGuess: "THOUGHT: Based on the clues, I think it's...\nGUESS: Test Casino",
    validReaction: "EMOJI: 🤔\nCOMMENT: That's an interesting answer...",
    validAction: "THOUGHT: I should keep gathering info\nACTION: question",
    
    missingField: "TARGET: Alice\nQUESTION: What's up?",
    malformed: "Just some random text without structure",
    wrongFormat: "THOUGHT=thinking\nTARGET=Alice",
};

export const mockGameState = {
    location: "Test Airplane",
    roles: ["Pilot", "Flight Attendant", "Passenger"],
    players: [
        { id: "1" as any, name: "Alice", role: "Pilot", isSpy: false },
        { id: "2" as any, name: "Bob", role: "Flight Attendant", isSpy: false },
        { id: "3" as any, name: "Charlie", role: "Passenger", isSpy: true },
    ],
};
