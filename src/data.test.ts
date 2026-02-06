import { describe, it, expect } from "vitest";
import { LOCATIONS, allLocationsList } from "./data";

describe("LOCATIONS data", () => {
    it("should have 30 locations", () => {
        expect(LOCATIONS.length).toBe(30);
    });

    it("should have 7-8 roles per location", () => {
        LOCATIONS.forEach(location => {
            expect(location.roles.length).toBeGreaterThanOrEqual(7);
            expect(location.roles.length).toBeLessThanOrEqual(8);
        });
    });

    it("should have unique location names", () => {
        const names = LOCATIONS.map(l => l.location);
        const uniqueNames = new Set(names);
        expect(uniqueNames.size).toBe(LOCATIONS.length);
    });

    it("should have non-empty role names", () => {
        LOCATIONS.forEach(location => {
            location.roles.forEach(role => {
                expect(role.trim().length).toBeGreaterThan(0);
            });
        });
    });

    it("should have unique roles within each location", () => {
        LOCATIONS.forEach(location => {
            const roles = location.roles;
            const uniqueRoles = new Set(roles);
            expect(uniqueRoles.size).toBe(roles.length);
        });
    });

    it("allLocationsList should return comma-separated list", () => {
        const list = allLocationsList();
        expect(list).toContain(",");
        expect(list).toContain("Airplane");
        expect(list).toContain("Bank");
    });

    it("allLocationsList should include all locations", () => {
        const list = allLocationsList().toLowerCase();
        LOCATIONS.forEach(location => {
            expect(list).toContain(location.location.toLowerCase());
        });
    });
});
