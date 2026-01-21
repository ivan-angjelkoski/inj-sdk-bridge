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

export function getAlchemyRpcUrls({ apiKey }: { apiKey: string }) {
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
