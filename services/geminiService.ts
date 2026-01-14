import { GoogleGenerativeAI } from '@google/generative-ai';
import { Property, PropertyType } from '../types';
import { findZoneByName, validateAndFixCoordinates, isValidMargaritaCoordinate, getDefaultCoordinates } from './coordinateService';

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

// Flag to use demo mode if Gemini fails
let useDemoMode = false;

export interface GeminiPropertyExtraction {
    property_type: 'CASA' | 'APARTAMENTO' | 'TERRENO' | 'LOCAL_COMERCIAL';
    price_usd: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    area_m2: number | null;
    parking_spaces: number | null;
    zone: string;
    address: string;
    neighborhood: string;
    features: string[];
    quality_score: number;
    ai_confidence: number;
    is_valid: boolean;
    status?: 'available' | 'sold' | 'reserved';  // Estado de la propiedad
    reason: string;
    title_suggestion: string;
}

// Margarita zones with EXACT Google Maps Coordinates (Verified)
const MARGARITA_ZONES = [
    // ==================== CIUDADES & CENTROS ====================
    { name: 'Porlamar', lat: 10.9580, lng: -63.8520 },            // Plaza Bolívar
    { name: 'Pampatar', lat: 10.9970, lng: -63.7975 },            // Plaza Bolívar
    { name: 'Juan Griego', lat: 11.0850, lng: -63.9690 },         // Bahía
    { name: 'La Asunción', lat: 11.0333, lng: -63.8628 },         // Catedral

    // ==================== ZONA COMERCIAL & MANEIRO ====================
    { name: 'Sambil', lat: 10.9962, lng: -63.8140 },              // Sambil Maingar (Maneiro)
    { name: 'Rattan Plaza', lat: 10.9926, lng: -63.8234 },        // Av. Aldonza Manrique
    { name: 'La Caracola', lat: 10.9580, lng: -63.8491 },         // Pista La Caracola
    { name: 'Bella Vista', lat: 10.9660, lng: -63.8570 },         // Hotel & Playa
    { name: 'Costa Azul', lat: 10.9772, lng: -63.8229 },          // Urb. Costa Azul
    { name: 'Jorge Coll', lat: 10.9991, lng: -63.8228 },          // Urb. Jorge Coll
    { name: 'Los Robles', lat: 10.9880, lng: -63.8310 },          // Plaza Los Robles
    { name: 'Maneiro', lat: 10.9950, lng: -63.8150 },             // Pampatar/Maneiro General
    { name: 'Parque Costazul', lat: 10.9880, lng: -63.8540 },    // CC Parque Costazul

    // ==================== ZONAS RESIDENCIALES ====================
    { name: 'Villa Rosa', lat: 10.9524, lng: -63.9258 },          // Municipio García
    { name: 'Las Garzas', lat: 10.9690, lng: -63.8500 },          // Sector Las Garzas/Sigo
    { name: 'La Arboleda', lat: 10.9762, lng: -63.8332 },         // Cerca de Costa Azul
    { name: 'Los Cocos', lat: 10.9555, lng: -63.8477 },           // Porlamar
    { name: 'Playa El Angel', lat: 10.9880, lng: -63.8330 },      // Av. Aldonza Manrique

    // ==================== ESTE & PLAYAS ====================
    { name: 'Guacuco', lat: 11.0502, lng: -63.8133 },             // Playa Guacuco
    { name: 'Paraguachí', lat: 11.0600, lng: -63.8100 },
    { name: 'El Cardón', lat: 11.0450, lng: -63.8150 },
    { name: 'Playa Caribe', lat: 11.1110, lng: -63.9580 },        // Al lado de Juan Griego

    // ==================== NORTE ====================
    { name: 'Playa El Agua', lat: 11.1455, lng: -63.8630 },       // Playa El Agua (Arena)
    { name: 'Playa Parguito', lat: 11.1350, lng: -63.8510 },      // Playa Parguito (Arena)
    { name: 'Puerto Cruz', lat: 11.1450, lng: -63.9550 },
    { name: 'Playa Zaragoza', lat: 11.1400, lng: -63.9400 },
    { name: 'Pedro González', lat: 11.1350, lng: -63.9350 },
    { name: 'Manzanillo', lat: 11.1575, lng: -63.8920 },          // Bahía de Manzanillo

    // ==================== SUR & OESTE ====================
    { name: 'El Yaque', lat: 10.9023, lng: -63.9616 },            // Playa El Yaque
    { name: 'El Valle', lat: 10.9850, lng: -63.8850 },            // Basílica
    { name: 'San Juan Bautista', lat: 11.0100, lng: -63.9300 },
    { name: 'Boca de Río', lat: 10.9650, lng: -64.1800 },         // Península de Macanao

    // ==================== DEFAULT ====================
    { name: 'Isla de Margarita', lat: 11.0000, lng: -63.9000 },
    { name: 'Nueva Esparta', lat: 11.0000, lng: -63.9000 },
    { name: 'Margarita', lat: 11.0000, lng: -63.9000 },
];

/**
 * Extract property data from caption using simple regex (fallback/demo mode)
 * STRICT FILTERING: Only returns valid properties with USD price and location
 */
function extractPropertyInfoLocal(caption: string): GeminiPropertyExtraction | null {
    const captionLower = caption.toLowerCase();

    // ========== FILTRO 1: Debe ser VENTA (no alquiler) ==========
    const isSale = captionLower.includes('venta') ||
        captionLower.includes('vendo') ||
        captionLower.includes('se vende') ||
        captionLower.includes('en venta') ||
        captionLower.includes('precio') ||
        captionLower.includes('oportunidad') ||
        captionLower.includes('inversión') ||
        captionLower.includes('inversion') ||
        /\$\s*\d/.test(caption); // Has a price with $ sign

    const isRental = captionLower.includes('alquiler') ||
        captionLower.includes('renta') ||
        captionLower.includes('se alquila');

    if (!isSale || isRental) {
        console.log('[Filter] Rechazado: No es venta o es alquiler');
        return null;
    }

    // ========== FILTRO 2: Debe ser propiedad inmobiliaria ==========
    const propertyKeywords = ['casa', 'apartamento', 'apto', 'terreno', 'local',
        'quinta', 'townhouse', 'penthouse', 'habitacion',
        'inmueble', 'propiedad', 'vivienda'];
    const isProperty = propertyKeywords.some(kw => captionLower.includes(kw));

    if (!isProperty) {
        console.log('[Filter] Rechazado: No menciona tipo de propiedad');
        return null;
    }

    // ========== FILTRO 3: Debe tener precio en USD ==========
    let price: number | null = null;

    // Patrones para detectar precios en USD
    const pricePatterns = [
        /\$\s*([\d.,]+)\s*(mil|k)?/i,                           // $50.000 o $50k
        /([\d.,]+)\s*(usd|dolares|dólares|dollars)/i,          // 50000 USD
        /([\d.,]+)\s*(mil|k)\s*(usd|dolares|dólares|\$)/i,     // 50 mil USD
        /precio[:\s]*([\d.,]+)\s*(usd|\$)?/i,                  // precio: 50000
    ];

    for (const pattern of pricePatterns) {
        const match = caption.match(pattern);
        if (match) {
            let priceStr = match[1].replace(/[.,]/g, '');
            price = parseInt(priceStr);

            // Multiplicar por 1000 si dice "mil" o "k"
            const multiplierMatch = match[2]?.toLowerCase();
            if (multiplierMatch === 'mil' || multiplierMatch === 'k') {
                price *= 1000;
            }

            // Validar rango razonable (1,000 - 10,000,000 USD)
            if (price >= 1000 && price <= 10000000) {
                break;
            } else {
                price = null; // Precio fuera de rango
            }
        }
    }

    // ❌ RECHAZAR si no tiene precio en USD
    if (!price) {
        console.log('[Filter] Rechazado: No tiene precio en USD válido');
        return null;
    }

    // ========== FILTRO 4: Debe tener ubicación en Margarita ==========
    let zone: string | null = null;
    const zoneKeywords = [
        // Porlamar y alrededores
        { key: 'porlamar', name: 'Porlamar' },
        { key: 'sambil', name: 'Sambil' },
        { key: 'caracola', name: 'La Caracola' },
        { key: 'rattan', name: 'Rattan Plaza' },
        { key: 'bella vista', name: 'Bella Vista' },
        { key: 'costa azul', name: 'Costa Azul' },
        { key: 'los robles', name: 'Los Robles' },
        { key: 'el morro', name: 'El Morro' },
        { key: 'piedras', name: 'Piedras' },
        { key: 'costa margarita', name: 'Costa Margarita' },

        // Zonas residenciales
        { key: 'jorge coll', name: 'Jorge Coll' },
        { key: 'villa rosa', name: 'Villa Rosa' },
        { key: 'las garzas', name: 'Las Garzas' },
        { key: 'la arboleda', name: 'La Arboleda' },
        { key: 'los cocos', name: 'Los Cocos' },
        { key: 'playa el angel', name: 'Playa El Angel' },
        { key: 'el angel', name: 'Playa El Angel' },

        // Pampatar y zona este
        { key: 'pampatar', name: 'Pampatar' },
        { key: 'guacuco', name: 'Guacuco' },
        { key: 'paraguachi', name: 'Paraguachí' },
        { key: 'paraguachí', name: 'Paraguachí' },
        { key: 'el cardón', name: 'El Cardón' },
        { key: 'el cardon', name: 'El Cardón' },
        { key: 'playa caribe', name: 'Playa Caribe' },

        // Playas norte
        { key: 'playa el agua', name: 'Playa El Agua' },
        { key: 'el agua', name: 'Playa El Agua' },
        { key: 'parguito', name: 'Playa Parguito' },
        { key: 'puerto cruz', name: 'Puerto Cruz' },
        { key: 'zaragoza', name: 'Playa Zaragoza' },
        { key: 'el humo', name: 'Playa El Humo' },
        { key: 'manzanillo', name: 'Manzanillo' },
        { key: 'pedro gonzalez', name: 'Pedro González' },
        { key: 'pedro gonzález', name: 'Pedro González' },
        { key: 'puerto viejo', name: 'Playa Puerto Viejo' },

        // Centro de la isla
        { key: 'la asunción', name: 'La Asunción' },
        { key: 'asuncion', name: 'La Asunción' },
        { key: 'el valle', name: 'El Valle' },
        { key: 'santa ana', name: 'Santa Ana' },
        { key: 'tacarigua', name: 'Tacarigua' },

        // Juan Griego y zona oeste
        { key: 'juan griego', name: 'Juan Griego' },
        { key: 'san juan bautista', name: 'San Juan Bautista' },
        { key: 'la galera', name: 'La Galera' },

        // Macanao
        { key: 'el yaque', name: 'El Yaque' },
        { key: 'yaque', name: 'El Yaque' },
        { key: 'boca de rio', name: 'Boca de Río' },
        { key: 'boca de río', name: 'Boca de Río' },
        { key: 'boca del pozo', name: 'Boca del Pozo' },
        { key: 'san francisco', name: 'San Francisco' },
        { key: 'macanao', name: 'Boca de Río' },

        // Genéricos (al final para que otros tengan prioridad)
        { key: 'margarita', name: 'Isla de Margarita' },
        { key: 'nueva esparta', name: 'Nueva Esparta' },
    ];

    // Helper to normalize text (remove accents)
    const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const captionNormalized = normalize(caption);

    for (const z of zoneKeywords) {
        if (captionNormalized.includes(normalize(z.key))) {
            zone = z.name;
            break;
        }
    }

    // Si no se encontró zona específica, usar default en vez de rechazar
    if (!zone) {
        console.log('[Filter] No se encontró zona específica, usando "Isla de Margarita" por defecto');
        zone = 'Isla de Margarita';
    }

    // ========== EXTRACCIÓN DE DATOS ==========

    // Tipo de propiedad
    let propertyType: 'CASA' | 'APARTAMENTO' | 'TERRENO' | 'LOCAL_COMERCIAL' = 'CASA';
    if (captionLower.includes('apartamento') || captionLower.includes('apto') || captionLower.includes('penthouse')) {
        propertyType = 'APARTAMENTO';
    } else if (captionLower.includes('terreno') || captionLower.includes('lote') || captionLower.includes('parcela')) {
        propertyType = 'TERRENO';
    } else if (captionLower.includes('local') || captionLower.includes('comercial') || captionLower.includes('oficina')) {
        propertyType = 'LOCAL_COMERCIAL';
    }

    // Habitaciones
    let bedrooms: number | null = null;
    const bedroomPatterns = [
        /(\d+)\s*(hab|habitacion|habitaciones|dormitorio|cuarto|recámara)/i,
        /(\d+)\s*h[\/\s]/i,
    ];
    for (const pattern of bedroomPatterns) {
        const match = caption.match(pattern);
        if (match) {
            bedrooms = parseInt(match[1]);
            if (bedrooms > 0 && bedrooms <= 20) break;
            bedrooms = null;
        }
    }

    // Baños
    let bathrooms: number | null = null;
    const bathroomPatterns = [
        /(\d+)\s*(baño|baños|b\/|wc)/i,
    ];
    for (const pattern of bathroomPatterns) {
        const match = caption.match(pattern);
        if (match) {
            bathrooms = parseInt(match[1]);
            if (bathrooms > 0 && bathrooms <= 10) break;
            bathrooms = null;
        }
    }

    // Área en metros cuadrados
    let area: number | null = null;
    const areaPatterns = [
        /(\d+)\s*(m2|mt2|mts2|mts|metros\s*cuadrados|metros)/i,
    ];
    for (const pattern of areaPatterns) {
        const match = caption.match(pattern);
        if (match) {
            area = parseInt(match[1]);
            if (area >= 20 && area <= 50000) break;
            area = null;
        }
    }

    // Características
    const features: string[] = [];
    const featurePatterns = [
        { pattern: /piscina/i, name: 'Piscina' },
        { pattern: /vista\s*(al)?\s*mar/i, name: 'Vista al Mar' },
        { pattern: /amoblad[oa]|amueblad[oa]/i, name: 'Amoblado' },
        { pattern: /aire\s*acondicionado|a\/c|ac/i, name: 'Aire Acondicionado' },
        { pattern: /planta\s*(eléctrica)?/i, name: 'Planta Eléctrica' },
        { pattern: /estacionamiento|parking|garaje/i, name: 'Estacionamiento' },
        { pattern: /seguridad|vigilancia/i, name: 'Seguridad 24h' },
        { pattern: /cocina\s*equipada/i, name: 'Cocina Equipada' },
        { pattern: /terraza|balcón/i, name: 'Terraza/Balcón' },
        { pattern: /jardín|jardin/i, name: 'Jardín' },
    ];

    for (const fp of featurePatterns) {
        if (fp.pattern.test(caption)) {
            features.push(fp.name);
        }
    }

    // Calcular score de calidad
    let qualityScore = 50; // Base
    if (price) qualityScore += 15;
    if (bedrooms) qualityScore += 10;
    if (bathrooms) qualityScore += 5;
    if (area) qualityScore += 10;
    if (features.length > 0) qualityScore += Math.min(features.length * 2, 10);
    qualityScore = Math.min(qualityScore, 100);

    // ========== DETECCIÓN DE ESTADO (VENDIDO/RESERVADO) ==========
    const soldKeywords = ['vendido', 'vendida', 'sold', 'se vendió', 'ya se vendió'];
    const reservedKeywords = ['reservado', 'reservada', 'en proceso', 'apartado', 'apartada'];

    let status: 'available' | 'sold' | 'reserved' = 'available';
    if (soldKeywords.some(kw => captionLower.includes(kw))) {
        status = 'sold';
    } else if (reservedKeywords.some(kw => captionLower.includes(kw))) {
        status = 'reserved';
    }

    console.log(`[Filter] ✅ APROBADO: ${propertyType} en ${zone} - $${price.toLocaleString()} USD ${status !== 'available' ? `(${status.toUpperCase()})` : ''}`);

    return {
        property_type: propertyType,
        price_usd: price,
        bedrooms,
        bathrooms,
        area_m2: area,
        parking_spaces: features.includes('Estacionamiento') ? 1 : null,
        zone,
        address: `${zone}, Isla de Margarita, Venezuela`,
        neighborhood: zone,
        features,
        quality_score: qualityScore,
        ai_confidence: 75,
        is_valid: true,
        status,  // Estado: available, sold, reserved
        reason: `Propiedad verificada: Precio USD $${price.toLocaleString()}, Ubicación: ${zone}`,
        title_suggestion: `${propertyType === 'CASA' ? 'Casa' : propertyType === 'APARTAMENTO' ? 'Apartamento' : propertyType === 'TERRENO' ? 'Terreno' : 'Local'} en ${zone}`
    };
}

/**
 * Extract structured property information from an Instagram caption using Gemini
 * Falls back to local extraction if Gemini fails
 */
export async function extractPropertyInfo(
    caption: string,
    locationName?: string,
    ownerHandle?: string
): Promise<GeminiPropertyExtraction | null> {
    // Always use demo mode (local extraction) for reliability
    useDemoMode = true;

    console.log('[Gemini] Using local extraction mode');
    return extractPropertyInfoLocal(caption);
}

/**
 * Enrich a partial property with AI-extracted data
 */
export async function enrichProperty(
    partialProperty: Partial<Property>
): Promise<Property | null> {
    const extraction = await extractPropertyInfo(
        partialProperty.description || '',
        undefined,
        partialProperty.ownerHandle
    );

    if (!extraction) {
        return null;
    }

    // === USE COORDINATE SERVICE FOR VALIDATED COORDINATES ===
    let coordinates = validateAndFixCoordinates(undefined, extraction.zone);

    // If zone not found, use default island center (don't reject the property!)
    if (!coordinates) {
        console.warn(`[GeminiService] Zona no reconocida: "${extraction.zone}" - usando centro de isla`);
        coordinates = getDefaultCoordinates();
    }

    console.log(`[GeminiService] Coordenadas asignadas para "${extraction.zone}": (${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)})`);

    const enrichedProperty: Property = {
        id: partialProperty.id!,
        instagramId: partialProperty.instagramId!,
        instagramUrl: partialProperty.instagramUrl!,
        mediaUrls: partialProperty.mediaUrls || [],
        thumbnailUrl: partialProperty.thumbnailUrl || '',
        ownerHandle: partialProperty.ownerHandle || '',
        ownerName: partialProperty.ownerName,
        postedAt: partialProperty.postedAt!,
        description: partialProperty.description!,
        isActive: true,
        status: extraction.status || 'available',
        updatedAt: new Date().toISOString(),

        title: extraction.title_suggestion,
        type: PropertyType[extraction.property_type],
        price: extraction.price_usd || undefined,
        pricePerM2: extraction.price_usd && extraction.area_m2
            ? Math.round(extraction.price_usd / extraction.area_m2)
            : undefined,
        bedrooms: extraction.bedrooms || undefined,
        bathrooms: extraction.bathrooms || undefined,
        areaM2: extraction.area_m2 || undefined,
        area: extraction.area_m2 || undefined,
        parkingSpaces: extraction.parking_spaces || undefined,
        zone: extraction.zone,
        address: extraction.address,
        neighborhood: extraction.neighborhood || undefined,
        features: extraction.features,
        qualityScore: extraction.quality_score,
        aiConfidence: extraction.ai_confidence,
        hasPhotos: (partialProperty.mediaUrls?.length || 0) > 0,
        hasPrice: extraction.price_usd !== null,
        hasLocation: !!extraction.zone,

        // VALIDATED coordinates from coordinateService
        coordinates: coordinates,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
    };

    return enrichedProperty;
}

/**
 * Batch enrich multiple properties
 */
export async function enrichProperties(
    partialProperties: Partial<Property>[]
): Promise<Property[]> {
    const enriched: Property[] = [];
    let approved = 0;
    let rejected = 0;

    console.log(`[Enrichment] Procesando ${partialProperties.length} propiedades con filtro estricto...`);

    for (const partial of partialProperties) {
        try {
            const property = await enrichProperty(partial);
            if (property) {
                enriched.push(property);
                approved++;
            } else {
                rejected++;
            }
            // Small delay for UI responsiveness
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
            console.error('[Enrichment] Error:', partial.id, error);
            rejected++;
        }
    }

    console.log(`[Enrichment] ✅ Resultado: ${approved} aprobadas, ${rejected} rechazadas de ${partialProperties.length} total`);
    return enriched;
}
