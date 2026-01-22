/// <reference types="vite/client" />
import { describe, it, expect, beforeAll } from "vitest";
import { createWalletClient, http, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { optimismSepolia, sepolia } from "viem/chains";

import { CctpBridge } from "../src/cctp";
import {
  getAlchemyRpcUrls,
  getPimlicoBundlerRpcUrls,
} from "../src/cctp/helpers";
import {
  BridgeOrchestrator,
  BridgeStep,
  MemoryStorageRepository,
} from "../src/orchestrator";

const privateKey = import.meta.env.PRIVATE_KEY as string | undefined;
const alchemyApiKey = import.meta.env.ALCHEMY_API_KEY as string | undefined;
const alchemyPolicyId = import.meta.env.ALCHEMY_POLICY_ID as string | undefined;
const relayerUrl = import.meta.env.RELAYER_URL as string | undefined;

describe("CCTP Bridge Orchestrator Flow with Smart Account", () => {
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

    if (!relayerUrl) {
      throw new Error(
        "RELAYER_URL environment variable is required. Set it in a .env file.",
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

  it("should complete the full smart account flow using BridgeOrchestrator with relayer mint", async () => {
    bridge = await CctpBridge.create({
      walletClient: walletClient as Parameters<
        typeof CctpBridge.create
      >[0]["walletClient"],
      srcChain: optimismSepolia,
      destChain: sepolia,
      rpcUrls,
      bundlerRpcUrls,
      policyId: alchemyPolicyId,
      relayerUrl,
    });

    const smartAccountAddress = await bridge.getSrcSmartAccountAddress();

    console.log("Bridge created successfully with Smart Account");
    console.log(`EOA address: ${account.address}`);
    console.log(`Smart Account address: ${smartAccountAddress}`);
    console.log(`Relayer URL: ${relayerUrl}`);

    const storage = new MemoryStorageRepository();

    const orchestrator = await BridgeOrchestrator.create({
      bridge,
      storage,
      params: {
        mode: "smart-account",
        amount: BRIDGE_AMOUNT,
        destinationAddress: account.address,
        usePaymaster: true,
        mintMode: "relayer",
      },
    });

    orchestrator.subscribe((state) => {
      console.log(`[BridgeOrchestrator] Step: ${state.step}`);
    });

    await orchestrator.execute();

    const state = orchestrator.getState();

    expect(state.step).toBe(BridgeStep.COMPLETED);
    expect(state.mintMode).toBe("relayer");
    expect(state.userOpHash).toBeDefined();
    expect(state.userOpHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(state.userOpReceiptTxHash).toBeDefined();
    expect(state.userOpReceiptTxHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(state.attestation).toBeDefined();
    expect(state.attestation?.message).toBeDefined();
    expect(state.attestation?.attestation).toBeDefined();
    expect(state.mintTxHash).toBeDefined();
    expect(state.mintTxHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(orchestrator.hasError()).toBe(false);

    const sessions = await storage.listSessions();
    expect(sessions).toHaveLength(0);

    console.log(
      "\nBridge flow with Smart Account via BridgeOrchestrator completed successfully!",
    );
  }, 600000);
});
