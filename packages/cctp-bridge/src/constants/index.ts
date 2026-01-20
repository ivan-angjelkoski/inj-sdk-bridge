import { erc20Abi } from "viem";

export const domain = {
  optimismSepolia: 2,
  mainnet: 0,
};

export const tokenMessengerAbi = [
  {
    type: "function",
    name: "depositForBurn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "receiveMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const tokenMessengerAddress = {
  optimismSepolia: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  mainnet: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
} as const;

export const usdcAbi = erc20Abi;

export const usdcAddress = {
  optimismSepolia: "0x5fd84259d66cd46123540766be93dfe6d43130d7",
  mainnet: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
} as const;
