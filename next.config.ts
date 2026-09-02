import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.1.7"],
  // Cabeceras de seguridad en toda respuesta, assets estáticos incluidos.
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
