/**
 * Price Estimator Service
 * Estimates if a property price is good based on comparables
 */

import { Property, PriceEstimate, PriceIndicator, PropertyType } from '../types';

interface Comparable {
    property: Property;
    similarity: number; // 0-1
}

/**
 * Calculate similarity between two properties
 */
function calculateSimilarity(prop1: Property, prop2: Property): number {
    let score = 0;
    let weights = 0;

    // Same type (weight: 30%)
    if (prop1.type === prop2.type) {
        score += 0.3;
    }
    weights += 0.3;

    // Same zone (weight: 25%)
    if (prop1.zone === prop2.zone) {
        score += 0.25;
    }
    weights += 0.25;

    // Similar area (weight: 20%)
    if (prop1.areaM2 && prop2.areaM2) {
        const areaDiff = Math.abs(prop1.areaM2 - prop2.areaM2) / Math.max(prop1.areaM2, prop2.areaM2);
        const areaSimilarity = Math.max(0, 1 - areaDiff);
        score += areaSimilarity * 0.2;
    }
    weights += 0.2;

    // Similar bedrooms (weight: 15%)
    if (prop1.bedrooms && prop2.bedrooms) {
        if (prop1.bedrooms === prop2.bedrooms) {
            score += 0.15;
        } else if (Math.abs(prop1.bedrooms - prop2.bedrooms) === 1) {
            score += 0.075; // Half credit for 1 bedroom difference
        }
    }
    weights += 0.15;

    // Similar bathrooms (weight: 10%)
    if (prop1.bathrooms && prop2.bathrooms) {
        if (prop1.bathrooms === prop2.bathrooms) {
            score += 0.1;
        }
    }
    weights += 0.1;

    return weights > 0 ? (score / weights) : 0;
}

/**
 * Find comparable properties
 */
function findComparables(
    targetProperty: Property,
    allProperties: Property[],
    minSimilarity: number = 0.3,
    limit: number = 10
): Comparable[] {
    const comparables: Comparable[] = [];

    for (const property of allProperties) {
        // Skip the property itself
        if (property.id === targetProperty.id) continue;

        // Must have a price to be a comparable
        if (!property.price) continue;

        const similarity = calculateSimilarity(targetProperty, property);

        if (similarity >= minSimilarity) {
            comparables.push({ property, similarity });
        }
    }

    // Sort by similarity (highest first) and take top N
    comparables.sort((a, b) => b.similarity - a.similarity);
    return comparables.slice(0, limit);
}

/**
 * Calculate estimated price based on comparables
 */
function calculateEstimatedPrice(
    targetProperty: Property,
    comparables: Comparable[]
): { estimatedPrice: number; confidence: number } {
    if (comparables.length === 0) {
        return { estimatedPrice: 0, confidence: 0 };
    }

    // Weighted average based on similarity
    let totalWeight = 0;
    let weightedPriceSum = 0;

    for (const comp of comparables) {
        const weight = comp.similarity;
        weightedPriceSum += (comp.property.price || 0) * weight;
        totalWeight += weight;
    }

    const estimatedPrice = totalWeight > 0 ? weightedPriceSum / totalWeight : 0;

    // Confidence based on number and quality of comparables
    const countScore = Math.min(1, comparables.length / 10); // Max at 10 comparables
    const avgSimilarity = comparables.reduce((sum, c) => sum + c.similarity, 0) / comparables.length;
    const confidence = (countScore * 0.5 + avgSimilarity * 0.5) * 100;

    return { estimatedPrice, confidence };
}

/**
 * Determine price indicator
 */
function determinePriceIndicator(actualPrice: number, estimatedPrice: number): PriceIndicator {
    if (estimatedPrice === 0) {
        return PriceIndicator.FAIR; // No data to compare
    }

    const ratio = actualPrice / estimatedPrice;

    if (ratio <= 0.90) {
        return PriceIndicator.BELOW_MARKET; // 🟢 10%+ below market
    } else if (ratio >= 1.10) {
        return PriceIndicator.ABOVE_MARKET; // 🔴 10%+ above market
    } else {
        return PriceIndicator.FAIR; // 🟡 Within ±10%
    }
}

/**
 * Estimate price for a property
 */
export function estimatePrice(
    property: Property,
    allProperties: Property[]
): PriceEstimate | null {
    // Can only estimate if property has basic comparable data
    if (!property.type || !property.zone) {
        return null;
    }

    const comparables = findComparables(property, allProperties);

    if (comparables.length === 0) {
        console.warn(`[PriceEstimator] No comparables found for property ${property.id}`);
        return null;
    }

    const { estimatedPrice, confidence } = calculateEstimatedPrice(property, comparables);

    // Calculate zonal averages
    const zoneProperties = allProperties.filter(p =>
        p.zone === property.zone && p.price && p.id !== property.id
    );

    const zonalAvgPrice = zoneProperties.length > 0
        ? zoneProperties.reduce((sum, p) => sum + (p.price || 0), 0) / zoneProperties.length
        : 0;

    const zonePropertiesWithPricePerM2 = zoneProperties.filter(p => p.pricePerM2);
    const zonalAvgPricePerM2 = zonePropertiesWithPricePerM2.length > 0
        ? zonePropertiesWithPricePerM2.reduce((sum, p) => sum + (p.pricePerM2 || 0), 0) / zonePropertiesWithPricePerM2.length
        : 0;

    // Calculate estimated price per m2
    const pricePerM2 = property.areaM2 && estimatedPrice > 0
        ? estimatedPrice / property.areaM2
        : 0;

    // Determine indicator (only if property has a price)
    const indicator = property.price
        ? determinePriceIndicator(property.price, estimatedPrice)
        : PriceIndicator.FAIR;

    return {
        property,
        estimatedPrice,
        pricePerM2,
        zonalAvgPrice,
        zonalAvgPricePerM2,
        indicator,
        confidence,
        comparableCount: comparables.length
    };
}

/**
 * Batch estimate prices for multiple properties
 */
export function estimatePrices(properties: Property[]): Map<string, PriceEstimate> {
    const estimates = new Map<string, PriceEstimate>();

    for (const property of properties) {
        const estimate = estimatePrice(property, properties);
        if (estimate) {
            estimates.set(property.id, estimate);
        }
    }

    return estimates;
}

/**
 * Get price indicator emoji
 */
export function getPriceIndicatorEmoji(indicator: PriceIndicator): string {
    switch (indicator) {
        case PriceIndicator.BELOW_MARKET:
            return '🟢';
        case PriceIndicator.FAIR:
            return '🟡';
        case PriceIndicator.ABOVE_MARKET:
            return '🔴';
    }
}

/**
 * Get price indicator label
 */
export function getPriceIndicatorLabel(indicator: PriceIndicator): string {
    switch (indicator) {
        case PriceIndicator.BELOW_MARKET:
            return 'Buen Precio';
        case PriceIndicator.FAIR:
            return 'Precio Justo';
        case PriceIndicator.ABOVE_MARKET:
            return 'Sobre Valorado';
    }
}
