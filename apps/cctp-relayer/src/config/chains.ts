import type { Chain } from "viem";
import {
  mainnet,
  avalanche,
  optimism,
  arbitrum,
  base,
  polygon,
  linea,
  sonic,
  sei,
  ink,
  sepolia,
  avalancheFuji,
  optimismSepolia,
  arbitrumSepolia,
  baseSepolia,
  polygonAmoy,
  lineaSepolia,
  inkSepolia,
} from "viem/chains";
import { CCTP_CONTRACTS } from "../constants/cctp";

/**
 * Get Alchemy RPC URLs for all supported chains
 */
export function getAlchemyRpcUrls({
  apiKey,
}: {
  apiKey: string;
}): Record<number, string> {
  return {
    // Mainnet
    [mainnet.id]: `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`,
    [avalanche.id]: `https://avax-mainnet.g.alchemy.com/v2/${apiKey}`,
    [optimism.id]: `https://opt-mainnet.g.alchemy.com/v2/${apiKey}`,
    [arbitrum.id]: `https://arb-mainnet.g.alchemy.com/v2/${apiKey}`,
    [base.id]: `https://base-mainnet.g.alchemy.com/v2/${apiKey}`,
    [polygon.id]: `https://polygon-mainnet.g.alchemy.com/v2/${apiKey}`,
    [linea.id]: `https://linea-mainnet.g.alchemy.com/v2/${apiKey}`,
    [sonic.id]: `https://sonic-mainnet.g.alchemy.com/v2/${apiKey}`,
    [sei.id]: `https://sei-mainnet.g.alchemy.com/v2/${apiKey}`,
    [ink.id]: `https://ink-mainnet.g.alchemy.com/v2/${apiKey}`,
    // Testnet
    [sepolia.id]: `https://eth-sepolia.g.alchemy.com/v2/${apiKey}`,
    [avalancheFuji.id]: `https://avax-fuji.g.alchemy.com/v2/${apiKey}`,
    [optimismSepolia.id]: `https://opt-sepolia.g.alchemy.com/v2/${apiKey}`,
    [arbitrumSepolia.id]: `https://arb-sepolia.g.alchemy.com/v2/${apiKey}`,
    [baseSepolia.id]: `https://base-sepolia.g.alchemy.com/v2/${apiKey}`,
    [polygonAmoy.id]: `https://polygon-amoy.g.alchemy.com/v2/${apiKey}`,
    [lineaSepolia.id]: `https://linea-sepolia.g.alchemy.com/v2/${apiKey}`,
    [inkSepolia.id]: `https://ink-sepolia.g.alchemy.com/v2/${apiKey}`,
  };
}

/**
 * Map of chain IDs to viem Chain objects
 */
export const SUPPORTED_CHAINS: Record<number, Chain> = {
  // Mainnet
  [mainnet.id]: mainnet,
  [avalanche.id]: avalanche,
  [optimism.id]: optimism,
  [arbitrum.id]: arbitrum,
  [base.id]: base,
  [polygon.id]: polygon,
  [linea.id]: linea,
  [sonic.id]: sonic,
  [sei.id]: sei,
  [ink.id]: ink,
  // Testnet
  [sepolia.id]: sepolia,
  [avalancheFuji.id]: avalancheFuji,
  [optimismSepolia.id]: optimismSepolia,
  [arbitrumSepolia.id]: arbitrumSepolia,
  [baseSepolia.id]: baseSepolia,
  [polygonAmoy.id]: polygonAmoy,
  [lineaSepolia.id]: lineaSepolia,
  [inkSepolia.id]: inkSepolia,
};

/**
 * Get chain by ID, returns undefined if not supported
 */
export function getChainById(chainId: number): Chain | undefined {
  return SUPPORTED_CHAINS[chainId];
}

/**
 * Check if a chain ID is supported by the relayer
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in CCTP_CONTRACTS && chainId in SUPPORTED_CHAINS;
}

/**
 * Get list of all supported chain info for health endpoint
 */
export function getSupportedChainInfo(): Array<{
  chainId: number;
  name: string;
  domain: number;
}> {
  return Object.entries(CCTP_CONTRACTS)
    .filter(([chainId]) => chainId in SUPPORTED_CHAINS)
    .map(([chainId, config]) => {
      const chain = SUPPORTED_CHAINS[Number(chainId)];
      return {
        chainId: Number(chainId),
        name: chain?.name ?? "Unknown",
        domain: config.domain,
      };
    });
}
