import {
  type WalletClient,
  type Transport,
  type Chain,
  type Account,
  parseUnits,
  padHex,
  formatUnits,
} from "viem";

import {
  CCTP_CONTRACTS,
  type CctpContractAddresses,
  tokenMessengerAbi,
  messageTransmitterAbi,
  usdcAbi,
} from "../constants";
import { toOwner } from "permissionless";

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

  private getChainConfig(chain: Chain): CctpContractAddresses {
    const config = CCTP_CONTRACTS[chain.id];
    if (!config) {
      throw new Error(`Unsupported chain: ${chain.name} (id: ${chain.id})`);
    }
    return config;
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

  async getSmartAccount(chain: Chain, rpcUrl?: string) {
    const { toLightSmartAccount } = await import("permissionless/accounts");
    const publicClient = await this.getPublicClient(chain, rpcUrl);

    const owner = await toOwner({
      owner: this.walletClient,
      address: this.walletClient.account.address,
    });

    const smartAccount = await toLightSmartAccount({
      owner,
      client: publicClient,
      version: "2.0.0",
    });

    return smartAccount;
  }

  async getBundlerClient(chain: Chain, rpcUrl?: string) {
    const { createBundlerClient } = await import("viem/account-abstraction");
    const { http } = await import("viem");

    return createBundlerClient({
      transport: http(rpcUrl),
      account: await this.getSmartAccount(chain, rpcUrl),
      chain: chain,
    });
  }

  async approveUSDC(amount: string): Promise<
    | {
        status: "success";
        transactionHash: `0x${string}`;
      }
    | {
        status: "already-approved";
        transactionHash: null;
      }
  > {
    await this.safeSwitchChain(this.srcChain);

    const srcConfig = this.getChainConfig(this.srcChain);
    const publicClient = await this.getPublicClient(this.srcChain);

    const srcAddress = this.walletClient.account.address;

    const allowance = await publicClient.readContract({
      abi: usdcAbi,
      address: srcConfig.usdcAddress,
      functionName: "allowance",
      args: [srcAddress, srcConfig.tokenMessengerV2],
    });

    if (allowance > parseUnits(amount.toString(), 6)) {
      return {
        status: "already-approved",
        transactionHash: null,
      };
    }

    const hash = await this.walletClient.writeContract({
      abi: usdcAbi,
      address: srcConfig.usdcAddress,
      functionName: "approve",
      args: [srcConfig.tokenMessengerV2, parseUnits(amount.toString(), 6)],
    });

    return {
      status: "success",
      transactionHash: hash,
    };
  }

  async burnUSDC({
    amount,
    destinationAddress,
  }: {
    amount: string;
    destinationAddress: `0x${string}`;
  }) {
    await this.safeSwitchChain(this.srcChain);

    const srcConfig = this.getChainConfig(this.srcChain);
    const destConfig = this.getChainConfig(this.destChain);

    return await this.walletClient.writeContract({
      abi: tokenMessengerAbi,
      address: srcConfig.tokenMessengerV2,
      functionName: "depositForBurn",
      args: [
        parseUnits(amount, 6),
        destConfig.domain,
        padHex(destinationAddress, { dir: "left", size: 32 }),
        srcConfig.usdcAddress,
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
    await this.safeSwitchChain(this.destChain);

    const destConfig = this.getChainConfig(this.destChain);

    return await this.walletClient.writeContract({
      abi: messageTransmitterAbi,
      functionName: "receiveMessage",
      address: destConfig.messageTransmitterV2,
      args: [attestation.message, attestation.attestation],
    });
  }

  async safeSwitchChain(chain: Chain) {
    // Check if using a browser wallet (custom transport) by checking transport type
    const transportType = this.walletClient.transport?.type;
    const isBrowserWallet = transportType === "custom";

    if (isBrowserWallet) {
      // Browser wallets support wallet_switchEthereumChain
      try {
        await this.walletClient.switchChain({ id: chain.id });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        await this.walletClient.addChain({ chain });
        await this.walletClient.switchChain({ id: chain.id });
      }
    } else {
      // For HTTP/local transports, recreate the wallet client with the new chain
      const { http, createWalletClient } = await import("viem");

      this.walletClient = createWalletClient({
        chain: chain,
        transport: http(),
        account: this.walletClient.account,
      });
    }
  }

  // async getUSDCAllowance(address: `0x${string}`) {
  //   const publicClient = await this.getPublicClient(this.srcChain);
  //   const srcConfig = this.getChainConfig(this.srcChain);

  //   const allowance = await publicClient.readContract({
  //     abi: usdcAbi,
  //     address: srcConfig.usdcAddress,
  //     functionName: "allowance",
  //     args: [address, srcConfig.tokenMessengerV2],
  //   });

  //   return {
  //     value: allowance,
  //     formatted: formatUnits(allowance, 6),
  //   };
  // }

  async getUSDCBalances(
    accountType: "external" | "smart-account" = "external"
  ) {
    const srcPublicClient = await this.getPublicClient(this.srcChain);
    const destPublicClient = await this.getPublicClient(this.destChain);

    const srcConfig = this.getChainConfig(this.srcChain);
    const destConfig = this.getChainConfig(this.destChain);

    const smartAccount = await this.getSmartAccount(this.srcChain);

    const address =
      accountType === "external"
        ? this.walletClient.account.address
        : smartAccount.address;

    const [
      srcUsdcBalance,
      destUsdcBalance,
      srcNativeBalance,
      destNativeBalance,
    ] = await Promise.all([
      srcPublicClient.readContract({
        abi: usdcAbi,
        address: srcConfig.usdcAddress,
        functionName: "balanceOf",
        args: [address],
      }),

      destPublicClient.readContract({
        abi: usdcAbi,
        address: destConfig.usdcAddress,
        functionName: "balanceOf",
        args: [address],
      }),

      srcPublicClient.getBalance({
        address: address,
      }),

      destPublicClient.getBalance({
        address: address,
      }),
    ]);

    return {
      srcUsdcBalance: {
        value: srcUsdcBalance,
        formatted: formatUnits(srcUsdcBalance, 6),
      },
      destUsdcBalance: {
        value: destUsdcBalance,
        formatted: formatUnits(destUsdcBalance, 6),
      },
      srcNativeBalance: {
        value: srcNativeBalance,
        formatted: formatUnits(srcNativeBalance, 18),
      },
      destNativeBalance: {
        value: destNativeBalance,
        formatted: formatUnits(destNativeBalance, 18),
      },
    };
  }
}
