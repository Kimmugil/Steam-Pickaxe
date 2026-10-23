// 내 컴퓨터에서 개발·시험용으로 사이트를 켭니다. 한 단계 위 폴더의 .env 를 읽어 환경변수로 넘겨줍니다.
//   사용법: web 폴더에서  npm run dev     (주소: http://localhost:3000)
// Vercel에서는 이 파일을 쓰지 않습니다. (Vercel 환경변수를 그대로 사용)
import nextEnv from "@next/env";
import { spawn } from "node:child_process";

nextEnv.loadEnvConfig("..");
const port = process.env.PORT ?? "3000";
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", port], { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
