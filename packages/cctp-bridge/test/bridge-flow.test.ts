/// <reference types="vite/client" />
import { describe, it, expect, beforeAll } from "vitest";
import { createWalletClient, http, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { optimismSepolia, sepolia } from "viem/chains";

import { CctpBridge } from "../src/cctp";
import { CCTP_CONTRACTS } from "../src/constants";

const privateKey = import.meta.env.PRIVATE_KEY as string | undefined;

describe("CCTP Bridge Flow", () => {
  let bridge: CctpBridge;
  let walletClient: WalletClient;
  let account: ReturnType<typeof privateKeyToAccount>;

  const BRIDGE_AMOUNT = "0.01"; // 1 USDC (will be converted to 6 decimals in the contract)

  beforeAll(() => {
    if (!privateKey) {
      throw new Error(
        "PRIVATE_KEY environment variable is required. Set it in a .env file."
      );
    }

    // Ensure private key has 0x prefix
    const formattedKey = privateKey.startsWith("0x")
      ? (privateKey as `0x${string}`)
      : (`0x${privateKey}` as `0x${string}`);

    account = privateKeyToAccount(formattedKey);

    walletClient = createWalletClient({
      chain: optimismSepolia,
      transport: http(),
      account,
    });
  });

  describe("CctpBridge.create", () => {
    it("should create a CctpBridge instance", async () => {
      bridge = await CctpBridge.create({
        walletClient: walletClient as Parameters<
          typeof CctpBridge.create
        >[0]["walletClient"],
        srcChain: optimismSepolia,
        destChain: sepolia,
      });

      expect(bridge).toBeDefined();
      expect(bridge).toBeInstanceOf(CctpBridge);
    });
  });

  describe("Full Bridge Flow (Integration)", () => {
    it("should complete the full bridging flow from optimismSepolia to sepolia", async () => {
      // Create bridge instance
      bridge = await CctpBridge.create({
        walletClient: walletClient as Parameters<
          typeof CctpBridge.create
        >[0]["walletClient"],
        srcChain: optimismSepolia,
        destChain: sepolia,
      });

      console.log("Bridge created successfully");
      console.log(`Account address: ${account.address}`);

      // Step 1: Approve USDC
      console.log(`\nStep 1: Approving ${BRIDGE_AMOUNT} USDC...`);
      const approvalReceipt = await bridge.approveUSDC(BRIDGE_AMOUNT);
      if (approvalReceipt.status === "already-approved") {
        console.log("USDC already approved");
      } else {
        console.log(`Approval tx hash: ${approvalReceipt.transactionHash}`);
      }

      expect(approvalReceipt.status).oneOf(["success", "already-approved"]);

      // Wait 7 seconds before proceeding
      console.log("Waiting 7 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 7000));

      // Step 2: Burn USDC (deposit for burn)
      console.log(`\nStep 2: Burning ${BRIDGE_AMOUNT} USDC...`);
      const burnTxHash = await bridge.burnUSDC({
        amount: BRIDGE_AMOUNT,
        destinationAddress: account.address,
      });
      console.log(`Burn tx hash: ${burnTxHash}`);
      expect(burnTxHash).toBeDefined();
      expect(burnTxHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Wait 7 seconds before proceeding
      console.log("Waiting 7 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 7000));

      // Step 3: Retrieve attestation from Circle
      console.log("\nStep 3: Waiting for attestation from Circle...");
      console.log("This may take several minutes. Polling every 5 seconds...");
      const attestation = await bridge.retrieveAttestation({
        domain: CCTP_CONTRACTS[optimismSepolia.id].domain,
        burnTx: burnTxHash,
      });
      console.log("Attestation received!");
      expect(attestation).toBeDefined();
      expect(attestation.message).toBeDefined();
      expect(attestation.attestation).toBeDefined();

      // Wait 7 seconds before proceeding
      console.log("Waiting 7 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 7000));

      // Step 4: Mint USDC on destination chain
      console.log("\nStep 4: Minting USDC on destination chain...");
      const mintTxHash = await bridge.mintUSDC(attestation);
      console.log(`Mint tx hash: ${mintTxHash}`);
      expect(mintTxHash).toBeDefined();
      expect(mintTxHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      console.log("\n✅ Bridge flow completed successfully!");
    }, 600000); // 10 minute timeout for the full flow
  });

  describe("Public Client", () => {
    it("should create a public client for a given chain", async () => {
      bridge = await CctpBridge.create({
        walletClient: walletClient as Parameters<
          typeof CctpBridge.create
        >[0]["walletClient"],
        srcChain: optimismSepolia,
        destChain: sepolia,
      });

      const publicClient = await bridge.getPublicClient(optimismSepolia);
      expect(publicClient).toBeDefined();

      // Verify it can make calls
      const blockNumber = await publicClient.getBlockNumber();
      expect(blockNumber).toBeGreaterThan(0n);
    });
  });
});
