/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['shared', 'three', '@react-three/fiber', '@react-three/drei', '@studio-freight/lenis'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'zod', 'three'],
  },
  webpack: (config) => {
    // Handle Three.js addon packages
    config.externals = config.externals || [];
    return config;
  },
};

module.exports = nextConfig;

