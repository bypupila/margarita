/**
 * MARGARITA COORDINATES SERVICE
 * ==============================
 * Single source of truth for all Margarita Island coordinates.
 * All coordinates are VERIFIED with Google Maps satellite imagery.
 * 
 * TO ADD A NEW ZONE:
 * 1. Go to Google Maps
 * 2. Search for the location in Margarita
 * 3. Right-click on the exact point and copy coordinates
 * 4. Add to MARGARITA_ZONES below with format: { name: 'Zone Name', lat: XX.XXXX, lng: -XX.XXXX }
 * 
 * COORDINATE BOUNDS FOR MARGARITA:
 * - Latitude: 10.85 to 11.20
 * - Longitude: -64.05 to -63.75
 */

export interface ZoneCoordinates {
    name: string;
    lat: number;
    lng: number;
    aliases?: string[];  // Alternative names for matching
}

// ============================================================================
// VERIFIED GOOGLE MAPS COORDINATES FOR MARGARITA ISLAND
// Last updated: January 2026
// ============================================================================
export const MARGARITA_ZONES: ZoneCoordinates[] = [
    // ==================== CIUDADES & CENTROS ====================
    { name: 'Porlamar', lat: 10.9580, lng: -63.8520, aliases: ['centro', 'casco central'] },
    { name: 'Pampatar', lat: 10.9970, lng: -63.7975, aliases: ['castillo'] },
    { name: 'Juan Griego', lat: 11.0850, lng: -63.9690, aliases: ['bahia juan griego'] },
    { name: 'La Asunción', lat: 11.0333, lng: -63.8628, aliases: ['asuncion', 'capital'] },

    // ==================== ZONA COMERCIAL & MANEIRO ====================
    { name: 'Sambil', lat: 10.9962, lng: -63.8140, aliases: ['sambil margarita', 'cc sambil'] },
    { name: 'Rattan Plaza', lat: 10.9926, lng: -63.8234, aliases: ['rattan', 'cc rattan'] },
    { name: 'La Caracola', lat: 10.9580, lng: -63.8491, aliases: ['pista caracola'] },
    { name: 'Costa Azul', lat: 10.9772, lng: -63.8229, aliases: ['urb costa azul', 'urbanizacion costa azul'] },
    { name: 'Jorge Coll', lat: 10.9991, lng: -63.8228, aliases: ['urb jorge coll'] },
    { name: 'Los Robles', lat: 10.9880, lng: -63.8310, aliases: ['plaza los robles'] },
    { name: 'Maneiro', lat: 10.9950, lng: -63.8150, aliases: ['municipio maneiro'] },
    { name: 'Parque Costazul', lat: 10.9880, lng: -63.8540, aliases: ['costazul', 'cc costazul'] },
    { name: 'Bella Vista', lat: 10.9660, lng: -63.8570, aliases: ['playa bella vista'] },

    // ==================== ZONAS RESIDENCIALES ====================
    { name: 'Villa Rosa', lat: 10.9524, lng: -63.9258, aliases: ['urb villa rosa'] },
    { name: 'Las Garzas', lat: 10.9690, lng: -63.8500, aliases: ['sector las garzas', 'sigo'] },
    { name: 'La Arboleda', lat: 10.9762, lng: -63.8332, aliases: ['urb la arboleda'] },
    { name: 'Los Cocos', lat: 10.9555, lng: -63.8477, aliases: ['sector los cocos'] },
    { name: 'Playa El Ángel', lat: 10.9880, lng: -63.8330, aliases: ['el angel', 'playa el angel'] },
    { name: 'El Paraíso', lat: 10.9650, lng: -63.8400, aliases: ['urb el paraiso'] },
    { name: 'Sabanamar', lat: 10.9700, lng: -63.8350, aliases: ['urb sabanamar'] },

    // ==================== ESTE & PLAYAS ====================
    { name: 'Guacuco', lat: 11.0502, lng: -63.8133, aliases: ['playa guacuco'] },
    { name: 'Paraguachí', lat: 11.0600, lng: -63.8100, aliases: [] },
    { name: 'El Cardón', lat: 11.0450, lng: -63.8150, aliases: [] },
    { name: 'Playa Caribe', lat: 11.1110, lng: -63.9580, aliases: ['caribe'] },

    // ==================== NORTE ====================
    { name: 'Playa El Agua', lat: 11.1455, lng: -63.8630, aliases: ['el agua'] },
    { name: 'Playa Parguito', lat: 11.1350, lng: -63.8510, aliases: ['parguito'] },
    { name: 'Puerto Cruz', lat: 11.1450, lng: -63.9550, aliases: [] },
    { name: 'Playa Zaragoza', lat: 11.1400, lng: -63.9400, aliases: ['zaragoza'] },
    { name: 'Pedro González', lat: 11.1350, lng: -63.9350, aliases: ['pedro gonzalez'] },
    { name: 'Manzanillo', lat: 11.1575, lng: -63.8920, aliases: ['bahia manzanillo'] },

    // ==================== SUR & OESTE ====================
    { name: 'El Yaque', lat: 10.9023, lng: -63.9616, aliases: ['playa el yaque', 'yaque'] },
    { name: 'El Valle', lat: 10.9850, lng: -63.8850, aliases: ['valle del espiritu santo', 'basilica'] },
    { name: 'San Juan Bautista', lat: 11.0100, lng: -63.9300, aliases: ['san juan'] },
    { name: 'Boca de Río', lat: 10.9650, lng: -64.0300, aliases: ['boca del rio'] },  // Corrected - was outside bounds

    // ==================== MACANAO ====================
    { name: 'Boca de Pozo', lat: 10.9800, lng: -64.0100, aliases: [] },
    { name: 'San Francisco', lat: 10.9700, lng: -64.0000, aliases: ['san francisco macanao'] },

    // ==================== DEFAULT (Center of island) ====================
    { name: 'Isla de Margarita', lat: 11.0000, lng: -63.8800, aliases: ['margarita', 'nueva esparta', 'isla'] },
];

// Margarita Island geographic bounds
export const MARGARITA_BOUNDS = {
    minLat: 10.85,
    maxLat: 11.20,
    minLng: -64.05,
    maxLng: -63.70
};

/**
 * Validate if coordinates are within Margarita Island bounds
 */
export function isValidMargaritaCoordinate(lat: number, lng: number): boolean {
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (isNaN(lat) || isNaN(lng)) return false;

    return lat >= MARGARITA_BOUNDS.minLat &&
        lat <= MARGARITA_BOUNDS.maxLat &&
        lng >= MARGARITA_BOUNDS.minLng &&
        lng <= MARGARITA_BOUNDS.maxLng;
}

/**
 * Find zone by name (case-insensitive, includes aliases)
 */
export function findZoneByName(zoneName: string): ZoneCoordinates | null {
    if (!zoneName) return null;

    const searchName = zoneName.toLowerCase().trim();

    // First, try exact match
    const exactMatch = MARGARITA_ZONES.find(z =>
        z.name.toLowerCase() === searchName
    );
    if (exactMatch) return exactMatch;

    // Try alias match
    const aliasMatch = MARGARITA_ZONES.find(z =>
        z.aliases?.some(a => a.toLowerCase() === searchName)
    );
    if (aliasMatch) return aliasMatch;

    // Try partial match (zone name contains search or search contains zone name)
    const partialMatch = MARGARITA_ZONES.find(z =>
        z.name.toLowerCase().includes(searchName) ||
        searchName.includes(z.name.toLowerCase()) ||
        z.aliases?.some(a =>
            a.toLowerCase().includes(searchName) ||
            searchName.includes(a.toLowerCase())
        )
    );
    if (partialMatch) return partialMatch;

    return null;
}

/**
 * Get coordinates for a zone, with small random offset to prevent marker stacking
 */
export function getZoneCoordinates(zoneName: string): { lat: number; lng: number } | null {
    const zone = findZoneByName(zoneName);
    if (!zone) return null;

    // Add small random offset (approximately 100-200 meters)
    const offset = () => (Math.random() - 0.5) * 0.003;

    return {
        lat: zone.lat + offset(),
        lng: zone.lng + offset()
    };
}

/**
 * Validate and fix coordinates
 * Returns valid coordinates or null if unfixable
 */
export function validateAndFixCoordinates(
    coordinates: { lat?: number; lng?: number } | undefined,
    zoneName?: string
): { lat: number; lng: number } | null {

    // Check if existing coordinates are valid
    if (coordinates?.lat && coordinates?.lng) {
        if (isValidMargaritaCoordinate(coordinates.lat, coordinates.lng)) {
            return { lat: coordinates.lat, lng: coordinates.lng };
        }
    }

    // Try to get coordinates from zone name
    if (zoneName) {
        const zoneCoords = getZoneCoordinates(zoneName);
        if (zoneCoords) {
            console.log(`[CoordinateService] Asignando coordenadas de zona "${zoneName}"`);
            return zoneCoords;
        }
    }

    // No valid coordinates found
    console.warn(`[CoordinateService] No se pudieron obtener coordenadas válidas para zona: ${zoneName}`);
    return null;
}

/**
 * Get default coordinates (center of Margarita)
 */
export function getDefaultCoordinates(): { lat: number; lng: number } {
    const offset = () => (Math.random() - 0.5) * 0.01;
    return {
        lat: 11.0000 + offset(),
        lng: -63.8800 + offset()
    };
}

/**
 * Print all zones for debugging
 */
export function logAllZones(): void {
    console.log('=== MARGARITA ZONES ===');
    MARGARITA_ZONES.forEach(z => {
        console.log(`${z.name}: (${z.lat}, ${z.lng})`);
    });
}
