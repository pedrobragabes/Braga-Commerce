import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getMetadataBase } from "../lib/app-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "PV Moda Masculina",
    template: "%s | PV Moda Masculina",
  },
  description: "Moda masculina com curadoria local, informação clara e atendimento próximo.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "PV Moda Masculina",
    title: "PV Moda Masculina",
    description: "Moda masculina com curadoria local, informação clara e atendimento próximo.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "PV Moda Masculina",
    description: "Moda masculina com curadoria local, informação clara e atendimento próximo.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
