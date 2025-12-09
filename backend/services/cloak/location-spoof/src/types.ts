/**
 * Location Spoofing Module - Types
 * Geographic identity masking for browser automation
 */

export interface GeoLocation {
    latitude: number;
    longitude: number;
    accuracy: number;
}

export interface LocationProfile {
    id: string;
    country: string;
    countryCode: string;
    region: string;
    city: string;
    timezone: string;
    locale: string;
    languages: string[];
    currency: string;
    geolocation: GeoLocation;
}

export interface LocationSpoofConfig {
    enabled: boolean;
    country?: string;
    randomizeWithinCountry: boolean;
    spoofTimezone: boolean;
    spoofLocale: boolean;
    spoofGeolocation: boolean;
    blockGeolocationPrompts: boolean;
}

export const DEFAULT_LOCATION_SPOOF_CONFIG: LocationSpoofConfig = {
    enabled: true,
    randomizeWithinCountry: true,
    spoofTimezone: true,
    spoofLocale: true,
    spoofGeolocation: true,
    blockGeolocationPrompts: false,
};
