import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Braga Commerce",
  description: "Base de e-commerce para pequenos comércios locais.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
