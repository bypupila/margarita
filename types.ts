// Property Types for Margarita Real Estate Platform

export enum PropertyType {
    CASA = 'CASA',
    APARTAMENTO = 'APARTAMENTO',
    TERRENO = 'TERRENO',
    LOCAL_COMERCIAL = 'LOCAL_COMERCIAL'
}

export enum PriceIndicator {
    BELOW_MARKET = 'BELOW_MARKET',  // 🟢 Good deal
    FAIR = 'FAIR',                  // 🟡 Fair price
    ABOVE_MARKET = 'ABOVE_MARKET'   // 🔴 Expensive
}

export interface Property {
    id: string;
    title: string;
    type: PropertyType;

    // Price information
    price?: number;              // USD
    pricePerM2?: number;
    currency?: string;           // "USD", "Bs", etc.
    priceIndicator?: PriceIndicator;

    // Property details
    bedrooms?: number;
    bathrooms?: number;
    areaM2?: number;
    parkingSpaces?: number;

    // Location
    latitude: number;
    longitude: number;
    coordinates?: { lat: number; lng: number };  // Alternative format for map
    address: string;
    zone: string;                // "Pampatar", "Porlamar", "Playa El Agua", etc.
    neighborhood?: string;
    area?: number;               // Alias for areaM2

    // Description
    description: string;
    features?: string[];         // ["piscina", "vista al mar", "amoblado"]

    // Instagram source
    instagramUrl: string;
    instagramId: string;
    mediaUrls: string[];         // Photos/videos from the post
    thumbnailUrl: string;
    ownerHandle: string;
    ownerName?: string;
    postedAt: string;

    // AI scoring
    qualityScore: number;        // 0-100 (AI analysis of listing quality)
    hasPhotos: boolean;
    hasPrice: boolean;
    hasLocation: boolean;
    aiConfidence: number;        // How confident AI is in extraction

    // Status
    status: 'available' | 'sold' | 'reserved';  // Estado de la propiedad
    approvalStatus?: 'pending' | 'approved' | 'rejected';  // Estado de aprobación del usuario
    isActive: boolean;
    updatedAt: string;
}

export interface Zone {
    name: string;
    displayName: string;
    avgPrice: number;            // Average price in zone (USD)
    avgPricePerM2: number;
    propertyCount: number;
    qualityScore: number;        // Average quality of properties (0-100)
    recommendationLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    coordinates: [number, number]; // Center point [lng, lat]
    bounds?: [[number, number], [number, number]]; // [[minLng, minLat], [maxLng, maxLat]]
}

export interface PriceEstimate {
    property: Property;
    estimatedPrice: number;
    pricePerM2: number;
    zonalAvgPrice: number;
    zonalAvgPricePerM2: number;
    indicator: PriceIndicator;
    confidence: number;          // 0-100
    comparableCount: number;     // How many properties were used for comparison
}

// User preferences for properties
export interface UserPropertyStatus {
    propertyId: string;
    isFavorite: boolean;
    isSavedForLater: boolean;
    wantToVisit: boolean;
    visited: boolean;
    visitedAt?: string;
    personalRating?: number;
    notes?: string;
}

// Filter options
export interface PropertyFilters {
    types: PropertyType[];
    minPrice?: number;
    maxPrice?: number;
    minBedrooms?: number;
    maxBedrooms?: number;
    minArea?: number;
    maxArea?: number;
    zones: string[];
    minQualityScore?: number;
    onlyWithPrice: boolean;
    onlyWithLocation: boolean;
}
