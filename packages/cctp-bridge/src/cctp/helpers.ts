import type { Account, Chain, Transport, WalletClient } from "viem";
import { toAccount } from "viem/accounts";
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

/**
 * Get Pimlico bundler RPC URLs for ERC-4337 bundler operations.
 * Uses the public Pimlico endpoint.
 */
export function getPimlicoBundlerRpcUrls() {
  return {
    // Mainnet
    [mainnet.id]: `https://public.pimlico.io/v2/${mainnet.id}/rpc`,
    [optimism.id]: `https://public.pimlico.io/v2/${optimism.id}/rpc`,
    [arbitrum.id]: `https://public.pimlico.io/v2/${arbitrum.id}/rpc`,
    [base.id]: `https://public.pimlico.io/v2/${base.id}/rpc`,
    [polygon.id]: `https://public.pimlico.io/v2/${polygon.id}/rpc`,
    // Testnet
    [sepolia.id]: `https://public.pimlico.io/v2/${sepolia.id}/rpc`,
    [optimismSepolia.id]: `https://public.pimlico.io/v2/${optimismSepolia.id}/rpc`,
    [arbitrumSepolia.id]: `https://public.pimlico.io/v2/${arbitrumSepolia.id}/rpc`,
    [baseSepolia.id]: `https://public.pimlico.io/v2/${baseSepolia.id}/rpc`,
    [polygonAmoy.id]: `https://public.pimlico.io/v2/${polygonAmoy.id}/rpc`,
  };
}

export const walletClientToAccount = (
  walletClient: WalletClient<Transport, Chain, Account>
) => {
  return toAccount({
    address: walletClient.account.address,
    signMessage: walletClient.signMessage.bind(walletClient),

    signTypedData(data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return walletClient.signTypedData(data as any);
    },

    signTransaction(tx) {
      if (tx.type !== "eip1559") {
        throw new Error("Only EIP-1559 transactions are supported");
      }

      return walletClient.signTransaction(tx);
    },
    // signTransaction: walletClient.signTransaction.bind(walletClient) as any,
    // signTypedData: walletClient.signTypedData.bind(walletClient) as any,
  });
};
