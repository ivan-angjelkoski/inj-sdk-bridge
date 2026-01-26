import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type PublicClient,
  type WalletClient,
  type Account,
  type Transport,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { messageTransmitterAbi } from "../constants/abi";
import { CCTP_CONTRACTS } from "../constants/cctp";
import type { RelayerErrorCode } from "../types/relayer";
import { getAlchemyRpcUrls, getChainById } from "../config/chains";
import { parseCctpMessage, hashSourceAndNonce } from "../utils/message";

/**
 * Error codes for relayer operations
 */
export class RelayerError extends Error {
  constructor(
    message: string,
    public readonly code: RelayerErrorCode,
  ) {
    super(message);
    this.name = "RelayerError";
  }
}

/**
 * Relayer service for executing CCTP mint transactions
 */
export class RelayerService {
  private readonly account: ReturnType<typeof privateKeyToAccount>;
  private readonly rpcUrls: Record<number, string>;

  constructor(privateKey: `0x${string}`, alchemyApiKey: string) {
    this.account = privateKeyToAccount(privateKey);
    this.rpcUrls = getAlchemyRpcUrls({ apiKey: alchemyApiKey });
  }

  /**
   * Get the relayer's wallet address
   */
  getAddress(): `0x${string}` {
    return this.account.address;
  }

  /**
   * Create a public client for a specific chain
   */
  private getPublicClient(chain: Chain): PublicClient {
    const rpcUrl = this.rpcUrls[chain.id];
    if (!rpcUrl) {
      throw new RelayerError(
        `No RPC URL configured for chain ${chain.id}`,
        "MISSING_CONFIG",
      );
    }

    return createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
  }

  /**
   * Create a wallet client for a specific chain
   */
  private getWalletClient(
    chain: Chain,
  ): WalletClient<Transport, Chain, Account> {
    const rpcUrl = this.rpcUrls[chain.id];
    if (!rpcUrl) {
      throw new RelayerError(
        `No RPC URL configured for chain ${chain.id}`,
        "MISSING_CONFIG",
      );
    }

    return createWalletClient({
      account: this.account,
      chain,
      transport: http(rpcUrl),
    });
  }

  /**
   * Check if a message has already been processed on the destination chain
   */
  async isMessageProcessed(
    message: `0x${string}`,
    chainId: number,
  ): Promise<boolean> {
    const chain = getChainById(chainId);
    if (!chain) {
      throw new RelayerError(
        `Unsupported chain: ${chainId}`,
        "UNSUPPORTED_CHAIN",
      );
    }

    const config = CCTP_CONTRACTS[chainId];
    if (!config) {
      throw new RelayerError(
        `No CCTP config for chain: ${chainId}`,
        "UNSUPPORTED_CHAIN",
      );
    }

    const publicClient = this.getPublicClient(chain);
    const parsed = parseCctpMessage(message);
    const nonceHash = hashSourceAndNonce(parsed.sourceDomain, parsed.nonce);

    const used = await publicClient.readContract({
      abi: messageTransmitterAbi,
      address: config.messageTransmitterV2,
      functionName: "usedNonces",
      args: [nonceHash],
    });

    return used !== 0n;
  }

  /**
   * Execute the mint (receiveMessage) transaction on the destination chain
   */
  async executeMint(params: {
    message: `0x${string}`;
    attestation: `0x${string}`;
    destinationChainId: number;
  }): Promise<{
    transactionHash: `0x${string}`;
    chainId: number;
    chainName: string;
  }> {
    const { message, attestation, destinationChainId } = params;

    // Get chain configuration
    const chain = getChainById(destinationChainId);
    if (!chain) {
      throw new RelayerError(
        `Unsupported chain: ${destinationChainId}`,
        "UNSUPPORTED_CHAIN",
      );
    }

    const config = CCTP_CONTRACTS[destinationChainId];
    if (!config) {
      throw new RelayerError(
        `No CCTP config for chain: ${destinationChainId}`,
        "UNSUPPORTED_CHAIN",
      );
    }

    // Check if message is already processed
    const isProcessed = await this.isMessageProcessed(
      message,
      destinationChainId,
    );
    if (isProcessed) {
      throw new RelayerError(
        "Message has already been processed",
        "ALREADY_PROCESSED",
      );
    }

    // Parse message to validate destination domain matches
    const parsed = parseCctpMessage(message);
    if (parsed.destinationDomain !== config.domain) {
      throw new RelayerError(
        `Message destination domain (${parsed.destinationDomain}) does not match chain domain (${config.domain})`,
        "INVALID_REQUEST",
      );
    }

    // Execute the transaction
    const walletClient = this.getWalletClient(chain);
    const publicClient = this.getPublicClient(chain);

    try {
      const hash = await walletClient.writeContract({
        abi: messageTransmitterAbi,
        address: config.messageTransmitterV2,
        functionName: "receiveMessage",
        args: [message, attestation],
      });

      // Wait for transaction to be mined
      await publicClient.waitForTransactionReceipt({ hash });

      return {
        transactionHash: hash,
        chainId: destinationChainId,
        chainName: chain.name,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new RelayerError(
        `Transaction execution failed: ${errorMessage}`,
        "EXECUTION_FAILED",
      );
    }
  }

  /**
   * Get the native token balance of the relayer on a specific chain
   */
  async getBalance(chainId: number): Promise<bigint> {
    const chain = getChainById(chainId);
    if (!chain) {
      throw new RelayerError(
        `Unsupported chain: ${chainId}`,
        "UNSUPPORTED_CHAIN",
      );
    }

    const publicClient = this.getPublicClient(chain);
    return publicClient.getBalance({ address: this.account.address });
  }
}

// Singleton instance (initialized in index.ts)
let relayerService: RelayerService | null = null;

export function initRelayerService(
  privateKey: `0x${string}`,
  alchemyApiKey: string,
): RelayerService {
  relayerService = new RelayerService(privateKey, alchemyApiKey);
  return relayerService;
}

export function getRelayerService(): RelayerService {
  if (!relayerService) {
    throw new Error("Relayer service not initialized");
  }
  return relayerService;
}
