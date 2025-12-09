/**
 * Location Spoofer - Main implementation
 * Spoofs timezone, locale, language, and geolocation
 */

import { BrowserContext, Page } from 'playwright';
import pino from 'pino';
import type { LocationProfile, LocationSpoofConfig, GeoLocation } from './types.js';
import {
    getRandomLocation,
    getRandomLocationForCountry,
    getLocationById,
    randomizeCoordinates,
} from './profiles.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class LocationSpoofer {
    private config: LocationSpoofConfig;
    private currentLocation?: LocationProfile;

    constructor(config: Partial<LocationSpoofConfig> = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            country: config.country,
            randomizeWithinCountry: config.randomizeWithinCountry ?? true,
            spoofTimezone: config.spoofTimezone ?? true,
            spoofLocale: config.spoofLocale ?? true,
            spoofGeolocation: config.spoofGeolocation ?? true,
            blockGeolocationPrompts: config.blockGeolocationPrompts ?? false,
        };
    }

    /**
     * Generate a location profile
     */
    generateLocation(country?: string): LocationProfile {
        let location: LocationProfile;

        if (country) {
            const profile = getRandomLocationForCountry(country);
            if (profile) {
                location = profile;
            } else {
                logger.warn({ country }, 'Country not found, using random location');
                location = getRandomLocation();
            }
        } else if (this.config.country) {
            const profile = getRandomLocationForCountry(this.config.country);
            if (profile) {
                location = profile;
            } else {
                location = getRandomLocation();
            }
        } else {
            location = getRandomLocation();
        }

        // Add slight randomization to coordinates
        if (this.config.randomizeWithinCountry) {
            location = randomizeCoordinates(location);
        }

        this.currentLocation = location;
        logger.info({ location: location.city, country: location.countryCode }, 'Generated location');
        return location;
    }

    /**
     * Get browser context options for location
     */
    getContextOptions(location?: LocationProfile): {
        locale?: string;
        timezoneId?: string;
        geolocation?: GeoLocation;
        permissions?: string[];
    } {
        const loc = location || this.currentLocation || this.generateLocation();
        const options: any = {};

        if (this.config.spoofLocale) {
            options.locale = loc.locale;
        }

        if (this.config.spoofTimezone) {
            options.timezoneId = loc.timezone;
        }

        if (this.config.spoofGeolocation) {
            options.geolocation = loc.geolocation;
            options.permissions = ['geolocation'];
        }

        return options;
    }

    /**
     * Get Chrome launch args for location spoofing
     */
    getLaunchArgs(location?: LocationProfile): string[] {
        const loc = location || this.currentLocation || this.generateLocation();
        const args: string[] = [];

        if (this.config.spoofTimezone) {
            args.push(`--timezone=${loc.timezone}`);
        }

        if (this.config.spoofLocale) {
            args.push(`--lang=${loc.locale}`);
        }

        return args;
    }

    /**
     * Get injection script for runtime location spoofing
     */
    getInjectionScript(location?: LocationProfile): string {
        const loc = location || this.currentLocation;
        if (!loc) return '';

        return `
            (function() {
                'use strict';

                const spoofedLocation = {
                    latitude: ${loc.geolocation.latitude},
                    longitude: ${loc.geolocation.longitude},
                    accuracy: ${loc.geolocation.accuracy},
                    timezone: '${loc.timezone}',
                    locale: '${loc.locale}',
                    languages: ${JSON.stringify(loc.languages)},
                };

                ${this.config.spoofGeolocation ? `
                // Override Geolocation API
                const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
                const originalWatchPosition = navigator.geolocation.watchPosition;

                navigator.geolocation.getCurrentPosition = function(success, error, options) {
                    success({
                        coords: {
                            latitude: spoofedLocation.latitude,
                            longitude: spoofedLocation.longitude,
                            accuracy: spoofedLocation.accuracy,
                            altitude: null,
                            altitudeAccuracy: null,
                            heading: null,
                            speed: null,
                        },
                        timestamp: Date.now(),
                    });
                };

                navigator.geolocation.watchPosition = function(success, error, options) {
                    const id = setInterval(() => {
                        success({
                            coords: {
                                latitude: spoofedLocation.latitude + (Math.random() - 0.5) * 0.0001,
                                longitude: spoofedLocation.longitude + (Math.random() - 0.5) * 0.0001,
                                accuracy: spoofedLocation.accuracy,
                                altitude: null,
                                altitudeAccuracy: null,
                                heading: null,
                                speed: null,
                            },
                            timestamp: Date.now(),
                        });
                    }, 5000);
                    return id;
                };
                ` : ''}

                ${this.config.spoofLocale ? `
                // Override navigator.languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => spoofedLocation.languages,
                });

                Object.defineProperty(navigator, 'language', {
                    get: () => spoofedLocation.languages[0],
                });
                ` : ''}

                ${this.config.spoofTimezone ? `
                // Override timezone via Intl
                const OriginalDateTimeFormat = Intl.DateTimeFormat;
                Intl.DateTimeFormat = function(locale, options) {
                    if (!options) options = {};
                    if (!options.timeZone) options.timeZone = spoofedLocation.timezone;
                    return new OriginalDateTimeFormat(locale, options);
                };
                Intl.DateTimeFormat.prototype = OriginalDateTimeFormat.prototype;

                // Override Date.prototype.getTimezoneOffset
                const targetOffset = getTimezoneOffset(spoofedLocation.timezone);
                Date.prototype.getTimezoneOffset = function() {
                    return targetOffset;
                };

                function getTimezoneOffset(tz) {
                    const tzOffsets = {
                        'America/New_York': 300,
                        'America/Chicago': 360,
                        'America/Los_Angeles': 480,
                        'America/Toronto': 300,
                        'America/Vancouver': 480,
                        'America/Sao_Paulo': 180,
                        'Europe/London': 0,
                        'Europe/Paris': -60,
                        'Europe/Berlin': -60,
                        'Europe/Amsterdam': -60,
                        'Asia/Tokyo': -540,
                        'Asia/Kolkata': -330,
                        'Australia/Sydney': -660,
                        'Australia/Melbourne': -660,
                    };
                    return tzOffsets[tz] || 0;
                }
                ` : ''}

                ${this.config.blockGeolocationPrompts ? `
                // Block geolocation permission prompts
                const originalQuery = navigator.permissions.query;
                navigator.permissions.query = async function(descriptor) {
                    if (descriptor.name === 'geolocation') {
                        return { state: 'granted', onchange: null };
                    }
                    return originalQuery.call(this, descriptor);
                };
                ` : ''}

                console.log('[Cloak] Location spoofed:', spoofedLocation.timezone, spoofedLocation.latitude.toFixed(4), spoofedLocation.longitude.toFixed(4));
            })();
        `;
    }

    /**
     * Apply location spoofing to browser context
     */
    async applyToContext(context: BrowserContext, location?: LocationProfile): Promise<void> {
        const script = this.getInjectionScript(location);
        if (script) {
            await context.addInitScript(script);
            logger.debug('Location spoofing applied to context');
        }
    }

    /**
     * Apply location spoofing to page
     */
    async applyToPage(page: Page, location?: LocationProfile): Promise<void> {
        const script = this.getInjectionScript(location);
        if (script) {
            await page.addInitScript(script);
            logger.debug('Location spoofing applied to page');
        }
    }

    /**
     * Get current location profile
     */
    getCurrentLocation(): LocationProfile | undefined {
        return this.currentLocation;
    }

    /**
     * Get config
     */
    getConfig(): LocationSpoofConfig {
        return { ...this.config };
    }
}

// Factory function
export function createLocationSpoofer(config?: Partial<LocationSpoofConfig>): LocationSpoofer {
    return new LocationSpoofer(config);
}
