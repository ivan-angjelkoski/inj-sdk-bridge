import {
  type WalletClient,
  type Transport,
  type Chain,
  type Account,
  parseUnits,
  padHex,
  formatUnits,
  type Call,
} from "viem";

import {
  CCTP_CONTRACTS,
  type CctpContractAddresses,
  tokenMessengerAbi,
  messageTransmitterAbi,
  usdcAbi,
} from "../constants";

import { walletClientToAccount } from "./helpers";

type WalletClientAccount = WalletClient<Transport, Chain, Account>;

export class CctpBridge {
  private walletClient: WalletClientAccount;
  private srcChain: Chain;
  private destChain: Chain;
  private rpcUrls: Record<number, string>;
  private bundlerRpcUrls: Record<number, string>;
  private policyId: string | undefined;
  private relayerUrl: string | undefined;

  private constructor(params: {
    srcChain: Chain;
    destChain: Chain;
    walletClient: WalletClientAccount;
    rpcUrls: Record<number, string>;
    bundlerRpcUrls: Record<number, string>;
    policyId: string | undefined;
    relayerUrl: string | undefined;
  }) {
    this.srcChain = params.srcChain;
    this.destChain = params.destChain;
    this.walletClient = params.walletClient;
    this.rpcUrls = params.rpcUrls;
    this.bundlerRpcUrls = params.bundlerRpcUrls;
    this.policyId = params.policyId;
    this.relayerUrl = params.relayerUrl;
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
    rpcUrls?: Record<number, string>;
    bundlerRpcUrls?: Record<number, string>;
    policyId?: string;
    relayerUrl?: string;
  }) {
    const {
      srcChain,
      policyId,
      destChain,
      walletClient,
      rpcUrls = {},
      bundlerRpcUrls = {},
      relayerUrl,
    } = params;

    return new CctpBridge({
      walletClient: walletClient,
      srcChain: srcChain,
      destChain: destChain,
      rpcUrls,
      bundlerRpcUrls,
      policyId,
      relayerUrl,
    });
  }

  async getPublicClient(chain: Chain, rpcUrl?: string) {
    const { createPublicClient } = await import("viem");
    const { http } = await import("viem");

    const _rpcUrl = this.rpcUrls[chain.id] || rpcUrl || undefined;

    return createPublicClient({
      chain: chain,
      transport: http(_rpcUrl),
    });
  }

  async getSmartAccount(chain: Chain, rpcUrl?: string) {
    const { toLightSmartAccount } = await import("permissionless/accounts");

    // const _rpcUrl = this.rpcUrls[chain.id] || rpcUrl || undefined;

    const publicClient = await this.getPublicClient(chain, rpcUrl);

    // const owner = await toOwner({
    //   owner: this.walletClient,
    //   address: this.walletClient.account.address,
    // });

    const owner = walletClientToAccount(this.walletClient);

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

    const _rpcUrl = this.bundlerRpcUrls[chain.id] || rpcUrl || undefined;

    return createBundlerClient({
      transport: http(_rpcUrl),
      account: await this.getSmartAccount(chain, rpcUrl),
      chain: chain,
    });
  }

  async getPaymasterClient(chain: Chain, rpcUrl?: string) {
    const { createPaymasterClient } = await import("viem/account-abstraction");
    const { http } = await import("viem");

    const _rpcUrl = this.rpcUrls[chain.id] || rpcUrl || undefined;

    return createPaymasterClient({
      transport: http(_rpcUrl),
    });
  }

  async getBundlerWithPaymasterClient(chain: Chain, rpcUrl?: string) {
    if (!this.policyId) {
      throw new Error("Policy ID is not set");
    }

    const { createBundlerClient } = await import("viem/account-abstraction");
    const { http } = await import("viem");
    const _rpcUrl = this.bundlerRpcUrls[chain.id] || rpcUrl || undefined;

    const paymasterContext = await this.getPaymasterContext();
    const paymaster = await this.getPaymasterClient(chain);

    const publicClient = await this.getPublicClient(chain);

    return createBundlerClient({
      account: await this.getSmartAccount(chain),
      client: publicClient,
      transport: http(_rpcUrl),
      paymasterContext,
      paymaster,
    });
  }

  async getPaymasterContext() {
    if (!this.policyId) {
      throw new Error("Policy ID is not set");
    }

    return {
      policyId: this.policyId,
    };
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

  /**
   * Mint USDC via a relayer service instead of executing the transaction directly.
   * This is useful when the user doesn't have native gas tokens on the destination chain.
   *
   * @param attestation - The message and attestation from Circle's attestation service
   * @param relayerUrl - The URL of the CCTP relayer service (default: http://localhost:3001)
   * @returns The transaction result from the relayer
   */
  async mintUSDCViaRelayer(attestation: {
    message: `0x${string}`;
    attestation: `0x${string}`;
  }): Promise<
    | {
        success: true;
        transactionHash: `0x${string}`;
        chainId: number;
        chainName: string;
      }
    | {
        success: false;
        error: string;
        code: string;
      }
  > {
    // Validate destination chain is supported
    this.getChainConfig(this.destChain);

    if (!this.relayerUrl) {
      throw new Error("Relayer URL is not set");
    }

    const response = await fetch(`${this.relayerUrl}/mint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: attestation.message,
        attestation: attestation.attestation,
        destinationChainId: this.destChain.id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || "Unknown error from relayer",
        code: result.code || "UNKNOWN_ERROR",
      };
    }

    return {
      success: true,
      transactionHash: result.transactionHash as `0x${string}`,
      chainId: result.chainId as number,
      chainName: result.chainName as string,
    };
  }

  async getAddress() {
    const [address] = await this.walletClient.getAddresses();

    if (!address) {
      throw new Error("No address found");
    }

    return address;
  }

  async getSrcSmartAccountAddress() {
    const bundlerClient = await this.getSmartAccount(this.srcChain);
    return bundlerClient.address;
  }

  async getDestSmartAccountAddress() {
    const bundlerClient = await this.getSmartAccount(this.destChain);
    return bundlerClient.address;
  }

  async approveAndBurnUSDCUsingSmartAccount(
    amount: string,
    destinationAddress: `0x${string}`,
    usePaymaster: boolean = true
  ) {
    const publicClient = await this.getPublicClient(this.srcChain);
    const bundlerClient = usePaymaster
      ? await this.getBundlerWithPaymasterClient(this.srcChain)
      : await this.getBundlerClient(this.srcChain);

    const smartAccountAddress = bundlerClient.account.address;

    const allowance = await publicClient.readContract({
      abi: usdcAbi,
      address: this.getChainConfig(this.srcChain).usdcAddress,
      functionName: "allowance",
      args: [
        smartAccountAddress,
        this.getChainConfig(this.srcChain).tokenMessengerV2,
      ],
    });

    const userHasEnoughAllowance = allowance > parseUnits(amount.toString(), 6);

    const calls: Call[] = [];

    if (!userHasEnoughAllowance) {
      calls.push({
        to: this.getChainConfig(this.srcChain).usdcAddress,
        abi: usdcAbi,
        functionName: "approve",
        args: [
          this.getChainConfig(this.srcChain).tokenMessengerV2,
          parseUnits(amount.toString(), 6),
        ],
      });
    }

    calls.push({
      to: this.getChainConfig(this.srcChain).tokenMessengerV2,
      abi: tokenMessengerAbi,
      functionName: "depositForBurn",
      args: [
        parseUnits(amount.toString(), 6),
        this.getChainConfig(this.destChain).domain,
        padHex(destinationAddress, { dir: "left", size: 32 }),
        this.getChainConfig(this.srcChain).usdcAddress,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        parseUnits("0.0005", 6),
        1000,
      ],
    });

    const userOperation = await bundlerClient.sendUserOperation({
      calls,
    });

    return userOperation;
  }

  async waitForUserOperation(
    userOpHash: `0x${string}`,
    usePaymaster: boolean = true
  ) {
    const bundlerClient = usePaymaster
      ? await this.getBundlerWithPaymasterClient(this.srcChain)
      : await this.getBundlerClient(this.srcChain);

    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });

    return receipt;
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
