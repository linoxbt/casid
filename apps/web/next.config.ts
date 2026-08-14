import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["13.140.188.185"],
  webpack: (config, { webpack }) => {
    // @reown/appkit-adapter-wagmi pulls in wagmi's Coinbase "Base Account"
    // connector, which optionally depends on @coinbase/cdp-sdk's x402
    // payment packages. Casid only targets Flare Coston2 and never exercises
    // that connector/feature, but webpack still tries to statically resolve
    // those imports — ignore them so the build doesn't fail on missing
    // optional peer deps that are genuinely unreachable at runtime here.
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));
    // Same story for wagmi's own experimental "Tempo" chain support, barrel-
    // exported by @wagmi/connectors regardless of which connectors are
    // actually configured — @wagmi/core@3.6.4's tempo/Connectors.js ships
    // with its own broken bare import ("accounts"), and we never use any
    // Tempo hooks/connectors, so stub the whole submodule out at bundle time.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /\/tempo(\.js)?(\/|$)/,
        contextRegExp: /node_modules[\\/]@?wagmi/,
      }),
    );
    return config;
  },
};

export default nextConfig;
