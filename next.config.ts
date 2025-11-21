import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'res.cloudinary.com',
      port: '',
      pathname: '/**', // allow all paths under cloudinary
    },
  ],
}
};

export default nextConfig;
