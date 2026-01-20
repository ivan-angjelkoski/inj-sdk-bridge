import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 300000, // 5 minutes for blockchain operations
    hookTimeout: 60000, // 1 minute for setup/teardown
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
