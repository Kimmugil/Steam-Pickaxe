import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

// 내 컴퓨터에서 개발할 때는 한 단계 위 폴더의 .env 를 함께 읽습니다. (Vercel에는 그 파일이 없으므로 영향 없음)
loadEnvConfig("..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  poweredByHeader: false,
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
