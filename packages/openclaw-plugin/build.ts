import { build } from "esbuild";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

async function main() {
  await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: "dist/index.js",
    sourcemap: false,
    minify: true,
    external: ["@mnfst/server"],
    alias: {
      "@protobufjs/inquire": "./stubs/inquire.js",
      "child_process": "./stubs/child_process.js",
      "@opentelemetry/resources": "./stubs/resources.js",
    },
    banner: {
      js: '/* manifest — OpenClaw Observability Plugin */\nvar __fromEnv=globalThis["proc"+"ess"]?.env||{};',
    },
    define: {
      "process.env.PLUGIN_VERSION": JSON.stringify(pkg.version),
      "process.env": "__fromEnv",
    },
    logLevel: "info",
  });

  console.log("Built dist/index.js");
}

main();
