import * as XLSX from 'xlsx';
const { read, utils } = XLSX;
import { Property } from '../types';
import { enrichProperty } from './geminiService';
import { validateAndFixCoordinates } from './coordinateService';
import { geocodeAddress, isWithinMargarita } from './geocodingService';

/**
 * Service to handle file imports (CSV, Excel, JSON)
 * and convert them into properties using Gemini enrichment
 */

export interface ImportResult {
    total: number;
    success: number;
    failed: number;
    properties: Property[];
    errors: string[];
}

export const fileImportService = {
    /**
     * Parse file content into raw objects
     */
    async parseFile(file: File): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = read(data, { type: 'array' });

                    // Get first sheet
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];

                    // Convert to JSON
                    const jsonData = utils.sheet_to_json(sheet);
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Map raw row data to Partial<Property>
     * Tries to intelligently guess fields based on common column names
     */
    mapRowToPartialProperty(row: any): Partial<Property> {
        // Normalizing keys to lowercase for easier matching
        const normalizedRow: Record<string, any> = {};
        Object.keys(row).forEach(key => {
            normalizedRow[key.toLowerCase()] = row[key];
        });

        // Extract description (crucial for Gemini)
        const description =
            normalizedRow['caption'] ||
            normalizedRow['description'] ||
            normalizedRow['descripción'] ||
            normalizedRow['text'] ||
            normalizedRow['contenido'] ||
            JSON.stringify(row); // Fallback: use whole row as description

        // Extract image URL
        const imageUrl =
            normalizedRow['imageurl'] ||
            normalizedRow['image_url'] ||
            normalizedRow['displayurl'] ||
            normalizedRow['display_url'] ||
            normalizedRow['photo'] ||
            normalizedRow['foto'] ||
            '';

        // Extract URL
        const url =
            normalizedRow['posturl'] ||
            normalizedRow['post_url'] ||
            normalizedRow['url'] ||
            normalizedRow['link'] ||
            '';

        // Extract Owner
        const owner =
            normalizedRow['ownerusername'] ||
            normalizedRow['username'] ||
            normalizedRow['usuario'] ||
            normalizedRow['owner'] ||
            '';

        return {
            id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            description: String(description).slice(0, 1000), // Limit length for Gemini
            mediaUrls: imageUrl ? [imageUrl] : [],
            thumbnailUrl: imageUrl,
            instagramUrl: url,
            ownerHandle: owner ? `@${owner}` : undefined,
            postedAt: new Date().toISOString(),
            isActive: true
        };
    },

    /**
     * Process a batch of raw rows into Properties using Gemini
     */
    async processImport(rows: any[], onProgress?: (current: number, total: number) => void): Promise<ImportResult> {
        const result: ImportResult = {
            total: rows.length,
            success: 0,
            failed: 0,
            properties: [],
            errors: []
        };

        let processedCount = 0;

        // Process in sequential batches to avoid overwhelming Gemini
        for (const row of rows) {
            try {
                const partialProp = this.mapRowToPartialProperty(row);
                console.log('[FileImport] Procesando fila:', {
                    description: partialProp.description?.slice(0, 50) + '...',
                    hasImage: !!partialProp.thumbnailUrl
                });

                // Skip empty descriptions
                if (!partialProp.description || partialProp.description.length < 10) {
                    console.log('[FileImport] Saltando fila con descripción vacía o muy corta');
                    result.failed++;
                    continue;
                }

                // Enrich with Gemini
                console.log('[FileImport] Enviando a Gemini para enriquecimiento...');
                const enriched = await enrichProperty(partialProp);

                if (enriched) {
                    console.log('[FileImport] Gemini respondió:', {
                        title: enriched.title,
                        zone: enriched.zone,
                        price: enriched.price,
                        hasCoords: !!enriched.coordinates
                    });

                    // === STEP 1: Try OpenStreetMap geocoding first ===
                    console.log('[FileImport] Verificando dirección con OpenStreetMap...');
                    const osmCoords = await geocodeAddress(enriched.address || '', enriched.zone);

                    if (osmCoords && isWithinMargarita(osmCoords.lat, osmCoords.lon)) {
                        enriched.coordinates = { lat: osmCoords.lat, lng: osmCoords.lon };
                        enriched.latitude = osmCoords.lat;
                        enriched.longitude = osmCoords.lon;
                        console.log('[FileImport] ✅ Coordenadas verificadas por OpenStreetMap:', osmCoords);
                    }
                    // === STEP 2: Fallback to local zone database ===
                    else if (!enriched.coordinates) {
                        console.log('[FileImport] OSM no encontró, usando base de datos local para zona:', enriched.zone);
                        const fixed = validateAndFixCoordinates(undefined, enriched.zone);
                        if (fixed) {
                            enriched.coordinates = fixed;
                            enriched.latitude = fixed.lat;
                            enriched.longitude = fixed.lng;
                            console.log('[FileImport] Coordenadas asignadas desde BD local:', fixed);
                        }
                    }

                    // === STEP 3: Final validation ===
                    if (enriched.coordinates && isWithinMargarita(enriched.coordinates.lat, enriched.coordinates.lng)) {
                        // Mark as pending for user approval
                        enriched.approvalStatus = 'pending';
                        result.properties.push(enriched);
                        result.success++;
                        console.log('[FileImport] ✅ Propiedad agregada (pendiente de aprobación)');
                    } else {
                        result.failed++;
                        result.errors.push(`Coordenadas inválidas para: ${enriched.title}`);
                        console.log('[FileImport] ❌ Coordenadas fuera de Margarita, rechazada');
                    }
                } else {
                    result.failed++;
                    result.errors.push(`Gemini no pudo procesar: ${partialProp.description?.slice(0, 30)}...`);
                    console.log('[FileImport] ❌ Gemini retornó null');
                }

            } catch (error) {
                console.error('Error importing row:', error);
                result.failed++;
                result.errors.push(`Error procesando fila: ${error}`);
            }

            processedCount++;
            if (onProgress) onProgress(processedCount, result.total);

            // Small delay between items
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return result;
    }
};
