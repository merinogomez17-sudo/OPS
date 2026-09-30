import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--f-display", subsets: ["latin"], weight: ["600", "700", "800"] });
const body = Figtree({ variable: "--f-body", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const mono = JetBrains_Mono({ variable: "--f-mono", subsets: ["latin"], weight: ["500"] });

export const metadata: Metadata = {
  title: { default: `${BRAND} · Propinas con un toque`, template: `%s · ${BRAND}` },
  description: "Deja propina acercando tu celular. Sin descargar ninguna app.",
  appleWebApp: { capable: true, title: BRAND, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0E2A21",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
