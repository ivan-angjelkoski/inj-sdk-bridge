import { CctpBridge } from "../cctp";
import type { StorageRepository } from "./storage";
import {
  BridgeStep,
  type BridgeState,
  type BridgeMode,
  type Listener,
  type BridgeOrchestratorParams,
  type BridgeResumeParams,
} from "./types";

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get error message from unknown error type.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unknown error occurred";
}

/**
 * BridgeOrchestrator
 *
 * Framework-agnostic class implementing the Finite State Machine (FSM) + Observer pattern
 * for managing CCTP bridge transactions.
 *
 * Key Features:
 * - Observer Pattern: UI components subscribe to state changes via callbacks
 * - Persistence: State is saved to storage after every transition for session resumption
 * - Idempotent Execution: The execute() method can be called multiple times safely
 * - Dual Mode: Supports both standard wallet flow and smart account flow
 *
 * @example
 * ```typescript
 * // Create a new bridge session
 * const orchestrator = await BridgeOrchestrator.create({
 *   bridge: cctpBridge,
 *   storage: new LocalStorageRepository(),
 *   params: {
 *     mode: 'standard',
 *     amount: '10',
 *     destinationAddress: '0x...'
 *   }
 * });
 *
 * // Subscribe to state updates
 * const unsubscribe = orchestrator.subscribe((state) => {
 *   console.log('State updated:', state.step);
 * });
 *
 * // Execute the bridge flow
 * await orchestrator.execute();
 *
 * // Cleanup
 * unsubscribe();
 * ```
 */
export class BridgeOrchestrator {
  private state: BridgeState;
  private listeners: Listener[] = [];
  private bridge: CctpBridge;
  private storage: StorageRepository;

  /**
   * Private constructor - use static factory methods instead.
   */
  private constructor(
    bridge: CctpBridge,
    storage: StorageRepository,
    initialState: BridgeState,
  ) {
    this.bridge = bridge;
    this.storage = storage;
    this.state = initialState;
  }

  /**
   * Create a new bridge session.
   *
   * @param options.bridge - CctpBridge instance for executing transactions
   * @param options.storage - Storage repository for persistence
   * @param options.params - Parameters for the new bridge session
   * @returns Initialized BridgeOrchestrator instance
   */
  static async create(options: {
    bridge: CctpBridge;
    storage: StorageRepository;
    params: BridgeOrchestratorParams;
  }): Promise<BridgeOrchestrator> {
    const { bridge, storage, params } = options;

    const now = Date.now();
    const sessionId = generateSessionId();

    const initialState: BridgeState = {
      step: BridgeStep.IDLE,
      mode: params.mode,
      isLoading: false,
      error: null,
      sessionId,
      amount: params.amount,
      destinationAddress: params.destinationAddress,
      usePaymaster: params.usePaymaster ?? true,
      createdAt: now,
      updatedAt: now,
    };

    const orchestrator = new BridgeOrchestrator(bridge, storage, initialState);

    // Persist initial state
    await storage.save(sessionId, initialState);

    return orchestrator;
  }

  /**
   * Resume an existing bridge session from storage.
   *
   * @param options.bridge - CctpBridge instance for executing transactions
   * @param options.storage - Storage repository for persistence
   * @param options.params - Resume parameters containing the session ID
   * @returns Initialized BridgeOrchestrator instance, or null if session not found
   */
  static async resume(options: {
    bridge: CctpBridge;
    storage: StorageRepository;
    params: BridgeResumeParams;
  }): Promise<BridgeOrchestrator | null> {
    const { bridge, storage, params } = options;

    const state = await storage.load(params.sessionId);
    if (!state) {
      return null;
    }

    // Clear any previous error state when resuming
    const resumedState: BridgeState = {
      ...state,
      error: null,
      isLoading: false,
    };

    const orchestrator = new BridgeOrchestrator(bridge, storage, resumedState);

    return orchestrator;
  }

  // ============================================
  // Observer Pattern Implementation
  // ============================================

  /**
   * Subscribe to state updates.
   *
   * @param listener - Callback function invoked on every state change
   * @returns Unsubscribe function to remove the listener
   */
  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get a snapshot of the current state.
   * Returns a frozen copy to prevent external mutations.
   */
  getState(): BridgeState {
    return Object.freeze({ ...this.state });
  }

  /**
   * Notify all subscribed listeners of the current state.
   */
  private notify(): void {
    const stateCopy = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(stateCopy);
      } catch (error) {
        console.error("[BridgeOrchestrator] Listener error:", error);
      }
    }
  }

  // ============================================
  // State Management
  // ============================================

  /**
   * Update state atomically.
   * Performs three actions:
   * 1. Merge new state into current state
   * 2. Notify all listeners
   * 3. Persist to storage (fire-and-forget)
   *
   * @param partial - Partial state to merge
   */
  private async updateState(partial: Partial<BridgeState>): Promise<void> {
    // 1. Merge state
    this.state = {
      ...this.state,
      ...partial,
      updatedAt: Date.now(),
    };

    // 2. Notify listeners
    this.notify();

    // 3. Persist to storage (don't block UI updates)
    this.storage.save(this.state.sessionId, this.state).catch((error) => {
      console.error("[BridgeOrchestrator] Failed to persist state:", error);
    });
  }

  /**
   * Set loading state and clear any previous errors.
   */
  private async setLoading(isLoading: boolean): Promise<void> {
    await this.updateState({
      isLoading,
      error: isLoading ? null : this.state.error,
    });
  }

  /**
   * Set error state and stop loading.
   */
  private async setError(error: string): Promise<void> {
    await this.updateState({
      error,
      isLoading: false,
    });
  }

  // ============================================
  // Execution Flow
  // ============================================

  /**
   * Map steps to handlers based on bridge mode.
   */
  private getFlowMap(
    mode: BridgeMode,
  ): Partial<Record<BridgeStep, () => Promise<void>>> {
    if (mode === "standard") {
      return {
        [BridgeStep.IDLE]: () => this.stepApprove(),
        [BridgeStep.APPROVED]: () => this.stepBurn(),
        [BridgeStep.BURNED]: () => this.stepAttest(),
        [BridgeStep.ATTESTED]: () => this.stepMint(),
      };
    }

    return {
      [BridgeStep.IDLE]: () => this.stepApproveAndBurn(),
      [BridgeStep.BURNED]: () => this.stepAttest(),
      [BridgeStep.ATTESTED]: () => this.stepMintViaRelayer(),
    };
  }

  /**
   * Execute a flow by walking the step map.
   */
  private async executeFlow(mode: BridgeMode): Promise<void> {
    const flow = this.getFlowMap(mode);
    const maxTransitions = Object.keys(flow).length + 1;

    for (let transitions = 0; transitions < maxTransitions; transitions += 1) {
      const currentStep = this.state.step;
      const handler = flow[currentStep];

      if (!handler) {
        if (currentStep !== BridgeStep.COMPLETED) {
          console.warn(
            "[BridgeOrchestrator] No handler for step:",
            currentStep,
          );
        }
        break;
      }

      await handler();

      if (this.state.step === currentStep) {
        console.warn("[BridgeOrchestrator] Step did not advance:", currentStep);
        break;
      }
    }

    if (this.state.step === BridgeStep.COMPLETED) {
      await this.cleanup();
    }
  }

  /**
   * Execute the bridge flow.
   *
   * This method is idempotent - it checks the current step and proceeds
   * from there. Safe to call multiple times (e.g., for retry after error).
   *
   * The flow depends on the mode:
   *
   * Standard Mode:
   * IDLE -> APPROVED -> BURNED -> ATTESTED -> COMPLETED
   *
   * Smart Account Mode:
   * IDLE -> BURNED -> ATTESTED -> COMPLETED
   * (Approve and Burn are bundled in a single UserOp)
   */
  async execute(): Promise<void> {
    // Don't start if already loading
    if (this.state.isLoading) {
      console.warn("[BridgeOrchestrator] Already executing, skipping");
      return;
    }

    // Clear previous errors
    await this.updateState({ error: null });

    try {
      await this.executeFlow(this.state.mode);
    } catch (error) {
      await this.setError(getErrorMessage(error));
    }
  }

  // ============================================
  // Individual Steps - Standard Flow
  // ============================================

  /**
   * Step: Approve USDC spending.
   */
  private async stepApprove(): Promise<void> {
    await this.setLoading(true);

    const result = await this.bridge.approveUSDC(this.state.amount);

    const updateData: Partial<BridgeState> = {
      step: BridgeStep.APPROVED,
      isLoading: false,
    };

    if (result.transactionHash) {
      updateData.approvalTxHash = result.transactionHash;
    }

    await this.updateState(updateData);
  }

  /**
   * Step: Burn USDC on source chain.
   */
  private async stepBurn(): Promise<void> {
    await this.setLoading(true);

    const burnTxHash = await this.bridge.burnUSDC({
      amount: this.state.amount,
      destinationAddress: this.state.destinationAddress,
    });

    await this.updateState({
      step: BridgeStep.BURNED,
      burnTxHash,
      isLoading: false,
    });
  }

  /**
   * Step: Retrieve attestation from Circle.
   */
  private async stepAttest(): Promise<void> {
    await this.setLoading(true);

    // Use the appropriate tx hash based on mode
    const txHash =
      this.state.mode === "smart-account"
        ? this.state.userOpReceiptTxHash
        : this.state.burnTxHash;

    if (!txHash) {
      throw new Error("No burn transaction hash available for attestation");
    }

    const attestation = await this.bridge.retrieveAttestation({
      burnTx: txHash as `0x${string}`,
    });

    await this.updateState({
      step: BridgeStep.ATTESTED,
      attestation,
      isLoading: false,
    });
  }

  /**
   * Step: Mint USDC on destination chain.
   */
  private async stepMint(): Promise<void> {
    if (!this.state.attestation) {
      throw new Error("No attestation available for minting");
    }

    await this.setLoading(true);

    const mintTxHash = await this.bridge.mintUSDC(this.state.attestation);

    await this.updateState({
      step: BridgeStep.COMPLETED,
      mintTxHash,
      isLoading: false,
    });
  }

  // ============================================
  // Individual Steps - Smart Account Flow
  // ============================================

  /**
   * Step: Approve and Burn USDC using Smart Account (bundled UserOp).
   */
  private async stepApproveAndBurn(): Promise<void> {
    await this.setLoading(true);

    const usePaymaster = this.state.usePaymaster ?? true;

    const userOpHash = await this.bridge.approveAndBurnUSDCUsingSmartAccount(
      this.state.amount,
      this.state.destinationAddress,
      usePaymaster,
    );

    await this.updateState({
      userOpHash,
    });

    // Wait for the user operation to be confirmed
    const receipt = await this.bridge.waitForUserOperation(
      userOpHash,
      usePaymaster,
    );

    await this.updateState({
      step: BridgeStep.BURNED,
      userOpReceiptTxHash: receipt.receipt.transactionHash,
      isLoading: false,
    });
  }

  /**
   * Step: Mint USDC via Relayer (for smart account flow).
   */
  private async stepMintViaRelayer(): Promise<void> {
    if (!this.state.attestation) {
      throw new Error("No attestation available for minting");
    }

    await this.setLoading(true);

    const result = await this.bridge.mintUSDCViaRelayer(this.state.attestation);

    if (!result.success) {
      throw new Error(result.error || "Relayer returned an error");
    }

    await this.updateState({
      step: BridgeStep.COMPLETED,
      mintTxHash: result.transactionHash,
      isLoading: false,
    });
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Clean up completed session from storage.
   */
  private async cleanup(): Promise<void> {
    // Remove from storage after successful completion
    await this.storage.remove(this.state.sessionId);
  }

  /**
   * Get the session ID for this orchestrator.
   */
  getSessionId(): string {
    return this.state.sessionId;
  }

  /**
   * Check if the bridge flow is complete.
   */
  isComplete(): boolean {
    return this.state.step === BridgeStep.COMPLETED;
  }

  /**
   * Check if there's an error that needs to be addressed.
   */
  hasError(): boolean {
    return this.state.error !== null;
  }

  /**
   * Cancel the current session.
   * Removes the session from storage without completing it.
   */
  async cancel(): Promise<void> {
    await this.storage.remove(this.state.sessionId);
    await this.updateState({
      step: BridgeStep.IDLE,
      isLoading: false,
      error: "Session cancelled",
    });
  }
}
