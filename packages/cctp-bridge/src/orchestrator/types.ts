/**
 * Bridge Step Enum
 * Represents the finite states of the CCTP bridging process.
 */
export enum BridgeStep {
  /** Initial state - no action taken yet */
  IDLE = "IDLE",
  /** USDC approval completed (standard mode only) */
  APPROVED = "APPROVED",
  /** USDC burned on source chain (or bundled userOp submitted for smart account) */
  BURNED = "BURNED",
  /** Attestation received from Circle's attestation service */
  ATTESTED = "ATTESTED",
  /** Mint completed on destination chain */
  COMPLETED = "COMPLETED",
}

/**
 * Bridge Mode
 * Determines which execution path the orchestrator follows.
 */
export type BridgeMode = "standard" | "smart-account";

/**
 * Bridge State
 * Complete state representation for the CCTP bridge transaction.
 * This is persisted to storage and used to resume interrupted sessions.
 */
export interface BridgeState {
  /** Current step in the bridging process */
  step: BridgeStep;
  /** Execution mode (standard wallet or smart account) */
  mode: BridgeMode;
  /** Whether an async operation is in progress */
  isLoading: boolean;
  /** Error message if the last operation failed */
  error: string | null;
  /** Unique identifier for this bridge session */
  sessionId: string;

  // Transaction context
  /** Amount of USDC to bridge (human-readable, e.g., "10.5") */
  amount: string;
  /** Destination address to receive USDC on target chain */
  destinationAddress: `0x${string}`;

  // Step artifacts - Standard mode
  /** Transaction hash of the USDC approval (standard mode) */
  approvalTxHash?: string;
  /** Transaction hash of the burn transaction */
  burnTxHash?: string;

  // Step artifacts - Smart account mode
  /** User operation hash (smart account mode) */
  userOpHash?: string;
  /** Transaction hash from user operation receipt (smart account mode) */
  userOpReceiptTxHash?: string;
  /** Whether to use paymaster for gas sponsorship (smart account mode) */
  usePaymaster?: boolean;

  // Attestation data
  /** Attestation data from Circle's API */
  attestation?: {
    message: `0x${string}`;
    attestation: `0x${string}`;
  };

  // Final step
  /** Transaction hash of the mint transaction on destination chain */
  mintTxHash?: string;

  // Metadata
  /** Timestamp when session was created */
  createdAt: number;
  /** Timestamp when session was last updated */
  updatedAt: number;
}

/**
 * Listener callback type for the Observer pattern.
 * Receives the updated state whenever a state change occurs.
 */
export type Listener = (state: BridgeState) => void;

/**
 * Parameters for creating a new BridgeOrchestrator instance.
 */
export interface BridgeOrchestratorParams {
  /** Execution mode */
  mode: BridgeMode;
  /** Amount of USDC to bridge */
  amount: string;
  /** Destination address for receiving USDC */
  destinationAddress: `0x${string}`;
  /** Whether to use paymaster (smart account mode only) */
  usePaymaster?: boolean;
}

/**
 * Parameters for resuming an existing bridge session.
 */
export interface BridgeResumeParams {
  /** Session ID to resume */
  sessionId: string;
}
