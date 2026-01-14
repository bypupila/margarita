/**
 * Daily Scraper Script for Margarita Properties
 * Runs via GitHub Actions every day at 6:00 AM
 * 
 * DATA SOURCES (in priority order):
 * 1. CSV files in public/data/pending/ folder (FREE - manual upload)
 * 2. Apify Instagram scraper (when credits available)
 * 
 * Output: public/data/scraped_properties.json
 */

const fs = require('fs');
const path = require('path');

// Configuration from environment variables (set in GitHub Secrets)
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Paths
const PENDING_FOLDER = path.join(__dirname, '../public/data/pending');
const OUTPUT_FILE = path.join(__dirname, '../public/data/scraped_properties.json');
const PROCESSED_FOLDER = path.join(__dirname, '../public/data/processed');

// Check environment
const isCI = process.env.CI === 'true';
console.log(`Environment: ${isCI ? 'GitHub Actions' : 'Local'}`);
console.log(`APIFY_API_TOKEN: ${APIFY_API_TOKEN ? '✅ Set' : '❌ Not set (will use CSV files only)'}`);

// Instagram hashtags to search (only used if Apify is available)
const HASHTAGS = [
    'ventamargarita',
    'inmueblesmargarita',
    'apartamentomargarita',
    'casamargarita'
];

// Known zones in Margarita with coordinates [lat, lng]
const MARGARITA_ZONES = {
    'porlamar': { name: 'Porlamar', lat: 10.9580, lng: -63.8520 },
    'pampatar': { name: 'Pampatar', lat: 10.9970, lng: -63.7975 },
    'juan griego': { name: 'Juan Griego', lat: 11.0850, lng: -63.9690 },
    'la asuncion': { name: 'La Asunción', lat: 11.0333, lng: -63.8628 },
    'playa el agua': { name: 'Playa El Agua', lat: 11.1455, lng: -63.8630 },
    'el yaque': { name: 'El Yaque', lat: 10.9023, lng: -63.9616 },
    'costa azul': { name: 'Costa Azul', lat: 10.9772, lng: -63.8229 },
    'jorge coll': { name: 'Jorge Coll', lat: 10.9991, lng: -63.8228 },
    'bella vista': { name: 'Bella Vista', lat: 10.9660, lng: -63.8570 },
    'la caracola': { name: 'La Caracola', lat: 10.9580, lng: -63.8491 },
    'los robles': { name: 'Los Robles', lat: 10.9880, lng: -63.8310 },
    'el valle': { name: 'El Valle', lat: 10.9850, lng: -63.8850 },
    'guacuco': { name: 'Guacuco', lat: 11.0502, lng: -63.8133 },
    'playa el angel': { name: 'Playa El Angel', lat: 10.9880, lng: -63.8330 },
    'manzanillo': { name: 'Manzanillo', lat: 11.1575, lng: -63.8920 },
};

const MARGARITA_BOUNDS = {
    minLat: 10.85, maxLat: 11.20,
    minLng: -64.05, maxLng: -63.70
};

// ============= UTILITY FUNCTIONS =============

function normalize(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isWithinMargarita(lat, lng) {
    return lat >= MARGARITA_BOUNDS.minLat && lat <= MARGARITA_BOUNDS.maxLat &&
        lng >= MARGARITA_BOUNDS.minLng && lng <= MARGARITA_BOUNDS.maxLng;
}

function extractPropertyData(caption) {
    const normalized = normalize(caption);

    const isSale = normalized.includes('venta') || normalized.includes('vendo') ||
        normalized.includes('precio') || normalized.includes('oportunidad') || /\$\s*\d/.test(caption);
    const isRental = normalized.includes('alquiler') || normalized.includes('renta');

    if (!isSale || isRental) return null;

    const propertyKeywords = ['casa', 'apartamento', 'apto', 'terreno', 'local',
        'quinta', 'townhouse', 'penthouse', 'habitacion'];
    const isProperty = propertyKeywords.some(kw => normalized.includes(kw));

    if (!isProperty) return null;

    // Extract price
    let price = null;
    const pricePatterns = [
        /\$\s*([\d.,]+)\s*(mil|k)?/i,
        /([\d.,]+)\s*(usd|dolares|dólares)/i,
        /precio[:\s]*([\d.,]+)/i
    ];

    for (const pattern of pricePatterns) {
        const match = caption.match(pattern);
        if (match) {
            let priceStr = match[1].replace(/[.,]/g, '');
            price = parseInt(priceStr);
            if (match[2] && (match[2].toLowerCase() === 'mil' || match[2].toLowerCase() === 'k')) {
                price *= 1000;
            }
            if (price >= 1000 && price <= 10000000) break;
            price = null;
        }
    }

    if (!price) return null;

    // Extract zone
    let zone = null;
    let coordinates = null;

    for (const [key, data] of Object.entries(MARGARITA_ZONES)) {
        if (normalized.includes(normalize(key))) {
            zone = data.name;
            coordinates = { lat: data.lat, lng: data.lng };
            break;
        }
    }

    if (!zone) {
        zone = 'Isla de Margarita';
        coordinates = { lat: 11.0000, lng: -63.9000 };
    }

    // Extract type
    let type = 'CASA';
    if (normalized.includes('apartamento') || normalized.includes('apto') || normalized.includes('penthouse')) {
        type = 'APARTAMENTO';
    } else if (normalized.includes('terreno') || normalized.includes('lote')) {
        type = 'TERRENO';
    } else if (normalized.includes('local') || normalized.includes('comercial')) {
        type = 'LOCAL_COMERCIAL';
    }

    // Extract details
    let bedrooms = null;
    const bedroomMatch = caption.match(/(\d+)\s*(hab|habitacion|dormitorio|cuarto)/i);
    if (bedroomMatch) bedrooms = parseInt(bedroomMatch[1]);

    let bathrooms = null;
    const bathroomMatch = caption.match(/(\d+)\s*(baño|bath)/i);
    if (bathroomMatch) bathrooms = parseInt(bathroomMatch[1]);

    return {
        type,
        price,
        zone,
        coordinates,
        bedrooms,
        bathrooms,
        title: `${type === 'APARTAMENTO' ? 'Apartamento' : type === 'TERRENO' ? 'Terreno' : type === 'LOCAL_COMERCIAL' ? 'Local' : 'Casa'} en ${zone} - $${price.toLocaleString()}`
    };
}

// ============= SOURCE 1: CSV FILES (FREE) =============

function parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        // Simple CSV parsing (handles quoted values)
        const values = [];
        let current = '';
        let inQuotes = false;

        for (const char of lines[i]) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        rows.push(row);
    }

    return rows;
}

function loadCSVFiles() {
    console.log('📂 Looking for CSV files in pending folder...');

    // Create folders if they don't exist
    if (!fs.existsSync(PENDING_FOLDER)) {
        fs.mkdirSync(PENDING_FOLDER, { recursive: true });
        console.log('   Created pending folder: ' + PENDING_FOLDER);
    }
    if (!fs.existsSync(PROCESSED_FOLDER)) {
        fs.mkdirSync(PROCESSED_FOLDER, { recursive: true });
    }

    const files = fs.readdirSync(PENDING_FOLDER).filter(f => f.endsWith('.csv'));

    if (files.length === 0) {
        console.log('   No CSV files found in pending folder');
        return [];
    }

    console.log(`   Found ${files.length} CSV file(s)`);

    const allRows = [];

    for (const file of files) {
        const filePath = path.join(PENDING_FOLDER, file);
        console.log(`   Processing: ${file}`);

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const rows = parseCSV(content);

            // Add source info
            rows.forEach(row => {
                row._sourceFile = file;
            });

            allRows.push(...rows);
            console.log(`   ✅ ${rows.length} rows from ${file}`);

            // Move to processed folder
            const processedPath = path.join(PROCESSED_FOLDER, `${Date.now()}_${file}`);
            fs.renameSync(filePath, processedPath);
            console.log(`   📦 Moved to processed folder`);

        } catch (error) {
            console.error(`   ❌ Error reading ${file}:`, error.message);
        }
    }

    return allRows;
}

function processCSVRows(rows) {
    console.log('🔄 Processing CSV data...');
    const properties = [];

    for (const row of rows) {
        const description = row.description || row.descripcion || row.caption || '';
        if (description.length < 20) continue;

        const extracted = extractPropertyData(description);
        if (!extracted) {
            console.log(`   ⚠️ Skipped: No valid data in "${description.slice(0, 40)}..."`);
            continue;
        }

        const property = {
            id: `csv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: extracted.title,
            type: extracted.type,
            price: extracted.price,
            bedrooms: extracted.bedrooms,
            bathrooms: extracted.bathrooms,
            zone: extracted.zone,
            address: extracted.zone,
            description: description,
            latitude: extracted.coordinates.lat,
            longitude: extracted.coordinates.lng,
            coordinates: extracted.coordinates,
            instagramUrl: row.url || row.instagram_url || row.link || '',
            instagramId: '',
            thumbnailUrl: row.image_url || row.imagen || row.thumbnail || '',
            mediaUrls: [row.image_url || row.imagen || ''].filter(Boolean),
            ownerHandle: row.owner || row.vendedor || row.account || '',
            postedAt: new Date().toISOString(),
            status: 'available',
            approvalStatus: 'pending',
            isActive: true,
            qualityScore: 70,
            aiConfidence: 0.7,
            hasPhotos: !!(row.image_url || row.imagen),
            hasPrice: true,
            hasLocation: true,
            updatedAt: new Date().toISOString(),
            scrapedAt: new Date().toISOString(),
            source: 'csv'
        };

        properties.push(property);
    }

    console.log(`   ✅ ${properties.length} valid properties from CSV`);
    return properties;
}

// ============= SOURCE 2: APIFY (OPTIONAL) =============

async function scrapeInstagram() {
    if (!APIFY_API_TOKEN) {
        console.log('ℹ️ Apify not configured - skipping Instagram scrape');
        return [];
    }

    console.log('🔍 Starting Instagram scrape with Apify...');
    const posts = [];

    for (const hashtag of HASHTAGS.slice(0, 2)) { // Limit hashtags to save credits
        console.log(`   Searching #${hashtag}...`);

        try {
            const response = await fetch('https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${APIFY_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    hashtags: [hashtag],
                    resultsLimit: 10  // Minimal to save credits
                })
            });

            if (!response.ok) {
                console.log(`   ⚠️ Failed: ${response.status}`);
                continue;
            }

            const data = await response.json();
            posts.push(...data);
            console.log(`   ✅ Found ${data.length} posts`);

            await new Promise(r => setTimeout(r, 2000));

        } catch (error) {
            console.error(`   ❌ Error:`, error.message);
        }
    }

    return posts;
}

function processApifyPosts(posts) {
    console.log('🔄 Processing Apify data...');
    const properties = [];
    const seenUrls = new Set();

    for (const post of posts) {
        if (seenUrls.has(post.url)) continue;
        seenUrls.add(post.url);

        const caption = post.caption || post.description || '';
        if (caption.length < 20) continue;

        const extracted = extractPropertyData(caption);
        if (!extracted) continue;

        if (!isWithinMargarita(extracted.coordinates.lat, extracted.coordinates.lng)) continue;

        const property = {
            id: `apify-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: extracted.title,
            type: extracted.type,
            price: extracted.price,
            bedrooms: extracted.bedrooms,
            bathrooms: extracted.bathrooms,
            zone: extracted.zone,
            address: extracted.zone,
            description: caption,
            latitude: extracted.coordinates.lat,
            longitude: extracted.coordinates.lng,
            coordinates: extracted.coordinates,
            instagramUrl: post.url || '',
            instagramId: post.id || '',
            thumbnailUrl: post.displayUrl || post.thumbnailUrl || '',
            mediaUrls: post.images || [post.displayUrl].filter(Boolean),
            ownerHandle: post.ownerUsername ? `@${post.ownerUsername}` : '',
            postedAt: post.timestamp || new Date().toISOString(),
            status: 'available',
            approvalStatus: 'pending',
            isActive: true,
            qualityScore: 70,
            aiConfidence: 0.7,
            hasPhotos: true,
            hasPrice: true,
            hasLocation: true,
            updatedAt: new Date().toISOString(),
            scrapedAt: new Date().toISOString(),
            source: 'apify'
        };

        properties.push(property);
    }

    console.log(`   ✅ ${properties.length} valid properties from Apify`);
    return properties;
}

// ============= MAIN =============

function loadExistingProperties() {
    try {
        if (fs.existsSync(OUTPUT_FILE)) {
            const data = fs.readFileSync(OUTPUT_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading existing properties:', error.message);
    }
    return [];
}

function saveProperties(properties) {
    const dataDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(properties, null, 2), 'utf8');
    console.log(`💾 Saved ${properties.length} properties`);
}

async function main() {
    console.log('');
    console.log('🚀 ========================================');
    console.log('   MARGARITA PROPERTIES - DAILY SCRAPER');
    console.log('   ' + new Date().toISOString());
    console.log('==========================================');
    console.log('');

    // Load existing
    const existingProperties = loadExistingProperties();
    const existingIds = new Set(existingProperties.map(p => p.instagramUrl || p.id));
    console.log(`📚 Existing properties: ${existingProperties.length}`);
    console.log('');

    let newProperties = [];

    // SOURCE 1: CSV files (FREE - always check first)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 SOURCE 1: CSV FILES (FREE)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const csvRows = loadCSVFiles();
    if (csvRows.length > 0) {
        const csvProperties = processCSVRows(csvRows);
        newProperties.push(...csvProperties);
    }
    console.log('');

    // SOURCE 2: Apify (only if token available)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 SOURCE 2: APIFY INSTAGRAM (OPTIONAL)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const apifyPosts = await scrapeInstagram();
    if (apifyPosts.length > 0) {
        const apifyProperties = processApifyPosts(apifyPosts);
        newProperties.push(...apifyProperties);
    }
    console.log('');

    // Filter duplicates
    const uniqueNew = newProperties.filter(p => {
        const key = p.instagramUrl || p.id;
        return !existingIds.has(key);
    });

    // Merge
    const allProperties = [...existingProperties, ...uniqueNew];

    // Save
    saveProperties(allProperties);

    // Summary
    console.log('');
    console.log('✅ ========================================');
    console.log('   SCRAPE COMPLETED!');
    console.log('==========================================');
    console.log(`   📊 Total properties: ${allProperties.length}`);
    console.log(`   🆕 New this run: ${uniqueNew.length}`);
    console.log(`      - From CSV: ${uniqueNew.filter(p => p.source === 'csv').length}`);
    console.log(`      - From Apify: ${uniqueNew.filter(p => p.source === 'apify').length}`);
    console.log('');

    return true;
}

// Run
main()
    .then(() => {
        console.log('Script finished successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
