import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/assistant-toolkit',
  serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;
