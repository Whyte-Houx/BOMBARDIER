/**
 * Location Spoofing Module - Main Entry Point
 */

export * from './types.js';
export * from './profiles.js';
export * from './spoofer.js';

import { LocationSpoofer, createLocationSpoofer } from './spoofer.js';
import type { LocationProfile, LocationSpoofConfig } from './types.js';

export { LocationSpoofer, createLocationSpoofer };
export type { LocationProfile, LocationSpoofConfig };
