import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PV Moda Masculina",
    template: "%s | PV Moda Masculina",
  },
  description: "Moda masculina com curadoria local, informação clara e atendimento próximo.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
