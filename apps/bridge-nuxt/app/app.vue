<script setup lang="ts">
import {
  CCTP_CONTRACTS,
  CctpBridge,
  getAlchemyRpcUrls,
  getPimlicoBundlerRpcUrls,
} from "@inj-sdk/cctp-bridge";
import {
  createWalletClient,
  custom,
  type Chain,
  type EIP1193Provider,
} from "viem";
import { optimismSepolia, sepolia } from "viem/chains";
import BridgePanel from "~/components/BridgePanel.vue";
import type { BridgeStep, StepDetail, StepStatus } from "~/types/bridge";

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

type Balances = Awaited<
  ReturnType<typeof CctpBridge.prototype.getUSDCBalances>
>;

const balances = ref<{
  externalBalances: Balances;
  externalAddress: string;
  smartAccountAddress: string;
  smartAccountBalances: Balances;
}>();

const standardSteps = ref<BridgeStep[]>([
  { id: "approve", label: "Approve USDC", status: "idle" },
  { id: "burn", label: "Burn USDC", status: "idle" },
  { id: "attest", label: "Retrieve Attestation", status: "idle" },
  { id: "mint", label: "Mint USDC", status: "idle" },
]);

const smartSteps = ref<BridgeStep[]>([
  {
    id: "approve-burn",
    label: "Approve + Burn (Smart Account)",
    status: "idle",
  },
  { id: "userop", label: "Wait for User Operation", status: "idle" },
  { id: "attest", label: "Retrieve Attestation", status: "idle" },
  { id: "mint", label: "Mint via Relayer", status: "idle" },
]);

const standardError = ref<string | null>(null);
const smartError = ref<string | null>(null);

const standardBusy = computed(() =>
  standardSteps.value.some((step) => step.status === "pending"),
);
const smartBusy = computed(() =>
  smartSteps.value.some((step) => step.status === "pending"),
);

function resetSteps(steps: BridgeStep[]) {
  steps.forEach((step) => {
    step.status = "idle";
    step.detail = undefined;
  });
}

function setStepStatus(steps: BridgeStep[], id: string, status: StepStatus) {
  const target = steps.find((step) => step.id === id);
  if (target) {
    target.status = status;
  }
}

function setStepDetail(steps: BridgeStep[], id: string, detail?: StepDetail) {
  const target = steps.find((step) => step.id === id);
  if (target) {
    target.detail = detail;
  }
}

async function runStep<T>(
  steps: BridgeStep[],
  id: string,
  action: () => Promise<T>,
): Promise<T> {
  setStepStatus(steps, id, "pending");
  try {
    const result = await action();
    setStepStatus(steps, id, "success");
    return result;
  } catch (error) {
    setStepStatus(steps, id, "error");
    throw error;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

function formatHash(value: string, prefixLength = 6, suffixLength = 4) {
  if (value.length <= prefixLength + suffixLength) {
    return value;
  }
  return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`;
}

function buildTxLink(chain: Chain, hash?: string) {
  if (!hash) {
    return undefined;
  }
  const explorer = chain.blockExplorers?.default?.url;
  return explorer ? `${explorer}/tx/${hash}` : undefined;
}

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

async function handleBridge() {
  if (!bridge) {
    throw new Error("Bridge not found");
  }

  standardError.value = null;
  resetSteps(standardSteps.value);

  try {
    const address = await bridge.getAddress();

    const approval = await runStep(standardSteps.value, "approve", () =>
      bridge!.approveUSDC("0.01"),
    );

    if (approval.status === "already-approved") {
      setStepDetail(standardSteps.value, "approve", {
        label: "Status",
        value: "Already approved",
      });
    } else {
      setStepDetail(standardSteps.value, "approve", {
        label: "Tx hash",
        value: formatHash(approval.transactionHash),
        href: buildTxLink(optimismSepolia, approval.transactionHash),
      });
    }

    const burn = await runStep(standardSteps.value, "burn", () =>
      bridge!.burnUSDC({
        amount: "0.01",
        destinationAddress: address,
      }),
    );

    setStepDetail(standardSteps.value, "burn", {
      label: "Tx hash",
      value: formatHash(burn),
      href: buildTxLink(optimismSepolia, burn),
    });

    const attestation = await runStep(standardSteps.value, "attest", () =>
      bridge!.retrieveAttestation({
        burnTx: burn,
      }),
    );

    setStepDetail(standardSteps.value, "attest", {
      label: "Message",
      value: formatHash(attestation.message),
    });

    const mint = await runStep(standardSteps.value, "mint", () =>
      bridge!.mintUSDC(attestation),
    );

    setStepDetail(standardSteps.value, "mint", {
      label: "Tx hash",
      value: formatHash(mint),
      href: buildTxLink(sepolia, mint),
    });
  } catch (error) {
    standardError.value = getErrorMessage(error);
  }
}

async function smartAccountBridge() {
  if (!bridge) {
    throw new Error("Bridge not found");
  }

  smartError.value = null;
  resetSteps(smartSteps.value);

  try {
    const externalAddress = await bridge.getAddress();

    const userOpHash = await runStep(smartSteps.value, "approve-burn", () =>
      bridge!.approveAndBurnUSDCUsingSmartAccount(
        "0.01",
        externalAddress,
        true,
      ),
    );

    setStepDetail(smartSteps.value, "approve-burn", {
      label: "UserOp",
      value: formatHash(userOpHash),
    });

    const receipt = await runStep(smartSteps.value, "userop", () =>
      bridge!.waitForUserOperation(userOpHash, true),
    );

    const userOpTx = receipt.receipt.transactionHash;
    setStepDetail(smartSteps.value, "userop", {
      label: "Tx hash",
      value: formatHash(userOpTx),
      href: buildTxLink(optimismSepolia, userOpTx),
    });

    const attestation = await runStep(smartSteps.value, "attest", () =>
      bridge!.retrieveAttestation({
        burnTx: receipt.receipt.transactionHash,
      }),
    );

    setStepDetail(smartSteps.value, "attest", {
      label: "Message",
      value: formatHash(attestation.message),
    });

    const mint = await runStep(smartSteps.value, "mint", async () => {
      const result = await bridge!.mintUSDCViaRelayer(attestation);
      if (!result.success) {
        throw new Error(result.error || "Relayer returned an error");
      }
      return result;
    });

    setStepDetail(smartSteps.value, "mint", {
      label: "Tx hash",
      value: formatHash(mint.transactionHash),
      href: buildTxLink(sepolia, mint.transactionHash),
    });
  } catch (error) {
    smartError.value = getErrorMessage(error);
  }
}
</script>

<template>
  <div class="page">
    <NuxtRouteAnnouncer />
    <header class="topbar">
      <div>
        <div class="brand">
          <span class="brand-mark">Inj</span>
          <span class="brand-name">CCTP Bridge</span>
        </div>
        <p class="subtitle">Minimal dual-flow bridge monitor.</p>
      </div>
      <div class="topbar-actions">
        <span class="chip">Optimism Sepolia → Sepolia</span>
        <button class="btn ghost" @click="fetchBalances">
          Refresh Balances
        </button>
      </div>
    </header>

    <main class="layout">
      <BridgePanel
        title="Standard Bridge"
        description="Approve and burn from the external wallet, then mint on the destination chain."
        :steps="standardSteps"
        action-label="Start Standard Bridge"
        :action-disabled="standardBusy"
        :error-message="standardError"
        @action="handleBridge"
      >
        <template #meta>
          <div class="meta-grid">
            <div class="meta-card">
              <p class="meta-label">Amount</p>
              <p class="meta-value">0.01 USDC</p>
            </div>
            <div class="meta-card">
              <p class="meta-label">Route</p>
              <p class="meta-value">Optimism Sepolia → Sepolia</p>
            </div>
          </div>
          <div class="wallet-card">
            <div class="wallet-header">
              <span>External Wallet</span>
              <span class="chip light">Standard</span>
            </div>
            <p class="wallet-address">
              {{ balances?.externalAddress ?? "Not fetched" }}
            </p>
            <div class="wallet-stats">
              <div class="wallet-stat">
                <span class="wallet-label">USDC</span>
                <span class="wallet-value">
                  {{
                    balances?.externalBalances?.srcUsdcBalance?.formatted ?? "—"
                  }}
                </span>
              </div>
              <div class="wallet-stat">
                <span class="wallet-label">Native</span>
                <span class="wallet-value">
                  {{
                    balances?.externalBalances?.srcNativeBalance?.formatted ??
                    "—"
                  }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </BridgePanel>

      <BridgePanel
        title="Smart Account Bridge"
        description="Bundle approval and burn into a smart account user operation, then mint via relayer."
        :steps="smartSteps"
        action-label="Start Smart Bridge"
        :action-disabled="smartBusy"
        :error-message="smartError"
        @action="smartAccountBridge"
      >
        <template #meta>
          <div class="meta-grid">
            <div class="meta-card">
              <p class="meta-label">Amount</p>
              <p class="meta-value">0.01 USDC</p>
            </div>
            <div class="meta-card">
              <p class="meta-label">Execution</p>
              <p class="meta-value">Bundled UserOp</p>
            </div>
          </div>
          <div class="wallet-card">
            <div class="wallet-header">
              <span>Smart Account</span>
              <span class="chip light">Smart</span>
            </div>
            <p class="wallet-address">
              {{ balances?.smartAccountAddress ?? "Not fetched" }}
            </p>
            <div class="wallet-stats">
              <div class="wallet-stat">
                <span class="wallet-label">USDC</span>
                <span class="wallet-value">
                  {{
                    balances?.smartAccountBalances?.srcUsdcBalance?.formatted ??
                    "—"
                  }}
                </span>
              </div>
              <div class="wallet-stat">
                <span class="wallet-label">Native</span>
                <span class="wallet-value">
                  {{
                    balances?.smartAccountBalances?.srcNativeBalance
                      ?.formatted ?? "—"
                  }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </BridgePanel>
    </main>
  </div>
</template>

<style>
@import url("https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap");

:root {
  color-scheme: light;
  --bg: #f4f7fb;
  --surface: #ffffff;
  --surface-muted: #f1f5f9;
  --border: #dbe3ee;
  --text: #0f172a;
  --muted: #5b6b84;
  --accent: #1aa2a4;
  --accent-strong: #117b7c;
  --shadow-sm: 0 10px 28px rgba(15, 23, 42, 0.08);
  --shadow-lg: 0 24px 60px rgba(15, 23, 42, 0.12);
  --radius: 20px;
  --radius-sm: 14px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Sora", "Helvetica Neue", "Segoe UI", sans-serif;
  background:
    radial-gradient(1200px 520px at 10% -10%, #e0f7f6 0%, transparent 60%),
    radial-gradient(900px 480px at 90% -20%, #e9eefb 0%, transparent 60%),
    var(--bg);
  color: var(--text);
}

button {
  font: inherit;
}

.btn {
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 10px 18px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}

.btn.primary {
  background: var(--accent);
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(26, 162, 164, 0.22);
}

.btn.primary:hover {
  background: var(--accent-strong);
  transform: translateY(-1px);
}

.btn.secondary {
  background: #ffffff;
  border-color: var(--border);
  color: var(--text);
}

.btn.secondary:hover {
  border-color: var(--accent);
  color: var(--accent-strong);
  transform: translateY(-1px);
}

.btn.ghost {
  background: transparent;
  border-color: var(--border);
  color: var(--muted);
}

.btn.ghost:hover {
  color: var(--text);
  border-color: var(--text);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}
</style>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32px 24px 64px;
  animation: fadeIn 0.6s ease;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1120px;
  margin: 0 auto 36px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--text);
  color: #ffffff;
  font-size: 16px;
}

.brand-name {
  font-size: 18px;
}

.chip {
  padding: 6px 12px;
  border-radius: 999px;
  background: #101828;
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
}

.chip.light {
  background: var(--surface-muted);
  color: var(--text);
}

.subtitle {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.layout {
  max-width: 1120px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.meta-card {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.meta-label {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--muted);
}

.meta-value {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.wallet-card {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--surface-muted);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wallet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 14px;
}

.wallet-address {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #ffffff;
  font-size: 12px;
  color: #334155;
  word-break: break-all;
  font-family: "IBM Plex Mono", "SFMono-Regular", "Menlo", monospace;
}

.wallet-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}

.wallet-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.wallet-label {
  color: var(--muted);
}

.wallet-value {
  font-weight: 600;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 720px) {
  .topbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .topbar-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
