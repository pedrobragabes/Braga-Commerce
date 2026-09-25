import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import { getMetadataBase } from "../lib/app-url";
import "./globals.css";

const storeBodyFont = Manrope({
  variable: "--font-store-body",
  subsets: ["latin"],
  display: "swap",
});

const storeDisplayFont = Bodoni_Moda({
  variable: "--font-store-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "Braga Commerce",
    template: "%s | Braga Commerce",
  },
  description: "Lojas com produtos, informações claras e atendimento direto.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Braga Commerce",
    title: "Braga Commerce",
    description: "Lojas com produtos, informações claras e atendimento direto.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "Braga Commerce",
    description: "Lojas com produtos, informações claras e atendimento direto.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      className={`${storeBodyFont.variable} ${storeDisplayFont.variable}`}
      data-scroll-behavior="smooth"
      lang="pt-BR"
    >
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
