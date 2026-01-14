/**
 * Apify Instagram Property Scraper Service
 * 
 * Adapted from ReelMap to scrape real estate listings from Instagram
 * in Margarita, Venezuela
 */

import { Property, PropertyType } from '../types';

const APIFY_API_TOKEN_RAW = import.meta.env.VITE_APIFY_API_TOKEN || '';
const APIFY_API_TOKEN = APIFY_API_TOKEN_RAW.includes('token=')
    ? APIFY_API_TOKEN_RAW.split('token=')[1].split('&')[0]
    : APIFY_API_TOKEN_RAW.trim();

// Apify Actor for Instagram scraping
const ACTORS = {
    HASHTAG_SCRAPER: 'apify~instagram-hashtag-scraper',
    PROFILE_SCRAPER: 'apify~instagram-profile-scraper',
};

// Margarita-specific hashtags and keywords
export const MARGARITA_HASHTAGS = [
    'MargaritaVenezuela',
    'VentaMargarita',
    'InmuebleMargarita',
    'CasaMargarita',
    'ApartamentoMargarita',
    'VentaCasaMargarita',
    'IslaMargarita',
    'PorlamarVenezuela',
    'PampatarVenezuela',
];

export const PROPERTY_KEYWORDS = [
    'venta',
    'se vende',
    'en venta',
    'casa',
    'apartamento',
    'terreno',
    'dormitorio',
    'baño',
    'habitacion',
    'm2',
    'mts',
    'usd',
    'dolar',
    '$',
];

interface ApifypostResult {
    id?: string;
    shortCode?: string;
    code?: string;
    caption?: string;
    likesCount?: number;
    commentsCount?: number;
    timestamp?: string;
    takenAt?: string;
    displayUrl?: string;
    videoUrl?: string;
    images?: string[];
    ownerUsername?: string;
    ownerFullName?: string;
    locationName?: string;
    hashtags?: string[];
}

// Helper to check if a post is likely a property listing
const isPropertyPost = (post: ApifypostResult): boolean => {
    const caption = (post.caption || '').toLowerCase();

    // Must mention "venta" or "se vende"
    const hasSaleKeyword = caption.includes('venta') || caption.includes('se vende') || caption.includes('en venta');

    // Must mention property type or details
    const hasPropertyKeyword = PROPERTY_KEYWORDS.some(keyword => caption.includes(keyword));

    // Should not be rental (alquiler)
    const isNotRental = !caption.includes('alquiler') && !caption.includes('renta');

    return hasSaleKeyword && hasPropertyKeyword && isNotRental;
};

// Helper to extract all image URLs from a post
const extractMediaUrls = (post: ApifypostResult): string[] => {
    const urls: string[] = [];

    if (post.displayUrl) urls.push(post.displayUrl);
    if (post.videoUrl) urls.push(post.videoUrl);
    if (post.images && Array.isArray(post.images)) {
        urls.push(...post.images);
    }

    return urls.filter((url, index, self) => self.indexOf(url) === index); // Remove duplicates
};

// Convert Apify result to Property (partial - needs Gemini enrichment)
const toPartialProperty = (post: ApifypostResult): Partial<Property> => {
    const shortCode = post.shortCode || post.code || post.id || '';
    const mediaUrls = extractMediaUrls(post);

    return {
        id: `prop-${shortCode}`,
        instagramId: shortCode,
        instagramUrl: `https://www.instagram.com/p/${shortCode}/`,
        mediaUrls,
        thumbnailUrl: mediaUrls[0] || '',
        ownerHandle: post.ownerUsername ? `@${post.ownerUsername}` : '',
        ownerName: post.ownerFullName,
        postedAt: post.timestamp || post.takenAt || new Date().toISOString(),
        description: post.caption || '',
        hasPhotos: mediaUrls.length > 0,
        isActive: true,
        updatedAt: new Date().toISOString(),
    };
};

export const apifyService = {
    /**
     * Check if Apify is configured
     */
    isConfigured(): boolean {
        return !!APIFY_API_TOKEN;
    },

    /**
     * Fetch property posts by hashtag
     */
    async fetchPropertiesByHashtag(hashtag: string, limit: number = 20): Promise<ApifypostResult[]> {
        if (!APIFY_API_TOKEN) {
            console.warn('[Apify] No API token configured');
            return [];
        }

        try {
            console.log(`[Apify] Searching hashtag #${hashtag} for properties...`);

            const response = await fetch(
                `https://api.apify.com/v2/acts/${ACTORS.HASHTAG_SCRAPER}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        hashtags: [hashtag],
                        resultsLimit: limit,
                        onlyPostsNewerThan: '2024-01-01'
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Apify request failed (${response.status}): ${errorText}`);
            }

            const results: ApifypostResult[] = await response.json();

            // Filter to only property-related posts
            const propertyPosts = results.filter(isPropertyPost);

            console.log(`[Apify] Found ${results.length} posts, ${propertyPosts.length} are property listings`);
            return propertyPosts;
        } catch (error) {
            console.error('[Apify] Error fetching by hashtag:', error);
            return [];
        }
    },

    /**
     * Fetch property posts from a specific Instagram profile (realtor/agency)
     */
    async fetchPropertiesFromProfile(username: string, limit: number = 20): Promise<ApifypostResult[]> {
        if (!APIFY_API_TOKEN) {
            console.warn('[Apify] No API token configured');
            return [];
        }

        try {
            console.log(`[Apify] Fetching properties from @${username}...`);

            const response = await fetch(
                `https://api.apify.com/v2/acts/${ACTORS.PROFILE_SCRAPER}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        usernames: [username],
                        resultsLimit: limit
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Apify request failed (${response.status}): ${errorText}`);
            }

            const results: ApifypostResult[] = await response.json();
            const propertyPosts = results.filter(isPropertyPost);

            console.log(`[Apify] Found ${propertyPosts.length} property posts from @${username}`);
            return propertyPosts;
        } catch (error) {
            console.error('[Apify] Error fetching from profile:', error);
            return [];
        }
    },

    /**
     * Discover properties in Margarita using predefined hashtags
     */
    async discoverMargaritaProperties(hashtagsToSearch?: string[]): Promise<{ rawPosts: ApifypostResult[], partialProperties: Partial<Property>[] }> {
        const hashtags = hashtagsToSearch || MARGARITA_HASHTAGS.slice(0, 3); // Use top 3 by default

        const allPosts: ApifypostResult[] = [];

        for (const hashtag of hashtags) {
            const posts = await this.fetchPropertiesByHashtag(hashtag, 20);
            allPosts.push(...posts);

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // Remove duplicates based on shortCode
        const uniquePosts = allPosts.filter((post, index, self) =>
            index === self.findIndex(p => (p.shortCode || p.code) === (post.shortCode || post.code))
        );

        // Convert to partial properties (will be enriched by Gemini later)
        const partialProperties = uniquePosts.map(toPartialProperty);

        console.log(`[Apify] Discovery complete: ${uniquePosts.length} unique property posts found`);
        return { rawPosts: uniquePosts, partialProperties };
    },

    /**
     * Convert raw Apify post to partial property
     */
    convertToPartialProperty(post: ApifypostResult): Partial<Property> {
        return toPartialProperty(post);
    },

    /**
     * Get Apify account usage and limits
     */
    async getAccountUsage(): Promise<{
        totalCredits: number;
        usedCredits: number;
        remainingCredits: number;
        usagePercentage: number;
        planName: string;
    } | null> {
        if (!APIFY_API_TOKEN) {
            console.warn('[Apify] No API token configured');
            return null;
        }

        try {
            // Fetch account info
            const response = await fetch(
                `https://api.apify.com/v2/users/me?token=${APIFY_API_TOKEN}`,
                { method: 'GET' }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch account info: ${response.status}`);
            }

            const data = await response.json();

            // Get usage limits from the account data
            const plan = data.plan || {};
            const usage = data.usage || {};

            // Apify uses different fields depending on plan type
            // Free tier: monthlyUsage with usedCredits
            const totalCredits = plan.monthlyUsageCreditsUsd || plan.usageCreditsLimit || 5; // Free tier is $5/month
            const usedCredits = usage.usedCreditsUsd || usage.monthlyUsageCreditsUsd || 0;
            const remainingCredits = Math.max(0, totalCredits - usedCredits);
            const usagePercentage = totalCredits > 0 ? (usedCredits / totalCredits) * 100 : 0;

            console.log(`[Apify] Uso: $${usedCredits.toFixed(2)} / $${totalCredits.toFixed(2)} (${usagePercentage.toFixed(1)}%)`);

            return {
                totalCredits,
                usedCredits,
                remainingCredits,
                usagePercentage,
                planName: plan.name || 'Free'
            };
        } catch (error) {
            console.error('[Apify] Error fetching account usage:', error);
            return null;
        }
    }
};
