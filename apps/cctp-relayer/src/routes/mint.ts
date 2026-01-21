import { Hono } from "hono";
import { getRelayerService, RelayerError } from "../services/relayer";
import { validateMintRequest } from "../utils/message";
import { isChainSupported } from "../config/chains";

const mint = new Hono();

mint.post("/", async (c) => {
  try {
    // Parse and validate request body
    const body = await c.req.json();
    const validation = validateMintRequest(body);

    if (!validation.valid) {
      return c.json(
        {
          success: false,
          error: validation.error,
          code: "INVALID_REQUEST" as const,
        },
        400,
      );
    }

    const { message, attestation, destinationChainId } = validation.data;

    // Check if chain is supported
    if (!isChainSupported(destinationChainId)) {
      return c.json(
        {
          success: false,
          error: `Chain ${destinationChainId} is not supported`,
          code: "UNSUPPORTED_CHAIN" as const,
        },
        400,
      );
    }

    // Execute the mint transaction
    const relayer = getRelayerService();
    const result = await relayer.executeMint({
      message,
      attestation,
      destinationChainId,
    });

    return c.json({
      success: true,
      transactionHash: result.transactionHash,
      chainId: result.chainId,
      chainName: result.chainName,
    });
  } catch (error) {
    if (error instanceof RelayerError) {
      const statusCode = error.code === "ALREADY_PROCESSED" ? 409 : 400;
      return c.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        statusCode,
      );
    }

    // Unexpected error
    console.error("Mint endpoint error:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        code: "EXECUTION_FAILED" as const,
      },
      500,
    );
  }
});

export { mint };
