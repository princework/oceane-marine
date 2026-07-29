/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/qhse/moc/risk-assessment", destination: "/qhse/moc/management-change/form", permanent: true },
      { source: "/qhse/moc/risk-assessment/form", destination: "/qhse/moc/management-change/form", permanent: true },
      { source: "/qhse/moc/risk-assessment/list", destination: "/qhse/moc/management-change/list", permanent: true },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb", // Server Actions only — not API routes
    },
    // Requests hit middleware (auth); Next clones the body with a default 10MB cap.
    // Multipart uploads larger than that truncate and fail with "Failed to parse body as FormData."
    proxyClientMaxBodySize: "30mb",
  },
  // If you are using remote images from Cloudinary, you might also need this:
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
