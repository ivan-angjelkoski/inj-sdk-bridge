import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { health } from "./routes/health";
import { mint } from "./routes/mint";
import { initRelayerService } from "./services/relayer";

// Load environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const PORT = parseInt(process.env.PORT || "3001", 10);

// Validate required environment variables
if (!PRIVATE_KEY) {
  console.error("ERROR: PRIVATE_KEY environment variable is required");
  process.exit(1);
}

if (!ALCHEMY_API_KEY) {
  console.error("ERROR: ALCHEMY_API_KEY environment variable is required");
  process.exit(1);
}

// Validate private key format
if (!PRIVATE_KEY.startsWith("0x") || PRIVATE_KEY.length !== 66) {
  console.error(
    "ERROR: PRIVATE_KEY must be a 32-byte hex string starting with 0x",
  );
  process.exit(1);
}

// Initialize relayer service
initRelayerService(PRIVATE_KEY as `0x${string}`, ALCHEMY_API_KEY);

// Create Hono app
const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Routes
app.route("/health", health);
app.route("/mint", mint);

// Root endpoint
app.get("/", (c) => {
  return c.json({
    name: "CCTP Relayer",
    version: "1.0.0",
    description: "REST API service for relaying CCTP mint operations",
    endpoints: {
      "GET /health": "Get relayer status and supported chains",
      "POST /mint": "Execute a CCTP mint operation",
    },
  });
});

// Start server
console.log(`CCTP Relayer starting on port ${PORT}...`);

export default {
  port: PORT,
  fetch: app.fetch,
};
