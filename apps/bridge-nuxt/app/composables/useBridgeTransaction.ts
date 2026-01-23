import {
  ref,
  shallowRef,
  computed,
  watch,
  onUnmounted,
  isRef,
  type Ref,
  type ShallowRef,
  type ComputedRef,
} from "vue";
import {
  BridgeOrchestrator,
  LocalStorageRepository,
  BridgeStep,
  type BridgeState,
  type BridgeOrchestratorParams,
  type StorageRepository,
  type CctpBridge,
} from "@inj-sdk/cctp-bridge";

/**
 * Options for the useBridgeTransaction composable.
 */
export interface UseBridgeTransactionOptions {
  /**
   * The CctpBridge instance to use for transactions.
   * Can be a direct instance or a Ref/ShallowRef that may initially be null.
   */
  bridge:
    | Ref<CctpBridge | null>
    | ShallowRef<CctpBridge | null>
    | CctpBridge
    | null;

  /**
   * Optional storage repository for session persistence.
   * Defaults to LocalStorageRepository if not provided.
   */
  storage?: StorageRepository;

  /**
   * Optional prefix for LocalStorageRepository session keys.
   * Useful for namespacing sessions by wallet address.
   */
  storagePrefix?:
    | string
    | Ref<string | null | undefined>
    | ShallowRef<string | null | undefined>
    | null;
}

type StoragePrefix = string | null | undefined;

/**
 * Return type for the useBridgeTransaction composable.
 */
export interface UseBridgeTransactionReturn {
  // ============================================
  // Reactive State
  // ============================================

  /**
   * Current active session state.
   * Null if no session is active.
   */
  state: Ref<BridgeState | null>;

  /**
   * All pending sessions from storage.
   * Useful for displaying a "resume session" UI.
   * Contains sessions from all modes (standard and smart-account).
   */
  pendingSessions: Ref<BridgeState[]>;

  // ============================================
  // Computed Helpers
  // ============================================

  /**
   * Whether an async operation is currently in progress.
   */
  isLoading: ComputedRef<boolean>;

  /**
   * Current error message, if any.
   */
  error: ComputedRef<string | null>;

  /**
   * Whether the current session has completed successfully.
   */
  isComplete: ComputedRef<boolean>;

  /**
   * Current step in the bridge flow.
   */
  currentStep: ComputedRef<BridgeStep | null>;

  // ============================================
  // Actions
  // ============================================

  /**
   * Start a new bridge session.
   * Creates a new orchestrator and begins execution.
   *
   * @param params - Parameters for the new session (mode, amount, destinationAddress, mintMode, etc.)
   */
  start: (params: BridgeOrchestratorParams) => Promise<void>;

  /**
   * Continue or retry the current session.
   * If the session has an error, this will retry from the failed step.
   * If the session is paused, this will continue execution.
   */
  execute: () => Promise<void>;

  /**
   * Resume an existing session from storage.
   *
   * @param sessionId - The session ID to resume
   */
  resume: (sessionId: string) => Promise<void>;

  /**
   * Cancel the current session.
   * Removes the session from storage and clears local state.
   */
  cancel: () => Promise<void>;

  /**
   * Reset local state without affecting storage.
   * Useful for clearing the UI without deleting the session.
   */
  reset: () => void;

  // ============================================
  // Session Management
  // ============================================

  /**
   * Refresh the list of pending sessions from storage.
   */
  refreshSessions: () => Promise<void>;

  /**
   * Remove a specific session from storage.
   *
   * @param sessionId - The session ID to remove
   */
  removeSession: (sessionId: string) => Promise<void>;
}

/**
 * Helper to unwrap a value that may be a Ref/ShallowRef or direct value.
 */
function unwrapBridge(
  bridge:
    | Ref<CctpBridge | null>
    | ShallowRef<CctpBridge | null>
    | CctpBridge
    | null,
): CctpBridge | null {
  return toValue(bridge) as CctpBridge | null;
}

/**
 * Create a LocalStorageRepository with an optional prefix.
 */
function createLocalStorageRepository(
  prefix: StoragePrefix,
): LocalStorageRepository {
  return prefix
    ? new LocalStorageRepository(prefix)
    : new LocalStorageRepository();
}

/**
 * Vue 3 Composable for managing CCTP Bridge transactions.
 *
 * This composable provides a complete solution for:
 * - Creating and executing bridge sessions
 * - Persisting session state for browser refresh recovery
 * - Resuming interrupted sessions
 * - Managing multiple pending sessions
 *
 * The composable manages a single active session at a time.
 * For dual-flow UIs (standard + smart account), use the composable twice.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { ref } from 'vue';
 * import { useBridgeTransaction } from '~/composables/useBridgeTransaction';
 *
 * const bridge = ref<CctpBridge | null>(null);
 *
 * // Use composable for each flow type
 * const standard = useBridgeTransaction({ bridge });
 * const smart = useBridgeTransaction({ bridge });
 *
 * // Start a new bridge
 * async function startStandardBridge() {
 *   await standard.start({
 *     mode: 'standard',
 *     amount: '10',
 *     destinationAddress: '0x...',
 *     mintMode: 'relayer',
 *   });
 * }
 *
 * // Resume a pending session
 * async function resumeSession(sessionId: string) {
 *   await standard.resume(sessionId);
 * }
 * </script>
 *
 * <template>
 *   <div v-if="standard.state.value">
 *     <p>Step: {{ standard.currentStep.value }}</p>
 *     <p v-if="standard.isLoading.value">Loading...</p>
 *     <p v-if="standard.error.value">Error: {{ standard.error.value }}</p>
 *     <button @click="standard.execute" :disabled="standard.isLoading.value">
 *       {{ standard.error.value ? 'Retry' : 'Continue' }}
 *     </button>
 *   </div>
 *
 *   <!-- Pending sessions -->
 *   <div v-for="session in standard.pendingSessions.value" :key="session.sessionId">
 *     <button @click="resumeSession(session.sessionId)">
 *       Resume {{ session.mode }} - {{ session.amount }} USDC
 *     </button>
 *   </div>
 * </template>
 * ```
 */
export function useBridgeTransaction(
  options: UseBridgeTransactionOptions,
): UseBridgeTransactionReturn {
  // ============================================
  // Setup
  // ============================================

  const usesCustomStorage = Boolean(options.storage);
  const storagePrefixRef: Ref<StoragePrefix> = isRef(options.storagePrefix)
    ? options.storagePrefix
    : ref(options.storagePrefix);

  // Use provided storage or create default LocalStorageRepository
  const storageRef = shallowRef<StorageRepository>(
    options.storage ?? createLocalStorageRepository(storagePrefixRef.value),
  );

  // Internal orchestrator reference (shallow to avoid deep reactivity)
  const orchestrator = shallowRef<BridgeOrchestrator | null>(null);

  // Track the current unsubscribe function
  let unsubscribe: (() => void) | null = null;

  // ============================================
  // Reactive State
  // ============================================

  const state = ref<BridgeState | null>(null);
  const pendingSessions = ref<BridgeState[]>([]);

  // ============================================
  // Computed Helpers
  // ============================================

  const isLoading = computed(() => state.value?.isLoading ?? false);
  const error = computed(() => state.value?.error ?? null);
  const isComplete = computed(() => state.value?.step === BridgeStep.COMPLETED);
  const currentStep = computed(() => state.value?.step ?? null);

  // ============================================
  // Internal Helpers
  // ============================================

  /**
   * Subscribe to orchestrator state changes.
   */
  function subscribeToOrchestrator(orch: BridgeOrchestrator): void {
    // Clean up previous subscription
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    // Set initial state
    state.value = orch.getState();

    // Subscribe to updates
    unsubscribe = orch.subscribe((newState: BridgeState) => {
      state.value = newState;
    });
  }

  /**
   * Set a new orchestrator and subscribe to it.
   */
  function setOrchestrator(orch: BridgeOrchestrator | null): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    orchestrator.value = orch;

    if (orch) {
      subscribeToOrchestrator(orch);
    } else {
      state.value = null;
    }
  }

  // ============================================
  // Session Management
  // ============================================

  /**
   * Refresh the list of pending sessions from storage.
   */
  async function refreshSessions(): Promise<void> {
    const currentStorage = storageRef.value;
    if (currentStorage instanceof LocalStorageRepository) {
      pendingSessions.value = await currentStorage.loadAllSessions();
    } else {
      // For custom storage implementations, load sessions manually
      const sessionIds = await currentStorage.listSessions();
      const sessions: BridgeState[] = [];
      for (const sessionId of sessionIds) {
        const session = await currentStorage.load(sessionId);
        if (session) {
          sessions.push(session);
        }
      }
      pendingSessions.value = sessions;
    }
  }

  /**
   * Remove a specific session from storage.
   */
  async function removeSession(sessionId: string): Promise<void> {
    await storageRef.value.remove(sessionId);
    await refreshSessions();
  }

  // ============================================
  // Actions
  // ============================================

  /**
   * Start a new bridge session.
   */
  async function start(params: BridgeOrchestratorParams): Promise<void> {
    const bridgeInstance = unwrapBridge(options.bridge);
    if (!bridgeInstance) {
      throw new Error("Bridge not available");
    }

    const orch = await BridgeOrchestrator.create({
      bridge: bridgeInstance,
      storage: storageRef.value,
      params,
    });

    setOrchestrator(orch);

    // Start execution
    await execute();
  }

  /**
   * Continue or retry the current session.
   */
  async function execute(): Promise<void> {
    if (!orchestrator.value) {
      console.warn("[useBridgeTransaction] No active session to execute");
      return;
    }
    await orchestrator.value.execute();
    await refreshSessions();
  }

  /**
   * Resume an existing session from storage.
   */
  async function resume(sessionId: string): Promise<void> {
    const bridgeInstance = unwrapBridge(options.bridge);
    if (!bridgeInstance) {
      throw new Error("Bridge not available");
    }

    const orch = await BridgeOrchestrator.resume({
      bridge: bridgeInstance,
      storage: storageRef.value,
      params: { sessionId },
    });

    if (!orch) {
      console.error(
        "[useBridgeTransaction] Failed to resume session:",
        sessionId,
      );
      return;
    }

    // Check if the session is already complete
    const resumedState = orch.getState();
    if (resumedState.step === BridgeStep.COMPLETED) {
      // Session is already done, remove it from storage and don't show in UI
      await storageRef.value.remove(sessionId);
      await refreshSessions();
      return;
    }

    setOrchestrator(orch);

    // Start execution from where it left off
    await execute();
  }

  /**
   * Cancel the current session.
   */
  async function cancel(): Promise<void> {
    if (orchestrator.value) {
      await orchestrator.value.cancel();
    }
    setOrchestrator(null);
    await refreshSessions();
  }

  /**
   * Reset local state without affecting storage.
   */
  function reset(): void {
    setOrchestrator(null);
  }

  // ============================================
  // Auto-load Sessions
  // ============================================

  watch(storagePrefixRef, async (nextPrefix, previousPrefix) => {
    if (usesCustomStorage || nextPrefix === previousPrefix) {
      return;
    }

    storageRef.value = createLocalStorageRepository(nextPrefix);
    setOrchestrator(null);
    await refreshSessions();
  });

  // Watch for bridge availability and auto-load sessions
  const bridgeRef =
    options.bridge && "value" in options.bridge
      ? options.bridge
      : ref(options.bridge);

  watch(
    bridgeRef,
    async (newBridge) => {
      if (newBridge) {
        await refreshSessions();
      }
    },
    { immediate: true },
  );

  // ============================================
  // Cleanup
  // ============================================

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  });

  // ============================================
  // Return
  // ============================================

  return {
    // State
    state,
    pendingSessions,

    // Computed
    isLoading,
    error,
    isComplete,
    currentStep,

    // Actions
    start,
    execute,
    resume,
    cancel,
    reset,

    // Session management
    refreshSessions,
    removeSession,
  };
}

export default useBridgeTransaction;
