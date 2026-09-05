/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['shared'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'zod'],
  },
};

module.exports = nextConfig;
