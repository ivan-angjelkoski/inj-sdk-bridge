import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

export const metadata = {
  title: {
    default: "CCTP Bridge SDK",
    template: "%s | CCTP Bridge SDK",
  },
  description:
    "SDK for bridging USDC between EVM chains using Circle CCTP (Cross-Chain Transfer Protocol)",
};

const navbar = (
  <Navbar
    logo={<b>CCTP Bridge SDK</b>}
    projectLink="https://github.com/InjectiveLabs/inj-sdk"
  />
);

const footer = (
  <Footer>MIT {new Date().getFullYear()} © Injective Labs.</Footer>
);

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pageMap = await getPageMap();

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={pageMap}
          docsRepositoryBase="https://github.com/InjectiveLabs/inj-sdk/tree/main/apps/docs"
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
