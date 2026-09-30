import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND} · Mis propinas`,
    short_name: BRAND,
    description: "Recibe propinas con tu tarjeta NFC.",
    start_url: "/panel",
    display: "standalone",
    background_color: "#F4F7F5",
    theme_color: "#0E2A21",
    lang: "es-MX",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
