import type { Metadata } from "next";
import { ThemeToaster } from "@/components/layout/theme-toggle";

import "./globals.css";
import "@/components/editor/taobao-product-preview.css";

import { AppShell } from "@/components/layout/app-shell";
import { ProviderCredentialFetchBridge } from "@/components/layout/provider-credential-fetch-bridge";
import { ThemeScript } from "@/components/layout/theme-script";
import { BackToTopButton } from "@/components/shared/back-to-top-button";
import { BrandConsole } from "@/components/shared/brand-console";
import { ChunkReloadGuard } from "@/components/shared/chunk-reload-guard";

export const metadata: Metadata = {
  title: "MxPage",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/brand-icon.ico",
  },
  description: "MxPage AI product page and social content generation workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeScript />
        <ChunkReloadGuard />
        <BrandConsole />
        <ProviderCredentialFetchBridge />
        <AppShell>{children}</AppShell>
        <BackToTopButton />
        <ThemeToaster />
      </body>
    </html>
  );
}
