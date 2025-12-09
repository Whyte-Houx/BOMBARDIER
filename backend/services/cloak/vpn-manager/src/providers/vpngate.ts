/**
 * VPN Gate Provider
 * Scrapes free OpenVPN configs from vpngate.net
 */

import type { VPNConfig } from '../types.js';

const VPNGATE_API_URL = 'http://www.vpngate.net/api/iphone/';

interface VPNGateRecord {
    HostName: string;
    IP: string;
    Score: string;
    CountryShort: string;
    OpenVPN_ConfigData_Base64: string;
}

export class VPNGateProvider {
    /**
     * Fetch available VPNs from VPN Gate
     */
    async fetchConfigs(): Promise<VPNConfig[]> {
        try {
            const response = await fetch(VPNGATE_API_URL);

            if (!response.ok) {
                console.error(`VPN Gate API returned ${response.status}`);
                return [];
            }

            const text = await response.text();

            // Skip comments (lines starting with * or #)
            const lines = text.split('\n').filter(
                (line: string) => !line.startsWith('*') && !line.startsWith('#') && line.trim() !== ''
            );

            if (lines.length < 2) {
                console.warn('VPN Gate returned no valid data');
                return [];
            }

            // First line is headers
            const headers = lines[0].split(',');
            const hostIdx = headers.indexOf('HostName');
            const ipIdx = headers.indexOf('IP');
            const scoreIdx = headers.indexOf('Score');
            const countryIdx = headers.indexOf('CountryShort');
            const configIdx = headers.indexOf('OpenVPN_ConfigData_Base64');

            if (configIdx === -1) {
                console.error('VPN Gate response missing required columns');
                return [];
            }

            const configs: VPNConfig[] = [];

            // Parse data rows
            for (let i = 1; i < lines.length; i++) {
                try {
                    const values = lines[i].split(',');

                    if (values.length <= configIdx || !values[configIdx]) {
                        continue;
                    }

                    const configBase64 = values[configIdx];
                    const configContent = Buffer.from(configBase64, 'base64').toString('utf8');

                    // Validate it looks like an OpenVPN config
                    if (!configContent.includes('client') && !configContent.includes('remote')) {
                        continue;
                    }

                    const hostName = hostIdx >= 0 ? values[hostIdx] : 'unknown';
                    const ip = ipIdx >= 0 ? values[ipIdx] : '0.0.0.0';
                    const country = countryIdx >= 0 ? values[countryIdx] : 'XX';
                    const score = scoreIdx >= 0 ? parseInt(values[scoreIdx]) || 0 : 0;

                    configs.push({
                        id: `vpngate-${hostName}-${ip}`,
                        protocol: 'openvpn',
                        provider: 'vpngate',
                        name: `${country} - ${hostName}`,
                        country,
                        configContent,
                        score,
                        // VPN Gate typically uses 'vpn' for both
                        username: 'vpn',
                        password: 'vpn',
                    });
                } catch (err) {
                    // Skip malformed line
                    continue;
                }
            }

            console.log(`VPN Gate: Found ${configs.length} configs`);
            return configs;

        } catch (err) {
            console.error('Failed to fetch VPN Gate configs:', err);
            return [];
        }
    }
}
