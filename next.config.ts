import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "puppeteer", 
    "puppeteer-core",
    "puppeteer-extra", 
    "puppeteer-extra-plugin-stealth",
    "clone-deep",
    "merge-deep",
    "is-plain-object",
    "kind-of",
    "shallow-clone",
    "for-own",
    "arr-union"
  ],
};

export default nextConfig;