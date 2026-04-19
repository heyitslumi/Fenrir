/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@workspace/ui"],
  typescript: {
    ignoreBuildErrors: true
  },
}

export default nextConfig
