/**
 * Advanced Fingerprint Engine
 * Generates coherent browser personalities with Canvas, WebGL, AudioContext randomization
 */

import { BrowserContext, Page } from 'playwright';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface HardwareFingerprint {
    canvas: {
        noise: number; // 0-1, amount of noise to add
        seed: number; // Random seed for reproducibility
    };
    webgl: {
        vendor: string;
        renderer: string;
        unmaskedVendor: string;
        unmaskedRenderer: string;
    };
    audio: {
        oscillatorNoise: number;
        dynamicsCompressorNoise: number;
    };
    screen: {
        width: number;
        height: number;
        availWidth: number;
        availHeight: number;
        colorDepth: number;
        pixelDepth: number;
    };
}

export interface BehavioralProfile {
    mouse: {
        movementStyle: 'smooth' | 'jittery' | 'precise';
        speed: number; // pixels per second
        pauseProbability: number; // 0-1
    };
    typing: {
        wpm: number; // words per minute
        errorRate: number; // 0-1
        thinkTime: number; // ms between words
    };
    scrolling: {
        style: 'smooth' | 'stepped' | 'fast';
        speed: number; // pixels per second
        pauseDuration: number; // ms
    };
}

export interface NetworkIdentity {
    timezone: string;
    locale: string;
    languages: string[];
    doNotTrack: boolean;
    hardwareConcurrency: number;
    deviceMemory: number;
    platform: string;
}

export interface BrowserPersonality {
    id: string;
    hardware: HardwareFingerprint;
    behavioral: BehavioralProfile;
    network: NetworkIdentity;
    userAgent: string;
    createdAt: Date;
}

const WEBGL_VENDORS = [
    { vendor: 'Intel Inc.', renderer: 'Intel Iris OpenGL Engine' },
    { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1060/PCIe/SSE2' },
    { vendor: 'AMD', renderer: 'AMD Radeon Pro 5500M OpenGL Engine' },
    { vendor: 'Apple', renderer: 'Apple M1' },
    { vendor: 'Intel', renderer: 'Mesa DRI Intel(R) UHD Graphics 620' },
];

const PLATFORMS = ['Win32', 'MacIntel', 'Linux x86_64'];

const TIMEZONES = [
    'America/New_York',
    'America/Los_Angeles',
    'America/Chicago',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney',
];

export class FingerprintEngine {
    /**
     * Generate a coherent browser personality
     */
    generatePersonality(): BrowserPersonality {
        const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
        const webglConfig = WEBGL_VENDORS[Math.floor(Math.random() * WEBGL_VENDORS.length)];
        const timezone = TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)];

        // Generate coherent screen resolution based on platform
        const screen = this.generateScreenResolution(platform);

        return {
            id: this.generateId(),
            hardware: {
                canvas: {
                    noise: 0.0001 + Math.random() * 0.0009, // Very subtle noise
                    seed: Math.floor(Math.random() * 1000000),
                },
                webgl: {
                    vendor: webglConfig.vendor,
                    renderer: webglConfig.renderer,
                    unmaskedVendor: webglConfig.vendor,
                    unmaskedRenderer: webglConfig.renderer,
                },
                audio: {
                    oscillatorNoise: 0.00001 + Math.random() * 0.00009,
                    dynamicsCompressorNoise: 0.00001 + Math.random() * 0.00009,
                },
                screen,
            },
            behavioral: {
                mouse: {
                    movementStyle: this.randomChoice(['smooth', 'jittery', 'precise']),
                    speed: 200 + Math.random() * 300, // 200-500 px/s
                    pauseProbability: 0.1 + Math.random() * 0.2, // 10-30%
                },
                typing: {
                    wpm: 40 + Math.random() * 60, // 40-100 WPM
                    errorRate: 0.01 + Math.random() * 0.04, // 1-5% error rate
                    thinkTime: 500 + Math.random() * 2000, // 0.5-2.5s between words
                },
                scrolling: {
                    style: this.randomChoice(['smooth', 'stepped', 'fast']),
                    speed: 300 + Math.random() * 500, // 300-800 px/s
                    pauseDuration: 200 + Math.random() * 800, // 200-1000ms
                },
            },
            network: {
                timezone,
                locale: this.getLocaleForTimezone(timezone),
                languages: this.getLanguagesForTimezone(timezone),
                doNotTrack: Math.random() > 0.7, // 30% enable DNT
                hardwareConcurrency: this.randomChoice([2, 4, 8, 12, 16]),
                deviceMemory: this.randomChoice([4, 8, 16, 32]),
                platform,
            },
            userAgent: this.generateUserAgent(platform),
            createdAt: new Date(),
        };
    }

    /**
     * Apply fingerprint to browser context
     */
    async applyToContext(context: BrowserContext, personality: BrowserPersonality): Promise<void> {
        // Override navigator properties
        await context.addInitScript((fp: BrowserPersonality) => {
            // Override WebGL
            const getParameterProxyHandler = {
                apply: function (target: any, thisArg: any, argumentsList: any[]) {
                    const param = argumentsList[0];

                    if (param === 37445) {
                        // UNMASKED_VENDOR_WEBGL
                        return fp.hardware.webgl.unmaskedVendor;
                    }
                    if (param === 37446) {
                        // UNMASKED_RENDERER_WEBGL
                        return fp.hardware.webgl.unmaskedRenderer;
                    }

                    return Reflect.apply(target, thisArg, argumentsList);
                },
            };

            const getExtensionProxyHandler = {
                apply: function (target: any, thisArg: any, argumentsList: any[]) {
                    const result = Reflect.apply(target, thisArg, argumentsList) as any;

                    if (result && argumentsList[0] === 'WEBGL_debug_renderer_info') {
                        const getParameterOriginal = result.getParameter;
                        result.getParameter = new Proxy(getParameterOriginal, getParameterProxyHandler);
                    }

                    return result;
                },
            };

            // Override WebGL context
            const originalGetContext = HTMLCanvasElement.prototype.getContext;
            (HTMLCanvasElement.prototype as any).getContext = function (type: string, ...args: any[]): any {
                const context = originalGetContext.apply(this, [type, ...args] as any);

                if (context && (type === 'webgl' || type === 'webgl2')) {
                    const getExtensionOriginal = (context as any).getExtension;
                    (context as any).getExtension = new Proxy(getExtensionOriginal, getExtensionProxyHandler);
                }

                return context;
            };

            // Override hardware concurrency
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => fp.network.hardwareConcurrency,
            });

            // Override device memory
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => fp.network.deviceMemory,
            });

            // Override platform
            Object.defineProperty(navigator, 'platform', {
                get: () => fp.network.platform,
            });

            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => fp.network.languages,
            });

            // Override doNotTrack
            Object.defineProperty(navigator, 'doNotTrack', {
                get: () => fp.network.doNotTrack ? '1' : null,
            });
        }, personality);

        logger.debug({ personalityId: personality.id }, 'Fingerprint applied to context');
    }

    /**
     * Apply fingerprint to page (Canvas, AudioContext)
     */
    async applyToPage(page: Page, personality: BrowserPersonality): Promise<void> {
        // Canvas fingerprint noise injection
        await page.addInitScript((canvasConfig: { noise: number; seed: number }) => {
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            const originalToBlob = HTMLCanvasElement.prototype.toBlob;
            const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

            // Seeded random number generator
            function seededRandom(seed: number): () => number {
                let state = seed;
                return function () {
                    state = (state * 9301 + 49297) % 233280;
                    return state / 233280;
                };
            }

            const random = seededRandom(canvasConfig.seed);

            // Add noise to canvas data
            function addNoise(imageData: ImageData): void {
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    // Add subtle noise to RGB channels
                    const noise = (random() - 0.5) * canvasConfig.noise * 255;
                    data[i] = Math.max(0, Math.min(255, data[i] + noise));
                    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
                    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
                }
            }

            // Override toDataURL
            HTMLCanvasElement.prototype.toDataURL = function (...args: any[]) {
                const context = this.getContext('2d');
                if (context) {
                    const imageData = context.getImageData(0, 0, this.width, this.height);
                    addNoise(imageData);
                    context.putImageData(imageData, 0, 0);
                }
                return originalToDataURL.apply(this, args as any);
            };

            // Override getImageData
            CanvasRenderingContext2D.prototype.getImageData = function (...args: any[]) {
                const imageData = originalGetImageData.apply(this, args as any);
                addNoise(imageData);
                return imageData;
            };
        }, personality.hardware.canvas);

        // AudioContext fingerprint noise injection
        await page.addInitScript((audioConfig: { oscillatorNoise: number; dynamicsCompressorNoise: number }) => {
            const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;

            if (AudioContext) {
                const OriginalAudioContext = AudioContext;

                (window as any).AudioContext = function (...args: any[]) {
                    const context = new OriginalAudioContext(...args);

                    // Override createOscillator
                    const originalCreateOscillator = context.createOscillator;
                    context.createOscillator = function () {
                        const oscillator = originalCreateOscillator.call(context);
                        const originalStart = oscillator.start;

                        oscillator.start = function (...startArgs: any[]) {
                            // Add subtle frequency noise
                            if (oscillator.frequency) {
                                const noise = (Math.random() - 0.5) * audioConfig.oscillatorNoise;
                                oscillator.frequency.value += noise;
                            }
                            return originalStart.apply(oscillator, startArgs);
                        };

                        return oscillator;
                    };

                    return context;
                };
            }
        }, personality.hardware.audio);

        logger.debug({ personalityId: personality.id }, 'Canvas and Audio fingerprints applied to page');
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    private generateId(): string {
        return `fp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateScreenResolution(platform: string): HardwareFingerprint['screen'] {
        const resolutions = {
            Win32: [
                { width: 1920, height: 1080 },
                { width: 1366, height: 768 },
                { width: 2560, height: 1440 },
            ],
            MacIntel: [
                { width: 2560, height: 1600 }, // MacBook Pro 16"
                { width: 1920, height: 1080 }, // iMac
                { width: 3024, height: 1964 }, // MacBook Pro 14"
            ],
            'Linux x86_64': [
                { width: 1920, height: 1080 },
                { width: 1366, height: 768 },
                { width: 2560, height: 1440 },
            ],
        };

        const platformResolutions = resolutions[platform as keyof typeof resolutions] || resolutions.Win32;
        const resolution = platformResolutions[Math.floor(Math.random() * platformResolutions.length)];

        return {
            width: resolution.width,
            height: resolution.height,
            availWidth: resolution.width,
            availHeight: resolution.height - (platform === 'Win32' ? 40 : 25), // Taskbar/menu bar
            colorDepth: 24,
            pixelDepth: 24,
        };
    }

    private getLocaleForTimezone(timezone: string): string {
        const localeMap: Record<string, string> = {
            'America/New_York': 'en-US',
            'America/Los_Angeles': 'en-US',
            'America/Chicago': 'en-US',
            'Europe/London': 'en-GB',
            'Europe/Paris': 'fr-FR',
            'Asia/Tokyo': 'ja-JP',
            'Australia/Sydney': 'en-AU',
        };
        return localeMap[timezone] || 'en-US';
    }

    private getLanguagesForTimezone(timezone: string): string[] {
        const languageMap: Record<string, string[]> = {
            'America/New_York': ['en-US', 'en'],
            'America/Los_Angeles': ['en-US', 'en'],
            'America/Chicago': ['en-US', 'en'],
            'Europe/London': ['en-GB', 'en'],
            'Europe/Paris': ['fr-FR', 'fr', 'en'],
            'Asia/Tokyo': ['ja-JP', 'ja', 'en'],
            'Australia/Sydney': ['en-AU', 'en'],
        };
        return languageMap[timezone] || ['en-US', 'en'];
    }

    private generateUserAgent(platform: string): string {
        const chromeVersion = 120 + Math.floor(Math.random() * 5); // Chrome 120-124

        const userAgents: Record<string, string> = {
            Win32: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`,
            MacIntel: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`,
            'Linux x86_64': `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`,
        };

        return userAgents[platform] || userAgents.Win32;
    }

    private randomChoice<T>(array: T[]): T {
        return array[Math.floor(Math.random() * array.length)];
    }
}
