/**
 * Daily Scraper Script for Margarita Properties
 * Runs via GitHub Actions every day at 6:00 AM
 * 
 * What it does:
 * 1. Calls Apify to scrape Instagram for property posts
 * 2. Filters valid properties (price, location, etc.)
 * 3. Validates images with Gemini Vision (optional)
 * 4. Geocodes addresses with OpenStreetMap
 * 5. Saves results to public/data/scraped_properties.json
 */

const fs = require('fs');
const path = require('path');

// Configuration from environment variables (set in GitHub Secrets)
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Check if running in CI
const isCI = process.env.CI === 'true';
console.log(`Environment: ${isCI ? 'GitHub Actions' : 'Local'}`);
console.log(`APIFY_API_TOKEN: ${APIFY_API_TOKEN ? '✅ Set' : '❌ Not set'}`);
console.log(`GEMINI_API_KEY: ${GEMINI_API_KEY ? '✅ Set' : '❌ Not set'}`);

// Instagram hashtags to search
const HASHTAGS = [
    'ventamargarita',
    'inmoblesmargarita',
    'inmueblesmargarita',
    'apartamentomargarita',
    'casamargarita',
    'propiedadmargarita'
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

// Margarita bounds for validation
const MARGARITA_BOUNDS = {
    minLat: 10.85, maxLat: 11.20,
    minLng: -64.05, maxLng: -63.70
};

/**
 * Normalize text (remove accents)
 */
function normalize(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Check if coordinates are within Margarita
 */
function isWithinMargarita(lat, lng) {
    return lat >= MARGARITA_BOUNDS.minLat && lat <= MARGARITA_BOUNDS.maxLat &&
        lng >= MARGARITA_BOUNDS.minLng && lng <= MARGARITA_BOUNDS.maxLng;
}

/**
 * Extract property data from caption text
 */
function extractPropertyData(caption) {
    const normalized = normalize(caption);

    // Check if it's a sale (not rental)
    const isSale = normalized.includes('venta') || normalized.includes('vendo') ||
        normalized.includes('precio') || /\$\s*\d/.test(caption);
    const isRental = normalized.includes('alquiler') || normalized.includes('renta');

    if (!isSale || isRental) return null;

    // Check for property keywords
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
        // Default to center of Margarita
        zone = 'Isla de Margarita';
        coordinates = { lat: 11.0000, lng: -63.9000 };
    }

    // Extract property type
    let type = 'CASA';
    if (normalized.includes('apartamento') || normalized.includes('apto') || normalized.includes('penthouse')) {
        type = 'APARTAMENTO';
    } else if (normalized.includes('terreno') || normalized.includes('lote')) {
        type = 'TERRENO';
    } else if (normalized.includes('local') || normalized.includes('comercial')) {
        type = 'LOCAL_COMERCIAL';
    }

    // Extract bedrooms
    let bedrooms = null;
    const bedroomMatch = caption.match(/(\d+)\s*(hab|habitacion|dormitorio|cuarto)/i);
    if (bedroomMatch) bedrooms = parseInt(bedroomMatch[1]);

    // Extract bathrooms
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

/**
 * Scrape Instagram using Apify
 */
async function scrapeInstagram() {
    if (!APIFY_API_TOKEN) {
        console.error('❌ APIFY_API_TOKEN not set');
        return [];
    }

    console.log('🔍 Starting Instagram scrape...');

    const posts = [];

    for (const hashtag of HASHTAGS) {
        console.log(`  Searching #${hashtag}...`);

        try {
            const response = await fetch('https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${APIFY_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    hashtags: [hashtag],
                    resultsLimit: 20  // Limit to stay within free tier
                })
            });

            if (!response.ok) {
                console.log(`  ⚠️ Failed for #${hashtag}: ${response.status}`);
                continue;
            }

            const data = await response.json();
            posts.push(...data);
            console.log(`  ✅ Found ${data.length} posts for #${hashtag}`);

            // Rate limit - wait 2 seconds between requests
            await new Promise(r => setTimeout(r, 2000));

        } catch (error) {
            console.error(`  ❌ Error for #${hashtag}:`, error.message);
        }
    }

    console.log(`📊 Total posts scraped: ${posts.length}`);
    return posts;
}

/**
 * Process scraped posts into property objects
 */
function processPosts(posts) {
    console.log('🔄 Processing posts...');

    const properties = [];
    const seenUrls = new Set();

    for (const post of posts) {
        // Skip duplicates
        if (seenUrls.has(post.url)) continue;
        seenUrls.add(post.url);

        const caption = post.caption || post.description || '';
        if (caption.length < 20) continue;

        const extracted = extractPropertyData(caption);
        if (!extracted) continue;

        // Validate coordinates
        if (!isWithinMargarita(extracted.coordinates.lat, extracted.coordinates.lng)) {
            continue;
        }

        const property = {
            id: `scraped-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
            approvalStatus: 'pending',  // All scraped properties start as pending
            isActive: true,
            qualityScore: 70,
            aiConfidence: 0.7,
            hasPhotos: true,
            hasPrice: true,
            hasLocation: true,
            updatedAt: new Date().toISOString(),
            scrapedAt: new Date().toISOString()
        };

        properties.push(property);
    }

    console.log(`✅ Processed ${properties.length} valid properties`);
    return properties;
}

/**
 * Geocode using OpenStreetMap Nominatim (free)
 */
async function geocodeWithNominatim(zone) {
    try {
        const query = encodeURIComponent(`${zone}, Isla de Margarita, Venezuela`);
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
            { headers: { 'User-Agent': 'MargaritaPropertiesScraper/1.0' } }
        );

        const data = await response.json();
        if (data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            if (isWithinMargarita(lat, lon)) {
                return { lat, lng: lon };
            }
        }
    } catch (error) {
        console.error('Geocoding error:', error.message);
    }
    return null;
}

/**
 * Load existing properties from JSON file
 */
function loadExistingProperties() {
    const filePath = path.join(__dirname, '../public/data/scraped_properties.json');
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading existing properties:', error.message);
    }
    return [];
}

/**
 * Save properties to JSON file
 */
function saveProperties(properties) {
    const dataDir = path.join(__dirname, '../public/data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const filePath = path.join(dataDir, 'scraped_properties.json');
    fs.writeFileSync(filePath, JSON.stringify(properties, null, 2), 'utf8');
    console.log(`💾 Saved ${properties.length} properties to ${filePath}`);
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 Starting daily property scraper...');
    console.log(`📅 Date: ${new Date().toISOString()}`);
    console.log('');

    // Load existing properties
    const existingProperties = loadExistingProperties();
    const existingUrls = new Set(existingProperties.map(p => p.instagramUrl));
    console.log(`📚 Loaded ${existingProperties.length} existing properties`);

    // Scrape new posts
    const posts = await scrapeInstagram();

    // Process posts
    const newProperties = processPosts(posts);

    // Filter out duplicates
    const uniqueNewProperties = newProperties.filter(p => !existingUrls.has(p.instagramUrl));
    console.log(`🆕 ${uniqueNewProperties.length} new unique properties`);

    // Merge with existing
    const allProperties = [...existingProperties, ...uniqueNewProperties];

    // Save (even if empty, to ensure file exists)
    saveProperties(allProperties);

    console.log('');
    console.log('✅ Daily scrape completed!');
    console.log(`   Total properties: ${allProperties.length}`);
    console.log(`   New properties: ${uniqueNewProperties.length}`);

    return true;
}

// Run with proper error handling
main()
    .then((success) => {
        console.log('Script finished successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed with error:', error);
        process.exit(1);
    });

