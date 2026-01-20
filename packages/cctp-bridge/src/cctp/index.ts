import {
  type WalletClient,
  type Transport,
  type Chain,
  type Account,
  type PublicClient,
} from "viem";
import {
  createBundlerClient,
  type BundlerClient,
  type SmartAccount,
} from "viem/account-abstraction";

type WalletClientAccount = WalletClient<Transport, Chain, Account>;

export class CctpBridge {
  private smartAccount: SmartAccount;
  private publicClient: PublicClient;
  private walletClient: WalletClientAccount;
  private bundlerClient: BundlerClient;

  private constructor(params: {
    smartAccount: SmartAccount;
    publicClient: PublicClient;
    walletClient: WalletClientAccount;
    bundlerClient: BundlerClient;
  }) {
    this.smartAccount = params.smartAccount;
    this.publicClient = params.publicClient;
    this.walletClient = params.walletClient;
    this.bundlerClient = params.bundlerClient;
  }

  static async create(walletClient: WalletClientAccount) {
    const { createPublicClient, http } = await import("viem");
    const { baseSepolia } = await import("viem/chains");
    const { toLightSmartAccount } = await import("permissionless/accounts");

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    const lightSmartAccount = await toLightSmartAccount({
      owner: walletClient,
      version: "2.0.0",
      client: publicClient,
    });

    const bundlerClient = await createBundlerClient({
      transport: http(),
      account: lightSmartAccount,
      chain: baseSepolia,
    });

    return new CctpBridge({
      smartAccount: lightSmartAccount,
      walletClient: walletClient,
      publicClient: publicClient as PublicClient,
      bundlerClient: bundlerClient,
    });
  }
}
