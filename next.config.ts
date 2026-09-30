import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite abrir el servidor de desarrollo desde el celular en la misma red WiFi
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
