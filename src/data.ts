export type LocationPack = {
    location: string;
    roles: string[];
};

export const LOCATIONS: LocationPack[] = [
    {
        location: "Airport",
        roles: ["Pilot", "Flight Attendant", "Security Officer", "Traveler", "Air Traffic Controller", "Mechanic"]
    },
    {
        location: "Beach",
        roles: ["Lifeguard", "Surfer", "Tourist", "Ice Cream Vendor", "Photographer", "Beach Volleyball Player"]
    },
    {
        location: "Casino",
        roles: ["Dealer", "Gambler", "Security Guard", "Bartender", "Pit Boss", "Entertainer"]
    },
    {
        location: "Hospital",
        roles: ["Doctor", "Nurse", "Surgeon", "Patient", "Paramedic", "Receptionist"]
    },
    {
        location: "Movie Set",
        roles: ["Director", "Actor", "Camera Operator", "Makeup Artist", "Producer", "Sound Engineer"]
    }
];

export type Location = typeof LOCATIONS[number]["location"];

export function allLocationsList(): string {
  return LOCATIONS.map(l => l.location).join(", ");
}

export function getRandomLocationPack(): LocationPack {
    const randomIndex = Math.floor(Math.random() * LOCATIONS.length);
    return LOCATIONS[randomIndex];
}