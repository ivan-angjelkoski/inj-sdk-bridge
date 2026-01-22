import type { BridgeState } from "./types";

/**
 * Storage Repository Interface
 * Abstracts the persistence layer for bridge session state.
 * Implementations can use LocalStorage, IndexedDB, or other storage mechanisms.
 */
export interface StorageRepository {
  /**
   * Save a bridge session state.
   * @param sessionId - Unique session identifier
   * @param state - Complete bridge state to persist
   */
  save(sessionId: string, state: BridgeState): Promise<void>;

  /**
   * Load a bridge session state.
   * @param sessionId - Session identifier to load
   * @returns The stored state, or null if not found
   */
  load(sessionId: string): Promise<BridgeState | null>;

  /**
   * Remove a bridge session from storage.
   * @param sessionId - Session identifier to remove
   */
  remove(sessionId: string): Promise<void>;

  /**
   * List all stored session IDs.
   * @returns Array of session IDs
   */
  listSessions(): Promise<string[]>;
}

/**
 * LocalStorage Repository
 * Browser-based implementation of StorageRepository using localStorage.
 * Includes guards for SSR environments where localStorage is not available.
 */
export class LocalStorageRepository implements StorageRepository {
  private readonly prefix: string;

  /**
   * Create a LocalStorageRepository instance.
   * @param prefix - Key prefix for all stored sessions (default: "cctp-bridge-session-")
   */
  constructor(prefix: string = "cctp-bridge-session-") {
    this.prefix = prefix;
  }

  /**
   * Check if localStorage is available (guards against SSR).
   */
  private isAvailable(): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      const testKey = "__storage_test__";
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the full storage key for a session.
   */
  private getKey(sessionId: string): string {
    return `${this.prefix}${sessionId}`;
  }

  async save(sessionId: string, state: BridgeState): Promise<void> {
    if (!this.isAvailable()) {
      console.warn(
        "[LocalStorageRepository] localStorage not available, skipping save",
      );
      return;
    }

    try {
      const serialized = JSON.stringify(state);
      window.localStorage.setItem(this.getKey(sessionId), serialized);
    } catch (error) {
      console.error("[LocalStorageRepository] Failed to save session:", error);
      throw error;
    }
  }

  async load(sessionId: string): Promise<BridgeState | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const serialized = window.localStorage.getItem(this.getKey(sessionId));
      if (!serialized) {
        return null;
      }
      return JSON.parse(serialized) as BridgeState;
    } catch (error) {
      console.error("[LocalStorageRepository] Failed to load session:", error);
      return null;
    }
  }

  async remove(sessionId: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      window.localStorage.removeItem(this.getKey(sessionId));
    } catch (error) {
      console.error(
        "[LocalStorageRepository] Failed to remove session:",
        error,
      );
    }
  }

  async listSessions(): Promise<string[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const sessions: string[] = [];

    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          const sessionId = key.slice(this.prefix.length);
          sessions.push(sessionId);
        }
      }
    } catch (error) {
      console.error("[LocalStorageRepository] Failed to list sessions:", error);
    }

    return sessions;
  }

  /**
   * Load all stored sessions with their full state.
   * Useful for displaying a list of resumable sessions to the user.
   * @returns Array of stored bridge states
   */
  async loadAllSessions(): Promise<BridgeState[]> {
    const sessionIds = await this.listSessions();
    const sessions: BridgeState[] = [];

    for (const sessionId of sessionIds) {
      const state = await this.load(sessionId);
      if (state) {
        sessions.push(state);
      }
    }

    return sessions;
  }

  /**
   * Clear all stored sessions.
   * Use with caution - this removes all bridge session data.
   */
  async clearAll(): Promise<void> {
    const sessionIds = await this.listSessions();
    for (const sessionId of sessionIds) {
      await this.remove(sessionId);
    }
  }
}

/**
 * Memory Storage Repository
 * In-memory implementation of StorageRepository for testing or SSR contexts.
 */
export class MemoryStorageRepository implements StorageRepository {
  private readonly store = new Map<string, BridgeState>();

  async save(sessionId: string, state: BridgeState): Promise<void> {
    this.store.set(sessionId, state);
  }

  async load(sessionId: string): Promise<BridgeState | null> {
    return this.store.get(sessionId) ?? null;
  }

  async remove(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }

  async listSessions(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}
