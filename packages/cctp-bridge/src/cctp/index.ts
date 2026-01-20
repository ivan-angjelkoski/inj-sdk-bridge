import {
  type WalletClient,
  type Transport,
  type Chain,
  type Account,
  parseUnits,
  padHex,
} from "viem";

import {
  domain,
  tokenMessengerAbi,
  tokenMessengerAddress,
  usdcAbi,
  usdcAddress,
} from "../constants";

type WalletClientAccount = WalletClient<Transport, Chain, Account>;

export class CctpBridge {
  private walletClient: WalletClientAccount;
  private srcChain: Chain;
  private destChain: Chain;

  private constructor(params: {
    srcChain: Chain;
    destChain: Chain;
    walletClient: WalletClientAccount;
  }) {
    this.srcChain = params.srcChain;
    this.destChain = params.destChain;
    this.walletClient = params.walletClient;
  }

  static async create(params: {
    walletClient: WalletClientAccount;
    srcChain: Chain;
    destChain: Chain;
  }) {
    const { walletClient, srcChain, destChain } = params;

    return new CctpBridge({
      walletClient: walletClient,
      srcChain: srcChain,
      destChain: destChain,
    });
  }

  async getPublicClient(chain: Chain, rpcUrl?: string) {
    const { createPublicClient } = await import("viem");
    const { http } = await import("viem");

    return createPublicClient({
      chain: chain,
      transport: http(rpcUrl),
    });
  }

  async getLightSmartAccount(chain: Chain, rpcUrl?: string) {
    const { toLightSmartAccount } = await import("permissionless/accounts");
    const publicClient = await this.getPublicClient(chain, rpcUrl);

    return toLightSmartAccount({
      owner: this.walletClient,
      version: "2.0.0",
      client: publicClient,
    });
  }

  async getBundlerClient(chain: Chain, rpcUrl?: string) {
    const { createBundlerClient } = await import("viem/account-abstraction");
    const { http } = await import("viem");

    return createBundlerClient({
      transport: http(rpcUrl),
      account: await this.getLightSmartAccount(chain, rpcUrl),
      chain: chain,
    });
  }

  async approveUSDC(amount: bigint) {
    this.safeSwitchChain(this.srcChain);
    // approve 1 USDC

    const publicClient = await this.getPublicClient(this.srcChain);

    const hash = await this.walletClient.writeContract({
      abi: usdcAbi,
      address: usdcAddress.optimismSepolia,
      functionName: "approve",
      args: [
        tokenMessengerAddress.optimismSepolia,
        parseUnits(amount.toString(), 6),
      ],
    });

    return await publicClient.waitForTransactionReceipt({ hash });
  }

  async burnUSDC({
    amount,
    destinationAddress,
  }: {
    amount: bigint;
    destinationAddress: `0x${string}`;
  }) {
    this.safeSwitchChain(this.srcChain);

    return await this.walletClient.writeContract({
      abi: tokenMessengerAbi,
      address: tokenMessengerAddress.optimismSepolia,
      functionName: "depositForBurn",
      args: [
        parseUnits(amount.toString(), 6),
        domain.optimismSepolia,
        padHex(destinationAddress, { dir: "left", size: 32 }),
        usdcAddress.optimismSepolia,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        parseUnits("0.0005", 6),
        1000,
      ],
    });
  }

  async retrieveAttestation({
    domain,
    burnTx,
  }: {
    domain: number;
    burnTx: `0x${string}`;
  }) {
    const url = `https://iris-api-sandbox.circle.com/v2/messages/${domain}?transactionHash=${burnTx}`;

    return new Promise<{ message: `0x${string}`; attestation: `0x${string}` }>(
      (resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const response = await fetch(url);
            if (!response.ok) return;

            const data = await response.json();
            if (!data?.messages?.[0]) return;
            if (data.messages[0].status !== "complete") return;

            clearInterval(interval);
            resolve(
              data.messages[0] as {
                message: `0x${string}`;
                attestation: `0x${string}`;
              }
            );
          } catch (error) {
            clearInterval(interval);
            reject(error);
          }
        }, 5000);
      }
    );
  }

  async mintUSDC(attestation: {
    message: `0x${string}`;
    attestation: `0x${string}`;
  }) {
    this.safeSwitchChain(this.destChain);

    return await this.walletClient.writeContract({
      abi: tokenMessengerAbi,
      functionName: "receiveMessage",
      address: tokenMessengerAddress.optimismSepolia,
      args: [attestation.message, attestation.attestation],
    });
  }

  safeSwitchChain(chain: Chain) {
    try {
      this.walletClient.switchChain(chain);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e) {
      console.log("Safelly handled chain switch error");
      // suppress error
    }
  }
}
