/**
 * Discovery Agent Service
 * Orchestrates the complete property discovery pipeline:
 * 1. Scraping (Apify)
 * 2. AI Extraction (Gemini)
 * 3. Geocoding (Nominatim)
 * 4. Zone Analysis
 * 5. Price Estimation
 */

import { Property, Zone, PriceEstimate } from '../types';
import { apifyService, MARGARITA_HASHTAGS } from './apifyService';
import { enrichProperties } from './geminiService';
import { geocodeProperties } from './geocodingService';
import { analyzeZones } from './zoneAnalyzer';
import { estimatePrices } from './priceEstimator';

/**
 * Deduplicate properties - keeps the one with highest quality score
 * Duplicates are identified by same price + zone + property type
 */
function deduplicateProperties(properties: Property[]): Property[] {
    const uniqueMap = new Map<string, Property>();

    for (const property of properties) {
        // Create a unique key based on key property characteristics
        const key = [
            property.price || 'no-price',
            property.zone?.toLowerCase() || 'no-zone',
            property.type || 'no-type',
            property.bedrooms || 0,
            property.bathrooms || 0
        ].join('|');

        const existing = uniqueMap.get(key);

        if (!existing) {
            uniqueMap.set(key, property);
        } else {
            // Keep the one with higher quality score
            if ((property.qualityScore || 0) > (existing.qualityScore || 0)) {
                uniqueMap.set(key, property);
                console.log(`[Dedup] Replacing duplicate: ${existing.title} -> ${property.title} (better quality)`);
            } else {
                console.log(`[Dedup] Skipping duplicate: ${property.title}`);
            }
        }
    }

    const deduplicated = Array.from(uniqueMap.values());
    const removed = properties.length - deduplicated.length;

    if (removed > 0) {
        console.log(`[Dedup] Removed ${removed} duplicates, kept ${deduplicated.length} unique properties`);
    }

    return deduplicated;
}

export interface DiscoveryResult {
    properties: Property[];
    zones: Zone[];
    priceEstimates: Map<string, PriceEstimate>;
}

export interface DiscoveryProgress {
    stage: 'scraping' | 'extracting' | 'geocoding' | 'analyzing' | 'complete' | 'error';
    message: string;
    progress: number; // 0-100
    propertiesFound?: number;
}

/**
 * Run complete property discovery pipeline
 */
export async function runPropertyDiscovery(
    hashtags?: string[],
    onProgress?: (progress: DiscoveryProgress) => void
): Promise<DiscoveryResult> {
    const updateProgress = (stage: DiscoveryProgress['stage'], message: string, progress: number, propertiesFound?: number) => {
        console.log(`[Discovery] ${stage}: ${message} (${progress}%)`);
        if (onProgress) {
            onProgress({ stage, message, progress, propertiesFound });
        }
    };

    try {
        // Stage 1: Scraping Instagram
        updateProgress('scraping', 'Buscando propiedades en Instagram...', 0);

        const { partialProperties } = await apifyService.discoverMargaritaProperties(
            hashtags || MARGARITA_HASHTAGS.slice(0, 3)
        );

        if (partialProperties.length === 0) {
            updateProgress('complete', 'No se encontraron propiedades', 100, 0);
            return {
                properties: [],
                zones: [],
                priceEstimates: new Map()
            };
        }

        updateProgress('scraping', `Encontrados ${partialProperties.length} posts`, 20, partialProperties.length);

        // Stage 2: AI Data Extraction
        updateProgress('extracting', 'Extrayendo datos con IA...', 25);

        const enrichedProperties = await enrichProperties(partialProperties);

        if (enrichedProperties.length === 0) {
            updateProgress('complete', 'No se pudieron extraer datos válidos', 100, 0);
            return {
                properties: [],
                zones: [],
                priceEstimates: new Map()
            };
        }

        // Stage 2.5: Deduplication
        updateProgress('extracting', 'Eliminando duplicados...', 45);
        const uniqueProperties = deduplicateProperties(enrichedProperties);

        updateProgress('extracting', `${uniqueProperties.length} propiedades únicas (${enrichedProperties.length - uniqueProperties.length} duplicados eliminados)`, 50, uniqueProperties.length);

        // Stage 3: Geocoding
        updateProgress('geocoding', 'Geocodificando direcciones...', 55);

        const geocodedProperties = await geocodeProperties(uniqueProperties);

        updateProgress('geocoding', `Geocodificadas ${geocodedProperties.length} propiedades`, 75);

        // Stage 4: Zone Analysis
        updateProgress('analyzing', 'Analizando zonas...', 80);

        const zones = analyzeZones(geocodedProperties);

        updateProgress('analyzing', `Analizadas ${zones.length} zonas`, 85);

        // Stage 5: Price Estimation
        updateProgress('analyzing', 'Estimando precios...', 90);

        const priceEstimates = estimatePrices(geocodedProperties);

        updateProgress('complete', `Descubrimiento completo: ${geocodedProperties.length} propiedades en ${zones.length} zonas`, 100, geocodedProperties.length);

        return {
            properties: geocodedProperties,
            zones,
            priceEstimates
        };

    } catch (error) {
        console.error('[Discovery] Error in pipeline:', error);
        updateProgress('error', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 0);
        throw error;
    }
}

/**
 * Discover properties from a specific Instagram account
 */
export async function discoverFromAccount(
    username: string,
    onProgress?: (progress: DiscoveryProgress) => void
): Promise<DiscoveryResult> {
    const updateProgress = (stage: DiscoveryProgress['stage'], message: string, progress: number) => {
        if (onProgress) {
            onProgress({ stage, message, progress });
        }
    };

    try {
        updateProgress('scraping', `Analizando cuenta @${username}...`, 0);

        // Get raw posts from profile
        const rawPosts = await apifyService.fetchPropertiesFromProfile(username.replace('@', ''), 30);

        if (rawPosts.length === 0) {
            updateProgress('complete', 'No se encontraron propiedades en esta cuenta', 100);
            return {
                properties: [],
                zones: [],
                priceEstimates: new Map()
            };
        }

        // Convert to partial properties
        const partialProperties = rawPosts.map(post => apifyService.convertToPartialProperty(post));

        updateProgress('scraping', `Encontrados ${partialProperties.length} posts`, 20);

        // Continue with enrichment pipeline
        updateProgress('extracting', 'Extrayendo datos...', 30);
        const enrichedProperties = await enrichProperties(partialProperties);

        updateProgress('geocoding', 'Geocodificando...', 60);
        const geocodedProperties = await geocodeProperties(enrichedProperties);

        updateProgress('analyzing', 'Analizando...', 80);
        const zones = analyzeZones(geocodedProperties);
        const priceEstimates = estimatePrices(geocodedProperties);

        updateProgress('complete', `Completado: ${geocodedProperties.length} propiedades`, 100);

        return {
            properties: geocodedProperties,
            zones,
            priceEstimates
        };

    } catch (error) {
        console.error('[Discovery] Error discovering from account:', error);
        updateProgress('error', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 0);
        throw error;
    }
}

/**
 * Load mock properties for development/testing
 */
export function loadMockProperties(): DiscoveryResult {
    // Return empty for now - can be populated with test data
    return {
        properties: [],
        zones: [],
        priceEstimates: new Map()
    };
}
