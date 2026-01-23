# AGENTS.md

This document provides essential information for AI coding agents working in this repository.

## Project Overview

This is a **pnpm monorepo** using **Turborepo** for Circle's CCTP (Cross-Chain Transfer Protocol) USDC bridging across EVM chains. The core SDK is the `CctpBridge` class in `packages/cctp-bridge/src/cctp/index.ts`, which provides the primitives needed to move USDC between chains:

- approve USDC spending on the source chain
- burn USDC via TokenMessenger
- poll Circle's attestation service for the burn proof
- mint on the destination chain (direct or via relayer)
- smart-account flows with bundler + optional paymaster support

The `BridgeOrchestrator` in `packages/cctp-bridge/src/orchestrator/BridgeOrchestrator.ts` builds an FSM around those steps, persists state, and supports resumable standard and smart-account flows. The codebase consists of:

- `packages/cctp-bridge` - Core SDK library for CCTP operations
- `apps/cctp-relayer` - Bun/Hono REST API for gasless minting
- `apps/bridge-nuxt` - Nuxt 4 demo frontend
- `packages/eslint-config` - Shared ESLint configurations
- `packages/typescript-config` - Shared TypeScript configurations

## Build/Lint/Test Commands

### Root Commands (from repo root)

```bash
pnpm run build        # Build all packages via Turborepo
pnpm run dev          # Development mode for all packages
pnpm run lint         # Lint all packages
pnpm run format       # Format code with Prettier
pnpm run check-types  # TypeScript type checking
pnpm run test         # Run tests across all packages
```

### Running a Single Test

```bash
# Run all tests in cctp-bridge package
pnpm --filter @inj-sdk/cctp-bridge test

# Run a specific test file
pnpm --filter @inj-sdk/cctp-bridge exec vitest run test/bridge-flow.test.ts

# Run tests matching a pattern
pnpm --filter @inj-sdk/cctp-bridge exec vitest run -t "should create"

# Watch mode for a specific test
pnpm --filter @inj-sdk/cctp-bridge exec vitest test/bridge-flow.test.ts
```

### Package-Specific Commands

```bash
# cctp-bridge package
cd packages/cctp-bridge
pnpm run build       # tsup build
pnpm run test        # vitest run
pnpm run test:watch  # vitest watch mode

# cctp-relayer app
cd apps/cctp-relayer
pnpm run dev         # bun run --watch src/index.ts
pnpm run build       # bun build

# bridge-nuxt app
cd apps/bridge-nuxt
pnpm run dev         # nuxt dev
pnpm run build       # nuxt build
```

## Code Style Guidelines

### Imports

- Use named imports with explicit type annotations using the `type` keyword:

```typescript
import {
  type WalletClient,
  type Transport,
  type Chain,
  parseUnits,
  formatUnits,
} from "viem";
```

- Order imports: external packages first, then relative imports
- Use relative imports for internal modules: `import { CctpBridge } from "../cctp";`
- Use dynamic imports for code splitting when appropriate

### Naming Conventions

| Type               | Convention                       | Example                                   |
| ------------------ | -------------------------------- | ----------------------------------------- |
| Classes            | PascalCase                       | `CctpBridge`, `BridgeOrchestrator`        |
| Interfaces/Types   | PascalCase                       | `BridgeState`, `CctpContractAddresses`    |
| Functions          | camelCase                        | `getErrorMessage()`, `parseCctpMessage()` |
| Constants          | SCREAMING_SNAKE_CASE             | `CCTP_DOMAINS`, `USDC_MAINNET_ADDRESSES`  |
| Enum values        | SCREAMING_SNAKE_CASE             | `BridgeStep.IDLE`, `BridgeStep.COMPLETED` |
| Private members    | camelCase (no underscore prefix) | `private state`, `private notify()`       |
| Files (TypeScript) | kebab-case                       | `bridge-flow.test.ts`                     |
| Files (Vue/React)  | PascalCase                       | `BridgePanel.vue`                         |

### Types

- Use hex string typing: ``type HexString = `0x${string}`;``
- Use discriminated unions for result types:

```typescript
async approveUSDC(amount: string): Promise<
  | { status: "success"; transactionHash: `0x${string}` }
  | { status: "already-approved"; transactionHash: null }
>
```

- Use validation result patterns:

```typescript
function validateRequest(
  body: unknown,
): { valid: true; data: ValidData } | { valid: false; error: string };
```

### Error Handling

- Create custom error classes with error codes:

```typescript
export class RelayerError extends Error {
  constructor(
    message: string,
    public readonly code: RelayerErrorCode,
  ) {
    super(message);
    this.name = "RelayerError";
  }
}
```

- Use type-safe error message extraction:

```typescript
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unknown error occurred";
}
```

### Documentation

- Use JSDoc with examples for public APIs:

```typescript
/**
 * BridgeOrchestrator
 *
 * Framework-agnostic class implementing the FSM + Observer pattern.
 *
 * @example
 * const orchestrator = await BridgeOrchestrator.create({...});
 */
```

### Testing Patterns

- Use Vitest with environment variables loaded via `loadEnv`:
- Reference Vite client types: `/// <reference types="vite/client" />`
- Access env vars via `import.meta.env.VARIABLE_NAME`
- Long timeouts for blockchain operations (tests can take 5+ minutes)
- Require env vars in `beforeAll` hooks:

```typescript
beforeAll(() => {
  if (!privateKey) throw new Error("PRIVATE_KEY required");
});
```

## TypeScript Configuration

- Strict mode enabled
- `noUncheckedIndexedAccess: true`
- Target: ES2022
- Module: ESNext/NodeNext
- Dual ESM/CJS builds via tsup

## Environment Variables

Required for tests and development (set in `.env` file):

- `PRIVATE_KEY` - Wallet private key for test transactions
- `ALCHEMY_API_KEY` - Alchemy API key for RPC access
- `ALCHEMY_POLICY_ID` / `POLICY_ID` - Paymaster policy ID
- `RELAYER_URL` - URL of the relayer service

## Project Structure

```
inj-sdk/
├── apps/
│   ├── bridge-nuxt/         # Nuxt 4 frontend
│   └── cctp-relayer/        # Bun/Hono REST API
├── packages/
│   ├── cctp-bridge/         # Core SDK library
│   │   ├── src/
│   │   │   ├── cctp/        # CctpBridge class
│   │   │   ├── constants/   # ABIs, addresses, domain IDs
│   │   │   └── orchestrator/# State machine for bridge flows
│   │   └── test/            # Integration tests
│   ├── eslint-config/       # Shared ESLint configs
│   └── typescript-config/   # Shared TS configs
├── turbo.json               # Turborepo configuration
└── pnpm-workspace.yaml      # Workspace definition
```

## Key Libraries

- `viem` - Ethereum library for wallet/contract interactions
- `permissionless` - Smart account (ERC-4337) support
- `vitest` - Test runner
- `tsup` - TypeScript bundler
- `hono` - Web framework for relayer API
- `nuxt` - Vue framework for frontend
