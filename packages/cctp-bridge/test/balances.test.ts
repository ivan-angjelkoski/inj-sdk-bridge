/// <reference types="vite/client" />
import { describe, it, expect, beforeAll } from "vitest";
import { createWalletClient, http, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { optimismSepolia, sepolia } from "viem/chains";

import { CctpBridge } from "../src/cctp";

const privateKey = import.meta.env.PRIVATE_KEY as string | undefined;

describe("CCTP Bridge Balances", () => {
  let bridge: CctpBridge;
  let walletClient: WalletClient;
  let account: ReturnType<typeof privateKeyToAccount>;

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

  describe("getUSDCBalances", () => {
    it("should fetch USDC and native balances for both chains", async () => {
      bridge = await CctpBridge.create({
        walletClient: walletClient as Parameters<
          typeof CctpBridge.create
        >[0]["walletClient"],
        srcChain: optimismSepolia,
        destChain: sepolia,
      });

      const balances = await bridge.getUSDCBalances();
      const address = await bridge.getAddress();

      // Verify structure
      expect(balances).toBeDefined();
      expect(balances.srcUsdcBalance).toBeDefined();
      expect(balances.destUsdcBalance).toBeDefined();
      expect(balances.srcNativeBalance).toBeDefined();
      expect(balances.destNativeBalance).toBeDefined();

      // Verify each balance has value and formatted properties
      expect(balances.srcUsdcBalance.value).toBeDefined();
      expect(balances.srcUsdcBalance.formatted).toBeDefined();
      expect(balances.destUsdcBalance.value).toBeDefined();
      expect(balances.destUsdcBalance.formatted).toBeDefined();
      expect(balances.srcNativeBalance.value).toBeDefined();
      expect(balances.srcNativeBalance.formatted).toBeDefined();
      expect(balances.destNativeBalance.value).toBeDefined();
      expect(balances.destNativeBalance.formatted).toBeDefined();

      // Verify types
      expect(typeof balances.srcUsdcBalance.value).toBe("bigint");
      expect(typeof balances.srcUsdcBalance.formatted).toBe("string");
      expect(typeof balances.destUsdcBalance.value).toBe("bigint");
      expect(typeof balances.destUsdcBalance.formatted).toBe("string");
      expect(typeof balances.srcNativeBalance.value).toBe("bigint");
      expect(typeof balances.srcNativeBalance.formatted).toBe("string");
      expect(typeof balances.destNativeBalance.value).toBe("bigint");
      expect(typeof balances.destNativeBalance.formatted).toBe("string");

      // Log balances for visibility
      console.log(`\nAddress: ${address}`);
      console.log("\nAccount Balances:");
      console.log(`Source Chain (${optimismSepolia.name}):`);
      console.log(`  USDC: ${balances.srcUsdcBalance.formatted}`);
      console.log(`  Native: ${balances.srcNativeBalance.formatted}`);
      console.log(`Destination Chain (${sepolia.name}):`);
      console.log(`  USDC: ${balances.destUsdcBalance.formatted}`);
      console.log(`  Native: ${balances.destNativeBalance.formatted}`);
    });

    it("should fetch USDC and native balances for smart-account", async () => {
      bridge = await CctpBridge.create({
        walletClient: walletClient as Parameters<
          typeof CctpBridge.create
        >[0]["walletClient"],
        srcChain: optimismSepolia,
        destChain: sepolia,
      });

      const balances = await bridge.getUSDCBalances("smart-account");
      const srcSmartAccountAddress = await bridge.getSrcSmartAccountAddress();

      // Verify structure
      expect(balances).toBeDefined();
      expect(balances.srcUsdcBalance).toBeDefined();
      expect(balances.destUsdcBalance).toBeDefined();
      expect(balances.srcNativeBalance).toBeDefined();
      expect(balances.destNativeBalance).toBeDefined();

      // Verify each balance has value and formatted properties
      expect(balances.srcUsdcBalance.value).toBeDefined();
      expect(balances.srcUsdcBalance.formatted).toBeDefined();
      expect(balances.destUsdcBalance.value).toBeDefined();
      expect(balances.destUsdcBalance.formatted).toBeDefined();
      expect(balances.srcNativeBalance.value).toBeDefined();
      expect(balances.srcNativeBalance.formatted).toBeDefined();
      expect(balances.destNativeBalance.value).toBeDefined();
      expect(balances.destNativeBalance.formatted).toBeDefined();

      // Verify types
      expect(typeof balances.srcUsdcBalance.value).toBe("bigint");
      expect(typeof balances.srcUsdcBalance.formatted).toBe("string");
      expect(typeof balances.destUsdcBalance.value).toBe("bigint");
      expect(typeof balances.destUsdcBalance.formatted).toBe("string");
      expect(typeof balances.srcNativeBalance.value).toBe("bigint");
      expect(typeof balances.srcNativeBalance.formatted).toBe("string");
      expect(typeof balances.destNativeBalance.value).toBe("bigint");
      expect(typeof balances.destNativeBalance.formatted).toBe("string");

      // Log balances for visibility
      console.log(`\nSource Smart Account Address: ${srcSmartAccountAddress}`);
      console.log("\nSmart Account Balances:");
      console.log(`Source Chain (${optimismSepolia.name}):`);
      console.log(`  USDC: ${balances.srcUsdcBalance.formatted}`);
      console.log(`  Native: ${balances.srcNativeBalance.formatted}`);
      console.log(`Destination Chain (${sepolia.name}):`);
      console.log(`  USDC: ${balances.destUsdcBalance.formatted}`);
      console.log(`  Native: ${balances.destNativeBalance.formatted}`);
    });
  });
});
