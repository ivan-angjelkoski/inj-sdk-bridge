import { Hono } from "hono";
import { getRelayerService } from "../services/relayer";
import { getSupportedChainInfo } from "../config/chains";

const health = new Hono();

health.get("/", async (c) => {
  try {
    const relayer = getRelayerService();
    const supportedChains = getSupportedChainInfo();

    return c.json({
      status: "healthy",
      relayerAddress: relayer.getAddress(),
      supportedChains,
    });
  } catch (error) {
    return c.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

export { health };
