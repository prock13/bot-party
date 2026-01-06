export type LocationPack = {
    location: string;
    roles: string[];
};

export const LOCATIONS: LocationPack[] = [
    { location: "Airplane", roles: ["Business Class Passenger", "Coach Passenger", "Cockpit Crew", "Flight Attendant", "Flight Engineer", "Pilot", "Stowaway"] },
    { location: "Amusement Park", roles: ["Clown", "Kid", "Mechanic", "Ride Operator", "Tourist", "Vendor", "Visitor"] },
    { location: "Bank", roles: ["Armored Car Driver", "Branch Manager", "Consultant", "Customer", "Security Guard", "Robber", "Teller"] },
    { location: "Beach", roles: ["Entertainment Director", "Food Vendor", "Lifeguard", "Photographer", "Paraglider", "Thief", "Vacationer"] },
    { location: "Carnival", roles: ["Customer", "Photographer", "Reenactor", "Reporter", "Roleplayer", "Game Fan", "Tourist", "Vendor"] },
    { location: "Casino", roles: ["Administrator", "Bartender", "Bouncer", "Cardsharp", "Dealer", "Head of Security", "Gambler"] },
    { location: "Circus Tent", roles: ["Acrobat", "Animal Tamer", "Circus Goer", "Clown", "Juggler", "Knife Thrower", "Magician"] },
    { location: "Corporate Party", roles: ["Accountant", "Administrative Assistant", "CEO", "Courier", "Emcee", "Manager", "Party Crasher"] },
    { location: "Crusader Army", roles: ["Archer", "Bishop", "Captive", "Saracen", "Knight", "Monk", "Servant", "Squire"] },
    { location: "Day Spa", roles: ["Beautician", "Customer", "Dermatologist", "Makeup Specialist", "Masseur", "Nail Specialist", "Stylist"] },
    { location: "Embassy", roles: ["Ambassador", "Bureaucrat", "Diplomat", "Refugee", "Secretary", "Security Guard", "Tourist"] },
    { location: "Hospital", roles: ["Head Physician", "Intern", "Nurse", "Pathologist", "Patient", "Physician", "Surgeon"] },
    { location: "Hotel", roles: ["Bartender", "Doorman", "Guest", "Hotel Manager", "Housekeeper", "Receptionist", "Security Guard"] },
    { location: "Military Base", roles: ["Colonel", "Deserter", "Medic", "Non-Commissioned Officer", "Private", "Sales Clerk", "Sentry"] },
    { location: "Movie Studio", roles: ["Actor", "Cameraman", "Costume Designer", "Director", "Extra", "Sound Engineer", "Stuntman"] },
    { location: "Night Club", roles: ["Barman", "Bouncer", "Dancer", "DJ", "Model", "Pickup Artist", "Regular"] },
    { location: "Ocean Liner", roles: ["Attendant", "Bartender", "Captain", "Cook", "Musician", "Radio Operator", "Wealthy Passenger"] },
    { location: "Passenger Train", roles: ["Conductor", "Dining Car Cook", "Passenger", "Passenger Car Attendant", "Stoker", "Ticket Taker", "Vendor"] },
    { location: "Pirate Ship", roles: ["Cabin Boy", "Cook", "Gunner", "Seaman", "Shackled Prisoner", "Slave", "Swashbuckling Captain"] },
    { location: "Polar Station", roles: ["Biologist", "Expedition Leader", "Geoscientist", "Hydrologist", "Medic", "Meteorologist", "Radio Operator"] },
    { location: "Police Station", roles: ["Attorney", "Beat Cop", "Criminal", "Detective", "Journalist", "Lieutenant", "Suspect"] },
    { location: "Restaurant", roles: ["Busboy", "Chef", "Customer", "Food Critic", "Maître d’", "Musician", "Waiter"] },
    { location: "School", roles: ["Gym Teacher", "Janitor", "Math Teacher", "Principal", "Security Guard", "Student", "Vice Principal"] },
    { location: "Service Station", roles: ["Biker", "Car Washer", "Driver", "Electrical Technician", "Manager", "Service Receptionist", "Tire Service Technician"] },
    { location: "Space Station", roles: ["Alien", "Doctor", "Mechanical Engineer", "Mission Commander", "Pilot", "Research Engineer", "Space Tourist"] },
    { location: "Submarine", roles: ["Commander", "Cook", "Electrical Officer", "Navigator", "Radio Operator", "Sailor", "Sonar Operator"] },
    { location: "Supermarket", roles: ["Butcher", "Cashier", "Customer", "Delivery Man", "Janitor", "Merchandiser", "Security Guard"] },
    { location: "Theatre", roles: ["Actor", "Audience Member", "Coatroom Attendant", "Director", "Prompter", "Stage Hand", "Usher"] },
    { location: "University", roles: ["Campus Security", "Dean", "Graduate Student", "President", "Professor", "Researcher", "Student"] },
    { location: "Zoo", roles: ["Caretaker", "General Manager", "Guide", "Janitor", "Vendor", "Veterinarian", "Visitor"] }
];

export type Location = typeof LOCATIONS[number]["location"];

export function allLocationsList(): string {
  return LOCATIONS.map(l => l.location).join(", ");
}

export function getRandomLocationPack(): LocationPack {
    const randomIndex = Math.floor(Math.random() * LOCATIONS.length);
    return LOCATIONS[randomIndex];
}