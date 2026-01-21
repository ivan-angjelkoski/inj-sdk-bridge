import { keccak256, encodePacked } from "viem";

/**
 * CCTP Message Format (V1):
 *
 * Field                 Bytes      Type       Index
 * version               4          uint32     0
 * sourceDomain          4          uint32     4
 * destinationDomain     4          uint32     8
 * nonce                 8          uint64     12
 * sender                32         bytes32    20
 * recipient             32         bytes32    52
 * destinationCaller     32         bytes32    84
 * messageBody           dynamic    bytes      116
 */

export interface ParsedCctpMessage {
  version: number;
  sourceDomain: number;
  destinationDomain: number;
  nonce: bigint;
  sender: `0x${string}`;
  recipient: `0x${string}`;
  destinationCaller: `0x${string}`;
}

/**
 * Parse a CCTP message to extract key fields
 */
export function parseCctpMessage(message: `0x${string}`): ParsedCctpMessage {
  // Remove 0x prefix
  const bytes = message.slice(2);

  if (bytes.length < 232) {
    // 116 bytes * 2 (hex chars per byte)
    throw new Error("Invalid CCTP message: too short");
  }

  // Parse fields from hex string (each hex char = 4 bits, 2 chars = 1 byte)
  const version = parseInt(bytes.slice(0, 8), 16); // bytes 0-3
  const sourceDomain = parseInt(bytes.slice(8, 16), 16); // bytes 4-7
  const destinationDomain = parseInt(bytes.slice(16, 24), 16); // bytes 8-11
  const nonce = BigInt("0x" + bytes.slice(24, 40)); // bytes 12-19
  const sender = ("0x" + bytes.slice(40, 104)) as `0x${string}`; // bytes 20-51
  const recipient = ("0x" + bytes.slice(104, 168)) as `0x${string}`; // bytes 52-83
  const destinationCaller = ("0x" + bytes.slice(168, 232)) as `0x${string}`; // bytes 84-115

  return {
    version,
    sourceDomain,
    destinationDomain,
    nonce,
    sender,
    recipient,
    destinationCaller,
  };
}

/**
 * Compute the nonce hash used by MessageTransmitter to track used nonces.
 * The contract uses: keccak256(abi.encodePacked(sourceDomain, nonce))
 */
export function hashSourceAndNonce(
  sourceDomain: number,
  nonce: bigint,
): `0x${string}` {
  return keccak256(encodePacked(["uint32", "uint64"], [sourceDomain, nonce]));
}

/**
 * Validate that a hex string is properly formatted
 */
export function isValidHexString(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]+$/.test(value);
}

/**
 * Validate mint request parameters
 */
export function validateMintRequest(body: unknown):
  | {
      valid: true;
      data: {
        message: `0x${string}`;
        attestation: `0x${string}`;
        destinationChainId: number;
      };
    }
  | {
      valid: false;
      error: string;
    } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be an object" };
  }

  const { message, attestation, destinationChainId } = body as Record<
    string,
    unknown
  >;

  if (typeof message !== "string" || !isValidHexString(message)) {
    return { valid: false, error: "Invalid message: must be a hex string" };
  }

  if (typeof attestation !== "string" || !isValidHexString(attestation)) {
    return {
      valid: false,
      error: "Invalid attestation: must be a hex string",
    };
  }

  if (
    typeof destinationChainId !== "number" ||
    !Number.isInteger(destinationChainId)
  ) {
    return {
      valid: false,
      error: "Invalid destinationChainId: must be an integer",
    };
  }

  return {
    valid: true,
    data: {
      message: message as `0x${string}`,
      attestation: attestation as `0x${string}`,
      destinationChainId,
    },
  };
}
