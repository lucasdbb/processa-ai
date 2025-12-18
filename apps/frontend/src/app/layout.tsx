import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PageLoadingBar } from "@/components/ui/page-loading-bar";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const rawSiteUrl = (process.env.NEXT_PUBLIC_FRONTEND_URL || "").trim();
const siteUrl = rawSiteUrl || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Processa AI - Ferramentas Jurídicas Inteligentes",
  description: "Plataforma completa com ferramentas de IA, calculadoras jurídicas e blog legal para profissionais do direito.",
  keywords: ["direito", "jurídico", "IA", "calculadoras", "advocacia"],
};

// Force dynamic rendering for all pages to preserve auth cookies
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <Suspense fallback={null}>
          <PageLoadingBar />
        </Suspense>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
