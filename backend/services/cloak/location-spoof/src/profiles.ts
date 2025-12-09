/**
 * Location Profiles - Pre-defined geographic identities
 * Includes timezone, locale, language, and GPS coordinates
 */

import type { LocationProfile } from './types.js';

// Major cities with realistic coordinates and metadata
export const LOCATION_PROFILES: Record<string, LocationProfile[]> = {
    US: [
        {
            id: 'us-nyc',
            country: 'United States',
            countryCode: 'US',
            region: 'New York',
            city: 'New York City',
            timezone: 'America/New_York',
            locale: 'en-US',
            languages: ['en-US', 'en'],
            currency: 'USD',
            geolocation: { latitude: 40.7128, longitude: -74.0060, accuracy: 100 },
        },
        {
            id: 'us-la',
            country: 'United States',
            countryCode: 'US',
            region: 'California',
            city: 'Los Angeles',
            timezone: 'America/Los_Angeles',
            locale: 'en-US',
            languages: ['en-US', 'en', 'es'],
            currency: 'USD',
            geolocation: { latitude: 34.0522, longitude: -118.2437, accuracy: 100 },
        },
        {
            id: 'us-chicago',
            country: 'United States',
            countryCode: 'US',
            region: 'Illinois',
            city: 'Chicago',
            timezone: 'America/Chicago',
            locale: 'en-US',
            languages: ['en-US', 'en'],
            currency: 'USD',
            geolocation: { latitude: 41.8781, longitude: -87.6298, accuracy: 100 },
        },
        {
            id: 'us-miami',
            country: 'United States',
            countryCode: 'US',
            region: 'Florida',
            city: 'Miami',
            timezone: 'America/New_York',
            locale: 'en-US',
            languages: ['en-US', 'en', 'es'],
            currency: 'USD',
            geolocation: { latitude: 25.7617, longitude: -80.1918, accuracy: 100 },
        },
    ],
    GB: [
        {
            id: 'gb-london',
            country: 'United Kingdom',
            countryCode: 'GB',
            region: 'England',
            city: 'London',
            timezone: 'Europe/London',
            locale: 'en-GB',
            languages: ['en-GB', 'en'],
            currency: 'GBP',
            geolocation: { latitude: 51.5074, longitude: -0.1278, accuracy: 100 },
        },
        {
            id: 'gb-manchester',
            country: 'United Kingdom',
            countryCode: 'GB',
            region: 'England',
            city: 'Manchester',
            timezone: 'Europe/London',
            locale: 'en-GB',
            languages: ['en-GB', 'en'],
            currency: 'GBP',
            geolocation: { latitude: 53.4808, longitude: -2.2426, accuracy: 100 },
        },
    ],
    DE: [
        {
            id: 'de-berlin',
            country: 'Germany',
            countryCode: 'DE',
            region: 'Berlin',
            city: 'Berlin',
            timezone: 'Europe/Berlin',
            locale: 'de-DE',
            languages: ['de-DE', 'de', 'en'],
            currency: 'EUR',
            geolocation: { latitude: 52.5200, longitude: 13.4050, accuracy: 100 },
        },
        {
            id: 'de-munich',
            country: 'Germany',
            countryCode: 'DE',
            region: 'Bavaria',
            city: 'Munich',
            timezone: 'Europe/Berlin',
            locale: 'de-DE',
            languages: ['de-DE', 'de', 'en'],
            currency: 'EUR',
            geolocation: { latitude: 48.1351, longitude: 11.5820, accuracy: 100 },
        },
    ],
    FR: [
        {
            id: 'fr-paris',
            country: 'France',
            countryCode: 'FR',
            region: 'Île-de-France',
            city: 'Paris',
            timezone: 'Europe/Paris',
            locale: 'fr-FR',
            languages: ['fr-FR', 'fr', 'en'],
            currency: 'EUR',
            geolocation: { latitude: 48.8566, longitude: 2.3522, accuracy: 100 },
        },
    ],
    JP: [
        {
            id: 'jp-tokyo',
            country: 'Japan',
            countryCode: 'JP',
            region: 'Kanto',
            city: 'Tokyo',
            timezone: 'Asia/Tokyo',
            locale: 'ja-JP',
            languages: ['ja-JP', 'ja', 'en'],
            currency: 'JPY',
            geolocation: { latitude: 35.6762, longitude: 139.6503, accuracy: 100 },
        },
        {
            id: 'jp-osaka',
            country: 'Japan',
            countryCode: 'JP',
            region: 'Kansai',
            city: 'Osaka',
            timezone: 'Asia/Tokyo',
            locale: 'ja-JP',
            languages: ['ja-JP', 'ja', 'en'],
            currency: 'JPY',
            geolocation: { latitude: 34.6937, longitude: 135.5023, accuracy: 100 },
        },
    ],
    AU: [
        {
            id: 'au-sydney',
            country: 'Australia',
            countryCode: 'AU',
            region: 'New South Wales',
            city: 'Sydney',
            timezone: 'Australia/Sydney',
            locale: 'en-AU',
            languages: ['en-AU', 'en'],
            currency: 'AUD',
            geolocation: { latitude: -33.8688, longitude: 151.2093, accuracy: 100 },
        },
        {
            id: 'au-melbourne',
            country: 'Australia',
            countryCode: 'AU',
            region: 'Victoria',
            city: 'Melbourne',
            timezone: 'Australia/Melbourne',
            locale: 'en-AU',
            languages: ['en-AU', 'en'],
            currency: 'AUD',
            geolocation: { latitude: -37.8136, longitude: 144.9631, accuracy: 100 },
        },
    ],
    CA: [
        {
            id: 'ca-toronto',
            country: 'Canada',
            countryCode: 'CA',
            region: 'Ontario',
            city: 'Toronto',
            timezone: 'America/Toronto',
            locale: 'en-CA',
            languages: ['en-CA', 'en', 'fr'],
            currency: 'CAD',
            geolocation: { latitude: 43.6532, longitude: -79.3832, accuracy: 100 },
        },
        {
            id: 'ca-vancouver',
            country: 'Canada',
            countryCode: 'CA',
            region: 'British Columbia',
            city: 'Vancouver',
            timezone: 'America/Vancouver',
            locale: 'en-CA',
            languages: ['en-CA', 'en'],
            currency: 'CAD',
            geolocation: { latitude: 49.2827, longitude: -123.1207, accuracy: 100 },
        },
    ],
    BR: [
        {
            id: 'br-saopaulo',
            country: 'Brazil',
            countryCode: 'BR',
            region: 'São Paulo',
            city: 'São Paulo',
            timezone: 'America/Sao_Paulo',
            locale: 'pt-BR',
            languages: ['pt-BR', 'pt', 'en'],
            currency: 'BRL',
            geolocation: { latitude: -23.5505, longitude: -46.6333, accuracy: 100 },
        },
    ],
    IN: [
        {
            id: 'in-mumbai',
            country: 'India',
            countryCode: 'IN',
            region: 'Maharashtra',
            city: 'Mumbai',
            timezone: 'Asia/Kolkata',
            locale: 'en-IN',
            languages: ['en-IN', 'hi-IN', 'en'],
            currency: 'INR',
            geolocation: { latitude: 19.0760, longitude: 72.8777, accuracy: 100 },
        },
    ],
    NL: [
        {
            id: 'nl-amsterdam',
            country: 'Netherlands',
            countryCode: 'NL',
            region: 'North Holland',
            city: 'Amsterdam',
            timezone: 'Europe/Amsterdam',
            locale: 'nl-NL',
            languages: ['nl-NL', 'nl', 'en'],
            currency: 'EUR',
            geolocation: { latitude: 52.3676, longitude: 4.9041, accuracy: 100 },
        },
    ],
};

/**
 * Get all available countries
 */
export function getAvailableCountries(): string[] {
    return Object.keys(LOCATION_PROFILES);
}

/**
 * Get a random location profile for a country
 */
export function getRandomLocationForCountry(countryCode: string): LocationProfile | null {
    const profiles = LOCATION_PROFILES[countryCode.toUpperCase()];
    if (!profiles || profiles.length === 0) return null;
    return profiles[Math.floor(Math.random() * profiles.length)];
}

/**
 * Get a specific location profile by ID
 */
export function getLocationById(id: string): LocationProfile | null {
    for (const profiles of Object.values(LOCATION_PROFILES)) {
        const found = profiles.find(p => p.id === id);
        if (found) return found;
    }
    return null;
}

/**
 * Get a completely random location profile
 */
export function getRandomLocation(): LocationProfile {
    const countries = Object.keys(LOCATION_PROFILES);
    const country = countries[Math.floor(Math.random() * countries.length)];
    return getRandomLocationForCountry(country)!;
}

/**
 * Add slight randomization to coordinates (within ~10km)
 */
export function randomizeCoordinates(location: LocationProfile): LocationProfile {
    const latOffset = (Math.random() - 0.5) * 0.1; // ~5.5km
    const lonOffset = (Math.random() - 0.5) * 0.1;

    return {
        ...location,
        geolocation: {
            latitude: location.geolocation.latitude + latOffset,
            longitude: location.geolocation.longitude + lonOffset,
            accuracy: 50 + Math.random() * 200, // 50-250m accuracy
        },
    };
}
