/// <reference types="vite/client" />
import { describe, it, expect, beforeAll } from "vitest";
import { createWalletClient, http, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { optimismSepolia, sepolia } from "viem/chains";

import { CctpBridge } from "../src/cctp";
import { getAlchemyRpcUrls, getPimlicoBundlerRpcUrls } from "../src";
import { CCTP_CONTRACTS } from "../src/constants";

const privateKey = import.meta.env.PRIVATE_KEY as string | undefined;
const alchemyApiKey = import.meta.env.ALCHEMY_API_KEY as string | undefined;
const alchemyPolicyId = import.meta.env.ALCHEMY_POLICY_ID as string | undefined;

describe("CCTP Bridge Flow with Smart Account", () => {
  let bridge: CctpBridge;
  let walletClient: WalletClient;
  let account: ReturnType<typeof privateKeyToAccount>;
  let rpcUrls: Record<number, string>;
  let bundlerRpcUrls: Record<number, string>;

  const BRIDGE_AMOUNT = "0.01"; // 0.01 USDC (will be converted to 6 decimals in the contract)

  beforeAll(() => {
    if (!privateKey) {
      throw new Error(
        "PRIVATE_KEY environment variable is required. Set it in a .env file.",
      );
    }

    if (!alchemyApiKey) {
      throw new Error(
        "ALCHEMY_API_KEY environment variable is required. Set it in a .env file.",
      );
    }

    if (!alchemyPolicyId) {
      throw new Error(
        "ALCHEMY_POLICY_ID environment variable is required. Set it in a .env file.",
      );
    }

    // Ensure private key has 0x prefix
    const formattedKey = privateKey.startsWith("0x")
      ? (privateKey as `0x${string}`)
      : (`0x${privateKey}` as `0x${string}`);

    account = privateKeyToAccount(formattedKey);

    // Get Alchemy RPC URLs for regular client operations
    rpcUrls = getAlchemyRpcUrls({ apiKey: alchemyApiKey });

    // Get Pimlico RPC URLs for bundler operations
    bundlerRpcUrls = getPimlicoBundlerRpcUrls();

    // Create wallet client with default transport for signing
    // The Alchemy RPC URLs are passed to the bridge for bundler/paymaster operations
    walletClient = createWalletClient({
      chain: optimismSepolia,
      transport: http(),
      account,
    });
  });

  describe("CctpBridge.create with Smart Account", () => {
    it("should create a CctpBridge instance with policyId", async () => {
      bridge = await CctpBridge.create({
        walletClient: walletClient as Parameters<
          typeof CctpBridge.create
        >[0]["walletClient"],
        srcChain: optimismSepolia,
        destChain: sepolia,
        rpcUrls,
        bundlerRpcUrls,
        policyId: alchemyPolicyId,
      });

      expect(bridge).toBeDefined();
      expect(bridge).toBeInstanceOf(CctpBridge);
    });

    it("should get smart account address", async () => {
      bridge = await CctpBridge.create({
        walletClient: walletClient as Parameters<
          typeof CctpBridge.create
        >[0]["walletClient"],
        srcChain: optimismSepolia,
        destChain: sepolia,
        rpcUrls,
        bundlerRpcUrls,
        policyId: alchemyPolicyId,
      });

      const smartAccountAddress = await bridge.getSrcSmartAccountAddress();
      expect(smartAccountAddress).toBeDefined();
      expect(smartAccountAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);

      console.log(`Smart Account Address: ${smartAccountAddress}`);
      console.log(`EOA Address: ${account.address}`);
    });
  });

  describe("Full Bridge Flow with Smart Account (Integration)", () => {
    it("should complete the full bridging flow using smart account with paymaster", async () => {
      // Create bridge instance with policyId and rpcUrls
      bridge = await CctpBridge.create({
        walletClient: walletClient as Parameters<
          typeof CctpBridge.create
        >[0]["walletClient"],
        srcChain: optimismSepolia,
        destChain: sepolia,
        rpcUrls,
        bundlerRpcUrls,
        policyId: alchemyPolicyId,
      });

      const smartAccountAddress = await bridge.getSrcSmartAccountAddress();

      console.log("Bridge created successfully with Smart Account");
      console.log(`EOA address: ${account.address}`);
      console.log(`Smart Account address: ${smartAccountAddress}`);

      // Step 1: Approve and Burn USDC using Smart Account with Paymaster
      console.log(
        `\nStep 1: Approving and burning ${BRIDGE_AMOUNT} USDC using Smart Account with Paymaster...`,
      );
      // Destination address is the EOA address where USDC will be minted on the destination chain
      const userOpHash = await bridge.approveAndBurnUSDCUsingSmartAccount(
        BRIDGE_AMOUNT,
        account.address, // destination address (EOA on destination chain)
        true, // usePaymaster = true
      );
      console.log(`UserOperation hash: ${userOpHash}`);
      expect(userOpHash).toBeDefined();
      expect(userOpHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Step 2: Wait for UserOperation receipt to get the transaction hash
      console.log("\nStep 2: Waiting for UserOperation receipt...");
      const receipt = await bridge.waitForUserOperation(userOpHash, true);
      console.log(`Transaction hash: ${receipt.receipt.transactionHash}`);
      console.log(`UserOperation success: ${receipt.success}`);
      expect(receipt).toBeDefined();
      expect(receipt.success).toBe(true);
      expect(receipt.receipt.transactionHash).toBeDefined();
      expect(receipt.receipt.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      const burnTxHash = receipt.receipt.transactionHash;

      // Wait 7 seconds before proceeding
      console.log("Waiting 7 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 7000));

      // Step 3: Retrieve attestation from Circle
      console.log("\nStep 3: Waiting for attestation from Circle...");
      console.log("This may take several minutes. Polling every 5 seconds...");
      const attestation = await bridge.retrieveAttestation({
        burnTx: burnTxHash,
      });
      console.log("Attestation received!");
      expect(attestation).toBeDefined();
      expect(attestation.message).toBeDefined();
      expect(attestation.attestation).toBeDefined();

      // Wait 7 seconds before proceeding
      console.log("Waiting 7 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 7000));

      // Step 4: Mint USDC on destination chain using EOA
      console.log("\nStep 4: Minting USDC on destination chain using EOA...");
      const mintTxHash = await bridge.mintUSDC(attestation);
      console.log(`Mint tx hash: ${mintTxHash}`);
      expect(mintTxHash).toBeDefined();
      expect(mintTxHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      console.log("\nBridge flow with Smart Account completed successfully!");
    }, 600000); // 10 minute timeout for the full flow
  });
});
