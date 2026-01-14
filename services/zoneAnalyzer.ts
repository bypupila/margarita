/**
 * Zone Analyzer Service
 * Analyzes property clusters to identify best zones in Margarita
 */

import { Property, Zone, PropertyType } from '../types';

interface ZoneStats {
    properties: Property[];
    totalPrice: number;
    totalArea: number;
    totalQuality: number;
    coordinates: number[][];
}

/**
 * Group properties by zone
 */
export function groupPropertiesByZone(properties: Property[]): Record<string, Property[]> {
    const groups: Record<string, Property[]> = {};

    for (const property of properties) {
        if (!property.zone) continue;

        const zone = property.zone.trim();
        if (!groups[zone]) {
            groups[zone] = [];
        }
        groups[zone].push(property);
    }

    return groups;
}

/**
 * Calculate zone statistics
 */
function calculateZoneStats(properties: Property[]): ZoneStats {
    const stats: ZoneStats = {
        properties,
        totalPrice: 0,
        totalArea: 0,
        totalQuality: 0,
        coordinates: []
    };

    let priceCount = 0;
    let areaCount = 0;

    for (const property of properties) {
        if (property.price) {
            stats.totalPrice += property.price;
            priceCount++;
        }

        if (property.areaM2) {
            stats.totalArea += property.areaM2;
            areaCount++;
        }

        stats.totalQuality += property.qualityScore;
        stats.coordinates.push([property.longitude, property.latitude]);
    }

    return stats;
}

/**
 * Calculate center point of a zone
 */
function calculateZoneCenter(coordinates: number[][]): [number, number] {
    if (coordinates.length === 0) {
        return [-63.85, 11.00]; // Default: center of Margarita
    }

    const sumLon = coordinates.reduce((sum, coord) => sum + coord[0], 0);
    const sumLat = coordinates.reduce((sum, coord) => sum + coord[1], 0);

    return [
        sumLon / coordinates.length,
        sumLat / coordinates.length
    ];
}

/**
 * Determine recommendation level for a zone
 */
function getRecommendationLevel(
    avgPrice: number,
    avgPricePerM2: number,
    avgQuality: number,
    propertyCount: number,
    allZones: Zone[]
): 'HIGH' | 'MEDIUM' | 'LOW' {
    // Calculate market average
    const marketAvgPrice = allZones.reduce((sum, z) => sum + z.avgPricePerM2, 0) / allZones.length;
    const marketAvgQuality = allZones.reduce((sum, z) => sum + z.qualityScore, 0) / allZones.length;

    // Score components (0-100 each)
    const priceScore = avgPricePerM2 > 0 && avgPricePerM2 < marketAvgPrice * 1.1
        ? 70
        : avgPricePerM2 < marketAvgPrice * 0.9
            ? 100
            : 40;

    const qualityScore = (avgQuality / 100) * 100;

    const densityScore = Math.min(100, (propertyCount / 10) * 100); // 10+ properties = max score

    // Combined score
    const totalScore = (priceScore * 0.4) + (qualityScore * 0.4) + (densityScore * 0.2);

    if (totalScore >= 70) return 'HIGH';
    if (totalScore >= 45) return 'MEDIUM';
    return 'LOW';
}

/**
 * Analyze all zones and generate Zone objects
 */
export function analyzeZones(properties: Property[]): Zone[] {
    const grouped = groupPropertiesByZone(properties);
    const zones: Zone[] = [];

    // First pass: calculate basic stats for each zone
    for (const [zoneName, zoneProperties] of Object.entries(grouped)) {
        if (zoneProperties.length === 0) continue;

        const stats = calculateZoneStats(zoneProperties);

        // Calculate averages
        const propertiesWithPrice = zoneProperties.filter(p => p.price);
        const propertiesWithArea = zoneProperties.filter(p => p.areaM2);
        const propertiesWithPricePerM2 = zoneProperties.filter(p => p.pricePerM2);

        const avgPrice = propertiesWithPrice.length > 0
            ? stats.totalPrice / propertiesWithPrice.length
            : 0;

        const avgPricePerM2 = propertiesWithPricePerM2.length > 0
            ? propertiesWithPricePerM2.reduce((sum, p) => sum + (p.pricePerM2 || 0), 0) / propertiesWithPricePerM2.length
            : 0;

        const avgQuality = stats.totalQuality / zoneProperties.length;

        const center = calculateZoneCenter(stats.coordinates);

        zones.push({
            name: zoneName,
            displayName: zoneName,
            avgPrice,
            avgPricePerM2,
            propertyCount: zoneProperties.length,
            qualityScore: avgQuality,
            recommendationLevel: 'MEDIUM', // Will be updated in second pass
            coordinates: center
        });
    }

    // Second pass: assign recommendation levels based on comparative analysis
    for (const zone of zones) {
        zone.recommendationLevel = getRecommendationLevel(
            zone.avgPrice,
            zone.avgPricePerM2,
            zone.qualityScore,
            zone.propertyCount,
            zones
        );
    }

    // Sort by recommendation level and quality
    zones.sort((a, b) => {
        const levelScore = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        const levelDiff = levelScore[b.recommendationLevel] - levelScore[a.recommendationLevel];
        if (levelDiff !== 0) return levelDiff;
        return b.qualityScore - a.qualityScore;
    });

    return zones;
}

/**
 * Get top recommended zones
 */
export function getTopZones(zones: Zone[], limit: number = 5): Zone[] {
    return zones
        .filter(z => z.recommendationLevel === 'HIGH')
        .slice(0, limit);
}

/**
 * Find zone by name
 */
export function findZone(zones: Zone[], zoneName: string): Zone | undefined {
    return zones.find(z =>
        z.name.toLowerCase() === zoneName.toLowerCase() ||
        z.displayName.toLowerCase() === zoneName.toLowerCase()
    );
}

/**
 * Get zone summary statistics
 */
export function getZoneSummary(zone: Zone): string {
    const parts: string[] = [];

    if (zone.avgPrice > 0) {
        parts.push(`Precio promedio: $${zone.avgPrice.toLocaleString('es-VE', { maximumFractionDigits: 0 })}`);
    }

    if (zone.avgPricePerM2 > 0) {
        parts.push(`$${zone.avgPricePerM2.toLocaleString('es-VE', { maximumFractionDigits: 0 })}/m²`);
    }

    parts.push(`${zone.propertyCount} ${zone.propertyCount === 1 ? 'propiedad' : 'propiedades'}`);

    parts.push(`Calidad: ${Math.round(zone.qualityScore)}/100`);

    const emoji = {
        HIGH: '🟢',
        MEDIUM: '🟡',
        LOW: '🔴'
    };

    parts.push(`${emoji[zone.recommendationLevel]} ${zone.recommendationLevel === 'HIGH' ? 'Recomendado' : zone.recommendationLevel === 'MEDIUM' ? 'Promedio' : 'Evaluar'}`);

    return parts.join(' • ');
}
