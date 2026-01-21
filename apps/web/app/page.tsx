"use client";

import { useEffect, useRef, useState } from "react";
import { CctpBridge, getAlchemyRpcUrls } from "@inj-sdk/cctp-bridge";
import {
  createWalletClient,
  custom,
  type EIP1193Provider,
} from "viem";
import { baseSepolia, sepolia } from "viem/chains";
import styles from "./page.module.css";

const srcChain = sepolia;
const destChain = baseSepolia;
const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const alchemyRpcUrls = alchemyApiKey
  ? getAlchemyRpcUrls({ apiKey: alchemyApiKey })
  : {};
const rpcUrls: Record<number, string> = alchemyRpcUrls;

type Balances = Awaited<ReturnType<CctpBridge["getUSDCBalances"]>>;

const formatAmount = (value: string, maximumFractionDigits = 6) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return amount.toLocaleString(undefined, { maximumFractionDigits });
};

const getProvider = (): EIP1193Provider | null => {
  if (typeof window === "undefined") return null;
  const { ethereum } = window as Window & { ethereum?: EIP1193Provider };
  return ethereum ?? null;
};

export default function Home() {
  const bridgeRef = useRef<CctpBridge | null>(null);
  const [hasProvider, setHasProvider] = useState<boolean | null>(null);
  const hasAlchemyKey = Boolean(alchemyApiKey);
  const [walletAddress, setWalletAddress] = useState<`0x${string}` | null>(
    null
  );
  const [balances, setBalances] = useState<Balances | null>(null);
  const [statusMessage, setStatusMessage] = useState("Wallet disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    setHasProvider(Boolean(getProvider()));
  }, []);

  const loadBalances = async (bridge = bridgeRef.current) => {
    if (!bridge) {
      setErrorMessage("Connect a wallet to load balances.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await bridge.getUSDCBalances("external");
      setBalances(data);
      setLastUpdated(
        new Date().toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setStatusMessage("Balances updated");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to fetch balances."
      );
      setStatusMessage("Balance fetch failed");
    } finally {
      setIsLoading(false);
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    setErrorMessage(null);

    try {
      if (!alchemyApiKey) {
        setStatusMessage("Alchemy key missing");
        setErrorMessage(
          "ALCHEMY_API_KEY is not configured. Add it to the web app environment."
        );
        return;
      }

      const provider = getProvider();
      if (!provider) {
        setHasProvider(false);
        setStatusMessage("Wallet unavailable");
        setErrorMessage(
          "No Ethereum provider detected. Install a wallet like MetaMask."
        );
        return;
      }

      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];

      const account = accounts?.[0] as `0x${string}` | undefined;

      if (!account) {
        setStatusMessage("Connection failed");
        setErrorMessage("No account returned from provider.");
        return;
      }

      const walletClient = createWalletClient({
        account,
        chain: srcChain,
        transport: custom(provider),
      });

      bridgeRef.current = await CctpBridge.create({
        walletClient,
        srcChain,
        destChain,
        rpcUrls,
      });

      setWalletAddress(account);
      setStatusMessage("Wallet connected");
      await loadBalances(bridgeRef.current);
    } catch (error) {
      setStatusMessage("Connection failed");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to connect wallet."
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "Not connected";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} />
          CCTP Balance Desk
        </div>
        <div className={styles.networkPill}>
          {srcChain.name} to {destChain.name}
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.kicker}>Wallet Sync</p>
          <h1>Connect your wallet and read balances across chains.</h1>
          <p className={styles.subtitle}>
            This view creates a CctpBridge client from a window.ethereum wallet
            and reads USDC plus native balances on both networks.
          </p>

          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              onClick={connectWallet}
              disabled={isConnecting || hasProvider === false}
              type="button"
            >
              {isConnecting
                ? "Connecting..."
                : walletAddress
                  ? "Reconnect wallet"
                  : "Connect wallet"}
            </button>
            <button
              className={styles.secondaryButton}
              onClick={() => loadBalances()}
              disabled={!walletAddress || isLoading}
              type="button"
            >
              {isLoading ? "Refreshing..." : "Refresh balances"}
            </button>
          </div>

          <div className={styles.meta}>
          <div>Provider: {hasProvider ? "Detected" : "Missing"}</div>
          <div>
            RPC: {hasAlchemyKey ? "Alchemy" : "Missing ALCHEMY_API_KEY"}
          </div>
          <div>Status: {statusMessage}</div>
            <div>Account: {shortAddress}</div>
            <div>Updated: {lastUpdated ?? "--"}</div>
          </div>

          {!hasProvider && (
            <div className={styles.notice}>
              Install a browser wallet with window.ethereum to continue.
            </div>
          )}

          {errorMessage && <div className={styles.error}>{errorMessage}</div>}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelTitle}>Wallet overview</p>
              <p className={styles.panelSubtitle}>External account balances</p>
            </div>
            <span className={styles.addressPill}>{shortAddress}</span>
          </div>

          <div className={styles.balanceGrid}>
            <div className={styles.balanceCard}>
              <div className={styles.balanceLabel}>{srcChain.name} USDC</div>
              <div className={styles.balanceValue}>
                {balances
                  ? formatAmount(balances.srcUsdcBalance.formatted, 4)
                  : "--"}
              </div>
              <div className={styles.balanceSub}>
                Native {balances
                  ? formatAmount(balances.srcNativeBalance.formatted, 4)
                  : "--"}
              </div>
            </div>
            <div className={styles.balanceCard}>
              <div className={styles.balanceLabel}>{destChain.name} USDC</div>
              <div className={styles.balanceValue}>
                {balances
                  ? formatAmount(balances.destUsdcBalance.formatted, 4)
                  : "--"}
              </div>
              <div className={styles.balanceSub}>
                Native {balances
                  ? formatAmount(balances.destNativeBalance.formatted, 4)
                  : "--"}
              </div>
            </div>
          </div>

          <div className={styles.panelFooter}>
            CctpBridge reads balances from the selected CCTP networks.
          </div>
        </section>
      </main>
    </div>
  );
}
