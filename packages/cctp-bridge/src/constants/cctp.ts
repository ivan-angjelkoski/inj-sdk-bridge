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

// CCTP Domain Identifiers
export const CCTP_DOMAINS = {
  ETHEREUM: 0,
  AVALANCHE: 1,
  OP_MAINNET: 2,
  ARBITRUM: 3,
  BASE: 6,
  POLYGON_POS: 7,
  UNICHAIN: 10,
  LINEA: 11,
  CODEX: 12,
  SONIC: 13,
  WORLD_CHAIN: 14,
  MONAD: 15,
  SEI: 16,
  XDC: 18,
  HYPER_EVM: 19,
  INK: 21,
  PLUME: 22,
  ARC: 26,
} as const;

// =====================
// MAINNET CONTRACTS
// =====================

// TokenMessengerV2 - Mainnet
export const TOKEN_MESSENGER_V2_MAINNET =
  "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d" as const;

// MessageTransmitterV2 - Mainnet
export const MESSAGE_TRANSMITTER_V2_MAINNET =
  "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64" as const;

// TokenMinterV2 - Mainnet
export const TOKEN_MINTER_V2_MAINNET =
  "0xfd78EE919681417d192449715b2594ab58f5D002" as const;

// MessageV2 - Mainnet
export const MESSAGE_V2_MAINNET =
  "0xec546b6B005471ECf012e5aF77FBeC07e0FD8f78" as const;

// =====================
// TESTNET CONTRACTS
// =====================

// TokenMessengerV2 - Testnet
export const TOKEN_MESSENGER_V2_TESTNET =
  "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as const;

// MessageTransmitterV2 - Testnet
export const MESSAGE_TRANSMITTER_V2_TESTNET =
  "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as const;

// TokenMinterV2 - Testnet
export const TOKEN_MINTER_V2_TESTNET =
  "0xb43db544E2c27092c107639Ad201b3dEfAbcF192" as const;

// MessageV2 - Testnet
export const MESSAGE_V2_TESTNET =
  "0xbaC0179bB358A8936169a63408C8481D582390C4" as const;

// =====================
// USDC CONTRACT ADDRESSES
// =====================

// USDC Mainnet Addresses
export const USDC_MAINNET_ADDRESSES = {
  ETHEREUM: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  AVALANCHE: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  OP_MAINNET: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  ARBITRUM: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  BASE: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  POLYGON_POS: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  LINEA: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
  SONIC: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
  SEI: "0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392",
  INK: "0x2D270e6886d130D724215A266106e6832161EAEd",
} as const;

// USDC Testnet Addresses
export const USDC_TESTNET_ADDRESSES = {
  ETHEREUM_SEPOLIA: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  AVALANCHE_FUJI: "0x5425890298aed601595a70AB815c96711a31Bc65",
  OP_SEPOLIA: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
  ARBITRUM_SEPOLIA: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  BASE_SEPOLIA: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  POLYGON_AMOY: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  LINEA_SEPOLIA: "0xFEce4462D57bD51A6A552365A011b95f0E16d9B7",
  INK_SEPOLIA: "0xFabab97dCE620294D2B0b0e46C68964e326300Ac",
} as const;

// =====================
// CONTRACT ADDRESS MAPS
// =====================

export interface CctpContractAddresses {
  tokenMessengerV2: `0x${string}`;
  messageTransmitterV2: `0x${string}`;
  tokenMinterV2: `0x${string}`;
  messageV2: `0x${string}`;
  usdcAddress: `0x${string}`;
  domain: number;
}

// Mainnet contract address map by chain ID
export const CCTP_MAINNET_CONTRACTS: Record<number, CctpContractAddresses> = {
  [mainnet.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_MAINNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_MAINNET,
    tokenMinterV2: TOKEN_MINTER_V2_MAINNET,
    messageV2: MESSAGE_V2_MAINNET,
    usdcAddress: USDC_MAINNET_ADDRESSES.ETHEREUM,
    domain: CCTP_DOMAINS.ETHEREUM,
  },
  [avalanche.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_MAINNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_MAINNET,
    tokenMinterV2: TOKEN_MINTER_V2_MAINNET,
    messageV2: MESSAGE_V2_MAINNET,
    usdcAddress: USDC_MAINNET_ADDRESSES.AVALANCHE,
    domain: CCTP_DOMAINS.AVALANCHE,
  },
  [optimism.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_MAINNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_MAINNET,
    tokenMinterV2: TOKEN_MINTER_V2_MAINNET,
    messageV2: MESSAGE_V2_MAINNET,
    usdcAddress: USDC_MAINNET_ADDRESSES.OP_MAINNET,
    domain: CCTP_DOMAINS.OP_MAINNET,
  },
  [arbitrum.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_MAINNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_MAINNET,
    tokenMinterV2: TOKEN_MINTER_V2_MAINNET,
    messageV2: MESSAGE_V2_MAINNET,
    usdcAddress: USDC_MAINNET_ADDRESSES.ARBITRUM,
    domain: CCTP_DOMAINS.ARBITRUM,
  },
  [base.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_MAINNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_MAINNET,
    tokenMinterV2: TOKEN_MINTER_V2_MAINNET,
    messageV2: MESSAGE_V2_MAINNET,
    usdcAddress: USDC_MAINNET_ADDRESSES.BASE,
    domain: CCTP_DOMAINS.BASE,
  },
  [polygon.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_MAINNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_MAINNET,
    tokenMinterV2: TOKEN_MINTER_V2_MAINNET,
    messageV2: MESSAGE_V2_MAINNET,
    usdcAddress: USDC_MAINNET_ADDRESSES.POLYGON_POS,
    domain: CCTP_DOMAINS.POLYGON_POS,
  },
  [linea.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_MAINNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_MAINNET,
    tokenMinterV2: TOKEN_MINTER_V2_MAINNET,
    messageV2: MESSAGE_V2_MAINNET,
    usdcAddress: USDC_MAINNET_ADDRESSES.LINEA,
    domain: CCTP_DOMAINS.LINEA,
  },
  [sonic.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_MAINNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_MAINNET,
    tokenMinterV2: TOKEN_MINTER_V2_MAINNET,
    messageV2: MESSAGE_V2_MAINNET,
    usdcAddress: USDC_MAINNET_ADDRESSES.SONIC,
    domain: CCTP_DOMAINS.SONIC,
  },
  [sei.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_MAINNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_MAINNET,
    tokenMinterV2: TOKEN_MINTER_V2_MAINNET,
    messageV2: MESSAGE_V2_MAINNET,
    usdcAddress: USDC_MAINNET_ADDRESSES.SEI,
    domain: CCTP_DOMAINS.SEI,
  },
  [ink.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_MAINNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_MAINNET,
    tokenMinterV2: TOKEN_MINTER_V2_MAINNET,
    messageV2: MESSAGE_V2_MAINNET,
    usdcAddress: USDC_MAINNET_ADDRESSES.INK,
    domain: CCTP_DOMAINS.INK,
  },
} as const;

// Testnet contract address map by chain ID
export const CCTP_TESTNET_CONTRACTS: Record<number, CctpContractAddresses> = {
  [sepolia.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_TESTNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_TESTNET,
    tokenMinterV2: TOKEN_MINTER_V2_TESTNET,
    messageV2: MESSAGE_V2_TESTNET,
    usdcAddress: USDC_TESTNET_ADDRESSES.ETHEREUM_SEPOLIA,
    domain: CCTP_DOMAINS.ETHEREUM,
  },
  [avalancheFuji.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_TESTNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_TESTNET,
    tokenMinterV2: TOKEN_MINTER_V2_TESTNET,
    messageV2: MESSAGE_V2_TESTNET,
    usdcAddress: USDC_TESTNET_ADDRESSES.AVALANCHE_FUJI,
    domain: CCTP_DOMAINS.AVALANCHE,
  },
  [optimismSepolia.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_TESTNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_TESTNET,
    tokenMinterV2: TOKEN_MINTER_V2_TESTNET,
    messageV2: MESSAGE_V2_TESTNET,
    usdcAddress: USDC_TESTNET_ADDRESSES.OP_SEPOLIA,
    domain: CCTP_DOMAINS.OP_MAINNET,
  },
  [arbitrumSepolia.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_TESTNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_TESTNET,
    tokenMinterV2: TOKEN_MINTER_V2_TESTNET,
    messageV2: MESSAGE_V2_TESTNET,
    usdcAddress: USDC_TESTNET_ADDRESSES.ARBITRUM_SEPOLIA,
    domain: CCTP_DOMAINS.ARBITRUM,
  },
  [baseSepolia.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_TESTNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_TESTNET,
    tokenMinterV2: TOKEN_MINTER_V2_TESTNET,
    messageV2: MESSAGE_V2_TESTNET,
    usdcAddress: USDC_TESTNET_ADDRESSES.BASE_SEPOLIA,
    domain: CCTP_DOMAINS.BASE,
  },
  [polygonAmoy.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_TESTNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_TESTNET,
    tokenMinterV2: TOKEN_MINTER_V2_TESTNET,
    messageV2: MESSAGE_V2_TESTNET,
    usdcAddress: USDC_TESTNET_ADDRESSES.POLYGON_AMOY,
    domain: CCTP_DOMAINS.POLYGON_POS,
  },
  [lineaSepolia.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_TESTNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_TESTNET,
    tokenMinterV2: TOKEN_MINTER_V2_TESTNET,
    messageV2: MESSAGE_V2_TESTNET,
    usdcAddress: USDC_TESTNET_ADDRESSES.LINEA_SEPOLIA,
    domain: CCTP_DOMAINS.LINEA,
  },
  [inkSepolia.id]: {
    tokenMessengerV2: TOKEN_MESSENGER_V2_TESTNET,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2_TESTNET,
    tokenMinterV2: TOKEN_MINTER_V2_TESTNET,
    messageV2: MESSAGE_V2_TESTNET,
    usdcAddress: USDC_TESTNET_ADDRESSES.INK_SEPOLIA,
    domain: CCTP_DOMAINS.INK,
  },
} as const;

// Combined map of all CCTP contracts by chain ID
export const CCTP_CONTRACTS: Record<number, CctpContractAddresses> = {
  ...CCTP_MAINNET_CONTRACTS,
  ...CCTP_TESTNET_CONTRACTS,
} as const;
