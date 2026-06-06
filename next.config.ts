import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/**/*': [
      'node_modules/puppeteer-extra-plugin-stealth/**/*',
      'node_modules/puppeteer-extra/**/*'
    ],
  },
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