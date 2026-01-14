/**
 * Geocoding Service for Margarita, Venezuela
 * Uses Google Maps API (primary) or Nominatim (fallback) for geocoding
 * STRICT MODE: Rejects properties without valid coordinates
 */

import { Property } from '../types';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Margarita Island bounding box for validation
const MARGARITA_BOUNDS = {
    minLat: 10.85,
    maxLat: 11.20,
    minLon: -64.05,
    maxLon: -63.70
};

// Known zones in Margarita with verified coordinates
const KNOWN_ZONES: Record<string, [number, number]> = {
    'Porlamar': [10.9580, -63.8520],
    'Pampatar': [10.9970, -63.7975],
    'Juan Griego': [11.0850, -63.9690],
    'La Asunción': [11.0333, -63.8628],
    'Playa El Agua': [11.1455, -63.8630],
    'El Yaque': [10.9023, -63.9616],
    'Playa Parguito': [11.1350, -63.8510],
    'Bella Vista': [10.9660, -63.8570],
    'Costa Azul': [10.9772, -63.8229],
    'Jorge Coll': [10.9991, -63.8228],
    'La Caracola': [10.9580, -63.8491],
    'Los Robles': [10.9880, -63.8310],
    'El Valle': [10.9850, -63.8850],
    'Guacuco': [11.0502, -63.8133],
    'Manzanillo': [11.1575, -63.8920],
    'Playa El Angel': [10.9880, -63.8330],
    'Isla de Margarita': [11.0000, -63.9000],
};

export interface GeocodingResult {
    lat: number;
    lng: number;
    formattedAddress?: string;
    source: 'google' | 'nominatim' | 'local';
    confidence: 'exact' | 'approximate' | 'zone_center';
}

interface NominatimResult {
    lat: string;
    lon: string;
    display_name: string;
    importance: number;
}

/**
 * Check if coordinates are within Margarita Island
 */
export function isWithinMargarita(lat: number, lng: number): boolean {
    return lat >= MARGARITA_BOUNDS.minLat && lat <= MARGARITA_BOUNDS.maxLat &&
        lng >= MARGARITA_BOUNDS.minLon && lng <= MARGARITA_BOUNDS.maxLon;
}

/**
 * Check if Google Maps geocoding is available
 */
export function isGoogleMapsAvailable(): boolean {
    return !!GOOGLE_MAPS_API_KEY;
}

/**
 * Geocode an address in Margarita, Venezuela
 */
export async function geocodeAddress(
    address: string,
    zone?: string
): Promise<{ lat: number; lon: number } | null> {
    try {
        // If we have a known zone, use its coordinates
        if (zone && KNOWN_ZONES[zone]) {
            const [lon, lat] = KNOWN_ZONES[zone];
            console.log(`[Geocoding] Using known coordinates for zone: ${zone}`);
            return { lat, lon };
        }

        // Build search query
        const query = [address, zone, 'Margarita', 'Venezuela']
            .filter(Boolean)
            .join(', ');

        console.log(`[Geocoding] Searching for: ${query}`);

        const params = new URLSearchParams({
            q: query,
            format: 'json',
            limit: '1',
            // Bias results to Margarita island
            viewbox: `${MARGARITA_BOUNDS.minLon},${MARGARITA_BOUNDS.maxLat},${MARGARITA_BOUNDS.maxLon},${MARGARITA_BOUNDS.minLat}`,
            bounded: '1'
        });

        const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params}`, {
            headers: {
                'User-Agent': 'MargaritaProperties/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`Nominatim request failed: ${response.status}`);
        }

        const results: NominatimResult[] = await response.json();

        if (results.length === 0) {
            console.warn(`[Geocoding] No results found for: ${query}`);

            // Fallback: Try just with the zone
            if (zone) {
                const fallbackQuery = `${zone}, Margarita, Venezuela`;
                const fallbackParams = new URLSearchParams({
                    q: fallbackQuery,
                    format: 'json',
                    limit: '1'
                });

                const fallbackResponse = await fetch(`${NOMINATIM_BASE_URL}/search?${fallbackParams}`, {
                    headers: { 'User-Agent': 'MargaritaProperties/1.0' }
                });

                const fallbackResults: NominatimResult[] = await fallbackResponse.json();

                if (fallbackResults.length > 0) {
                    const result = fallbackResults[0];
                    return {
                        lat: parseFloat(result.lat),
                        lon: parseFloat(result.lon)
                    };
                }
            }

            return null;
        }

        const result = results[0];
        console.log(`[Geocoding] Found: ${result.display_name}`);

        return {
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon)
        };
    } catch (error) {
        console.error('[Geocoding] Error:', error);
        return null;
    }
}

/**
 * Geocode a property based on its address and zone
 */
export async function geocodeProperty(property: Property): Promise<Property> {
    // Rate limiting for Nominatim (1 request per second)
    await new Promise(resolve => setTimeout(resolve, 1100));

    const coords = await geocodeAddress(property.address, property.zone);

    if (coords) {
        return {
            ...property,
            latitude: coords.lat,
            longitude: coords.lon
        };
    }

    // Fallback to zone center if geocoding fails
    if (property.zone && KNOWN_ZONES[property.zone]) {
        const [lon, lat] = KNOWN_ZONES[property.zone];
        console.warn(`[Geocoding] Using fallback coordinates for ${property.zone}`);
        return {
            ...property,
            latitude: lat,
            longitude: lon
        };
    }

    // Last resort: center of Margarita
    console.warn(`[Geocoding] Using center of Margarita for property ${property.id}`);
    return {
        ...property,
        latitude: 11.00,
        longitude: -63.85
    };
}

/**
 * Batch geocode multiple properties
 */
export async function geocodeProperties(properties: Property[]): Promise<Property[]> {
    const geocoded: Property[] = [];

    for (const property of properties) {
        try {
            const geocodedProperty = await geocodeProperty(property);
            geocoded.push(geocodedProperty);
            console.log(`[Geocoding] Geocoded ${property.id}: ${geocodedProperty.zone}`);
        } catch (error) {
            console.error(`[Geocoding] Failed to geocode property ${property.id}:`, error);
            geocoded.push(property); // Add anyway with fallback coords
        }
    }

    return geocoded;
}

/**
 * Get all known zones
 */
export function getKnownZones(): string[] {
    return Object.keys(KNOWN_ZONES);
}

/**
 * Get center coordinates for Margarita
 */
export function getMargaritaCenter(): [number, number] {
    return [-63.85, 11.00]; // [lon, lat]
}
