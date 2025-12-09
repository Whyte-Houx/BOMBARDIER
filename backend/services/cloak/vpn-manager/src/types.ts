/**
 * VPN Manager - Type Definitions
 */

export type VPNProtocol = 'wireguard' | 'openvpn';
export type VPNProviderType = 'custom' | 'vpngate' | 'proton' | 'mullvad';

export interface VPNConfig {
    id: string;
    protocol: VPNProtocol;
    provider: VPNProviderType;
    name: string;
    country: string;
    configContent: string; // .conf or .ovpn content
    username?: string;
    password?: string;
    score?: number;
}

export interface VPNStatus {
    isConnected: boolean;
    currentConfig?: VPNConfig;
    interfaceName?: string;
    ip?: string;
    uptime?: number;
    bytesReceived?: number;
    bytesSent?: number;
}

export interface WireGuardConfig {
    privateKey: string;
    address: string;
    dns?: string;
    peers: {
        publicKey: string;
        endpoint: string;
        allowedIPs: string;
        persistentKeepalive?: number;
    }[];
}
