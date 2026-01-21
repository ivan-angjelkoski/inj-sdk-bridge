<script setup lang="ts">
import {
  CCTP_CONTRACTS,
  CctpBridge,
  getAlchemyRpcUrls,
  getPimlicoBundlerRpcUrls,
} from "@inj-sdk/cctp-bridge";
import { createWalletClient, custom, type EIP1193Provider } from "viem";
import { optimismSepolia, sepolia } from "viem/chains";

const runtimeConfig = useRuntimeConfig();

let bridge: CctpBridge | undefined = undefined;

onMounted(async () => {
  const [address] = await (window as any).ethereum.request({
    method: "eth_requestAccounts",
  });
  if (!address) {
    throw new Error("No address found");
  }

  bridge = await CctpBridge.create({
    srcChain: optimismSepolia,
    destChain: sepolia,
    walletClient: createWalletClient({
      account: address as `0x${string}`,
      chain: optimismSepolia,
      transport: custom((window as any).ethereum as unknown as EIP1193Provider),
    }),

    policyId: runtimeConfig.public.alchemyPolicyId,

    relayerUrl: "http://localhost:3001",

    rpcUrls: getAlchemyRpcUrls({ apiKey: runtimeConfig.public.alchemyApiKey }),
    bundlerRpcUrls: getPimlicoBundlerRpcUrls(),
  });
});

async function handleBridge() {
  if (!bridge) {
    throw new Error("Bridge not found");
  }

  const address = await bridge.getAddress();

  const approve = await bridge.approveUSDC("0.01");

  const burn = await bridge.burnUSDC({
    amount: "0.01",
    destinationAddress: address,
  });

  const attestation = await bridge.retrieveAttestation({
    domain: CCTP_CONTRACTS[optimismSepolia.id]!.domain,
    burnTx: burn,
  });

  const mint = await bridge.mintUSDC(attestation);
}

type Balances = Awaited<
  ReturnType<typeof CctpBridge.prototype.getUSDCBalances>
>;
const balances = ref<{
  externalBalances: Balances;
  externalAddress: string;
  smartAccountAddress: string;
  smartAccountBalances: Balances;
}>();

async function fetchBalances() {
  if (!bridge) {
    throw new Error("Bridge not found");
  }

  const smartAccountAddress = await bridge.getSrcSmartAccountAddress();
  const externalAddress = await bridge.getAddress();

  const externalBalances = await bridge.getUSDCBalances("external");
  const smartAccountBalances = await bridge.getUSDCBalances("smart-account");

  balances.value = {
    externalBalances,
    externalAddress,
    smartAccountAddress,
    smartAccountBalances,
  };
}

async function smartAccountBridge() {
  if (!bridge) {
    throw new Error("Bridge not found");
  }

  const externalAddress = await bridge.getAddress();

  const burn = await bridge.approveAndBurnUSDCUsingSmartAccount(
    "0.01",
    externalAddress,
    true,
  );

  const receipt = await bridge.waitForUserOperation(burn, true);

  const attestation = await bridge.retrieveAttestation({
    domain: CCTP_CONTRACTS[optimismSepolia.id]!.domain,
    burnTx: receipt.receipt.transactionHash,
  });

  const mint = await bridge.mintUSDCViaRelayer(attestation);
}
</script>
<template>
  <div>
    <NuxtRouteAnnouncer />
    <button @click="handleBridge">Handle Bridge</button>
    <button @click="smartAccountBridge">Smart Account Bridge</button>
    <button @click="fetchBalances">Fetch Balances</button>

    <div>
      <fieldset>
        <legend>External Address: {{ balances?.externalAddress }}</legend>
        <p>USDC: {{ balances?.externalBalances.srcUsdcBalance.formatted }}</p>
        <p>
          Native: {{ balances?.externalBalances.srcNativeBalance.formatted }}
        </p>
      </fieldset>

      <fieldset>
        <legend>
          Smart Account Address: {{ balances?.smartAccountAddress }}
        </legend>
        <p>
          USDC: {{ balances?.smartAccountBalances.srcUsdcBalance.formatted }}
        </p>
        <p>
          Native:
          {{ balances?.smartAccountBalances.srcNativeBalance.formatted }}
        </p>
      </fieldset>
    </div>
  </div>
</template>
