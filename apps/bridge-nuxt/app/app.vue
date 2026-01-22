<script setup lang="ts">
import {
  CctpBridge,
  getAlchemyRpcUrls,
  getPimlicoBundlerRpcUrls,
  BridgeStep,
  type BridgeState,
} from "@inj-sdk/cctp-bridge";
import {
  createWalletClient,
  custom,
  type Chain,
  type EIP1193Provider,
} from "viem";
import { optimismSepolia, sepolia } from "viem/chains";
import type { BridgeStep as UIBridgeStep, StepStatus } from "~/types/bridge";
import { useBridgeTransaction } from "~/composables/useBridgeTransaction";

const runtimeConfig = useRuntimeConfig();

// Core bridge instance - use shallowRef for class instances to avoid deep reactivity
const bridge = shallowRef<CctpBridge | null>(null);

// Use composable for each flow type
const standard = useBridgeTransaction({ bridge });
const smart = useBridgeTransaction({ bridge });

// Balances
type Balances = Awaited<
  ReturnType<typeof CctpBridge.prototype.getUSDCBalances>
>;
const balances = ref<{
  externalBalances: Balances;
  externalAddress: string;
  smartAccountAddress: string;
  smartAccountBalances: Balances;
}>();

// Initialize wallet and bridge on mount
onMounted(async () => {
  const [address] = await (window as any).ethereum.request({
    method: "eth_requestAccounts",
  });
  if (!address) {
    throw new Error("No address found");
  }

  bridge.value = await CctpBridge.create({
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

// ============================================
// Pending Sessions (combined from both composables)
// ============================================

// Filter pending sessions by mode for each panel
const standardPendingSessions = computed(() =>
  standard.pendingSessions.value.filter((s) => s.mode === "standard"),
);

const smartPendingSessions = computed(() =>
  smart.pendingSessions.value.filter((s) => s.mode === "smart-account"),
);

// All pending sessions for the banner
const allPendingSessions = computed(() => standard.pendingSessions.value);

// ============================================
// State to UI Steps Conversion
// ============================================

function stateToStandardSteps(state: BridgeState | null): UIBridgeStep[] {
  if (!state) {
    return [
      { id: "approve", label: "Approve USDC", status: "idle" },
      { id: "burn", label: "Burn USDC", status: "idle" },
      { id: "attest", label: "Retrieve Attestation", status: "idle" },
      { id: "mint", label: "Mint USDC", status: "idle" },
    ];
  }

  const getApproveStatus = (): StepStatus => {
    if (state.step === BridgeStep.IDLE && state.isLoading) return "pending";
    if (state.step === BridgeStep.IDLE && state.error) return "error";
    if (state.step !== BridgeStep.IDLE) return "success";
    return "idle";
  };

  const getBurnStatus = (): StepStatus => {
    if (state.step === BridgeStep.APPROVED && state.isLoading) return "pending";
    if (state.step === BridgeStep.APPROVED && state.error) return "error";
    if (
      [BridgeStep.BURNED, BridgeStep.ATTESTED, BridgeStep.COMPLETED].includes(
        state.step,
      )
    )
      return "success";
    return "idle";
  };

  const getAttestStatus = (): StepStatus => {
    if (state.step === BridgeStep.BURNED && state.isLoading) return "pending";
    if (state.step === BridgeStep.BURNED && state.error) return "error";
    if ([BridgeStep.ATTESTED, BridgeStep.COMPLETED].includes(state.step))
      return "success";
    return "idle";
  };

  const getMintStatus = (): StepStatus => {
    if (state.step === BridgeStep.ATTESTED && state.isLoading) return "pending";
    if (state.step === BridgeStep.ATTESTED && state.error) return "error";
    if (state.step === BridgeStep.COMPLETED) return "success";
    return "idle";
  };

  return [
    {
      id: "approve",
      label: "Approve USDC",
      status: getApproveStatus(),
      detail: state.approvalTxHash
        ? {
            label: "Tx hash",
            value: formatHash(state.approvalTxHash),
            href: buildTxLink(optimismSepolia, state.approvalTxHash),
          }
        : undefined,
    },
    {
      id: "burn",
      label: "Burn USDC",
      status: getBurnStatus(),
      detail: state.burnTxHash
        ? {
            label: "Tx hash",
            value: formatHash(state.burnTxHash),
            href: buildTxLink(optimismSepolia, state.burnTxHash),
          }
        : undefined,
    },
    {
      id: "attest",
      label: "Retrieve Attestation",
      status: getAttestStatus(),
      detail: state.attestation
        ? { label: "Message", value: formatHash(state.attestation.message) }
        : undefined,
    },
    {
      id: "mint",
      label: "Mint USDC",
      status: getMintStatus(),
      detail: state.mintTxHash
        ? {
            label: "Tx hash",
            value: formatHash(state.mintTxHash),
            href: buildTxLink(sepolia, state.mintTxHash),
          }
        : undefined,
    },
  ];
}

function stateToSmartSteps(state: BridgeState | null): UIBridgeStep[] {
  if (!state) {
    return [
      {
        id: "approve-burn",
        label: "Approve + Burn (Smart Account)",
        status: "idle",
      },
      { id: "userop", label: "Wait for User Operation", status: "idle" },
      { id: "attest", label: "Retrieve Attestation", status: "idle" },
      { id: "mint", label: "Mint via Relayer", status: "idle" },
    ];
  }

  const getApproveBurnStatus = (): StepStatus => {
    if (
      state.step === BridgeStep.IDLE &&
      state.isLoading &&
      !state.userOpReceiptTxHash
    )
      return "pending";
    if (state.step === BridgeStep.IDLE && state.error) return "error";
    if (state.userOpHash && !state.userOpReceiptTxHash) return "success";
    if (state.userOpReceiptTxHash) return "success";
    return "idle";
  };

  const getUserOpStatus = (): StepStatus => {
    if (state.userOpHash && !state.userOpReceiptTxHash && state.isLoading)
      return "pending";
    if (state.userOpReceiptTxHash) return "success";
    return "idle";
  };

  const getAttestStatus = (): StepStatus => {
    if (state.step === BridgeStep.BURNED && state.isLoading) return "pending";
    if (state.step === BridgeStep.BURNED && state.error) return "error";
    if ([BridgeStep.ATTESTED, BridgeStep.COMPLETED].includes(state.step))
      return "success";
    return "idle";
  };

  const getMintStatus = (): StepStatus => {
    if (state.step === BridgeStep.ATTESTED && state.isLoading) return "pending";
    if (state.step === BridgeStep.ATTESTED && state.error) return "error";
    if (state.step === BridgeStep.COMPLETED) return "success";
    return "idle";
  };

  return [
    {
      id: "approve-burn",
      label: "Approve + Burn (Smart Account)",
      status: getApproveBurnStatus(),
      detail: state.userOpHash
        ? { label: "UserOp", value: formatHash(state.userOpHash) }
        : undefined,
    },
    {
      id: "userop",
      label: "Wait for User Operation",
      status: getUserOpStatus(),
      detail: state.userOpReceiptTxHash
        ? {
            label: "Tx hash",
            value: formatHash(state.userOpReceiptTxHash),
            href: buildTxLink(optimismSepolia, state.userOpReceiptTxHash),
          }
        : undefined,
    },
    {
      id: "attest",
      label: "Retrieve Attestation",
      status: getAttestStatus(),
      detail: state.attestation
        ? { label: "Message", value: formatHash(state.attestation.message) }
        : undefined,
    },
    {
      id: "mint",
      label: "Mint via Relayer",
      status: getMintStatus(),
      detail: state.mintTxHash
        ? {
            label: "Tx hash",
            value: formatHash(state.mintTxHash),
            href: buildTxLink(sepolia, state.mintTxHash),
          }
        : undefined,
    },
  ];
}

// Computed UI steps
const standardSteps = computed(() =>
  stateToStandardSteps(standard.state.value),
);
const smartSteps = computed(() => stateToSmartSteps(smart.state.value));

// ============================================
// Utility Functions
// ============================================

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

// ============================================
// Actions
// ============================================

async function fetchBalances() {
  if (!bridge.value) {
    throw new Error("Bridge not found");
  }

  const smartAccountAddress = await bridge.value.getSrcSmartAccountAddress();
  const externalAddress = await bridge.value.getAddress();

  const externalBalances = await bridge.value.getUSDCBalances("external");
  const smartAccountBalances =
    await bridge.value.getUSDCBalances("smart-account");

  balances.value = {
    externalBalances,
    externalAddress,
    smartAccountAddress,
    smartAccountBalances,
  };
}

/**
 * Start a new standard bridge flow.
 */
async function handleStandardBridge() {
  if (!bridge.value) {
    throw new Error("Bridge not found");
  }

  const address = await bridge.value.getAddress();

  await standard.start({
    mode: "standard",
    amount: "0.01",
    destinationAddress: address,
  });
}

/**
 * Start a new smart account bridge flow.
 */
async function handleSmartBridge() {
  if (!bridge.value) {
    throw new Error("Bridge not found");
  }

  const externalAddress = await bridge.value.getAddress();

  await smart.start({
    mode: "smart-account",
    amount: "0.01",
    destinationAddress: externalAddress,
    usePaymaster: true,
  });
}

/**
 * Resume a pending session (routes to correct composable based on mode).
 */
async function resumeSession(session: BridgeState) {
  if (session.mode === "standard") {
    await standard.resume(session.sessionId);
  } else {
    await smart.resume(session.sessionId);
  }
}

/**
 * Handle standard bridge action button click.
 */
function handleStandardAction() {
  if (standard.error.value) {
    standard.execute();
  } else if (standard.state.value) {
    standard.execute();
  } else {
    handleStandardBridge();
  }
}

/**
 * Handle smart bridge action button click.
 */
function handleSmartAction() {
  if (smart.error.value) {
    smart.execute();
  } else if (smart.state.value) {
    smart.execute();
  } else {
    handleSmartBridge();
  }
}

// Computed action labels
const standardActionLabel = computed(() => {
  if (!standard.state.value) return "Start Standard Bridge";
  if (standard.error.value) return "Retry";
  return "Continue";
});

const smartActionLabel = computed(() => {
  if (!smart.state.value) return "Start Smart Bridge";
  if (smart.error.value) return "Retry";
  return "Continue";
});

// Computed action disabled states
const standardActionDisabled = computed(
  () => standard.isLoading.value || standard.isComplete.value,
);

const smartActionDisabled = computed(
  () => smart.isLoading.value || smart.isComplete.value,
);
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
        <p class="subtitle">
          Minimal dual-flow bridge monitor with Orchestrator pattern.
        </p>
      </div>
      <div class="topbar-actions">
        <span class="chip">Optimism Sepolia → Sepolia</span>
        <button class="btn ghost" @click="fetchBalances">
          Refresh Balances
        </button>
      </div>
    </header>

    <!-- Pending Sessions Banner -->
    <div v-if="allPendingSessions.length > 0" class="pending-banner">
      <h3>Pending Sessions</h3>
      <p>
        You have {{ allPendingSessions.length }} unfinished bridge session(s).
        Click to resume.
      </p>
      <div class="pending-list">
        <button
          v-for="session in allPendingSessions"
          :key="session.sessionId"
          class="btn secondary"
          @click="resumeSession(session)"
        >
          {{ session.mode === "standard" ? "Standard" : "Smart" }} -
          {{ session.amount }} USDC (Step: {{ session.step }})
        </button>
      </div>
    </div>

    <main class="layout">
      <BridgePanel
        title="Standard Bridge"
        description="Approve and burn from the external wallet, then mint on the destination chain."
        :steps="standardSteps"
        :action-label="standardActionLabel"
        :action-disabled="standardActionDisabled"
        :error-message="standard.error.value"
        @action="handleStandardAction"
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
        <template #footer>
          <button
            v-if="standard.isComplete.value"
            class="btn secondary"
            @click="standard.reset()"
          >
            Start New
          </button>
        </template>
      </BridgePanel>

      <BridgePanel
        title="Smart Account Bridge"
        description="Bundle approval and burn into a smart account user operation, then mint via relayer."
        :steps="smartSteps"
        :action-label="smartActionLabel"
        :action-disabled="smartActionDisabled"
        :error-message="smart.error.value"
        @action="handleSmartAction"
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
        <template #footer>
          <button
            v-if="smart.isComplete.value"
            class="btn secondary"
            @click="smart.reset()"
          >
            Start New
          </button>
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

.pending-banner {
  max-width: 1120px;
  margin: 0 auto 24px;
  padding: 16px 20px;
  background: rgba(26, 162, 164, 0.08);
  border: 1px solid rgba(26, 162, 164, 0.2);
  border-radius: var(--radius-sm);
}

.pending-banner h3 {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--accent-strong);
}

.pending-banner p {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--muted);
}

.pending-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
