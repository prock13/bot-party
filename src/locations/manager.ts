import { LOCATIONS, type LocationPack } from "../data.js";

/**
 * Location Manager - handles default and custom location packs
 */
export class LocationManager {
    private customLocations: LocationPack[] = [];

    /**
     * Get all available locations (default + custom)
     */
    getAll(): LocationPack[] {
        return [... LOCATIONS, ...this.customLocations];
    }

    /**
     * Get default locations only
     */
    getDefaults(): LocationPack[] {
        return [...LOCATIONS];
    }

    /**
     * Add a custom location pack
     */
    addCustom(pack: LocationPack): void {
        if (!this.validateLocation(pack)) {
            throw new Error("Invalid location pack");
        }
        this.customLocations.push(pack);
    }

    /**
     * Add multiple custom locations
     */
    addCustomBatch(packs: LocationPack[]): void {
        for (const pack of packs) {
            if (!this.validateLocation(pack)) {
                throw new Error(`Invalid location pack: ${pack.location}`);
            }
        }
        this.customLocations.push(...packs);
    }

    /**
     * Clear all custom locations
     */
    clearCustom(): void {
        this.customLocations = [];
    }

    /**
     * Find a location by name (case-insensitive)
     */
    findByName(name: string): LocationPack | undefined {
        const normalized = name.toLowerCase().trim();
        const all = this.getAll();
        return all.find(loc => loc.location.toLowerCase() === normalized);
    }

    /**
     * Validate a location pack
     */
    validateLocation(pack: LocationPack): boolean {
        if (!pack || typeof pack !== "object") return false;
        if (!pack.location || typeof pack.location !== "string" || pack.location.trim().length === 0) return false;
        if (!Array.isArray(pack.roles)) return false;
        if (pack.roles.length < 3) return false; // Minimum 3 roles
        
        // Check all roles are non-empty strings
        for (const role of pack.roles) {
            if (typeof role !== "string" || role.trim().length === 0) {
                return false;
            }
        }
        
        // Check for unique roles
        const uniqueRoles = new Set(pack.roles);
        if (uniqueRoles.size !== pack.roles.length) return false;
        
        return true;
    }

    /**
     * Export all custom locations as JSON
     */
    exportCustom(): string {
        return JSON.stringify(this.customLocations, null, 2);
    }

    /**
     * Export all locations (default + custom) as JSON
     */
    exportAll(): string {
        return JSON.stringify(this.getAll(), null, 2);
    }

    /**
     * Get location count
     */
    getCount(): { total: number; default: number; custom: number } {
        return {
            total: this.getAll().length,
            default: LOCATIONS.length,
            custom: this.customLocations.length,
        };
    }
}
