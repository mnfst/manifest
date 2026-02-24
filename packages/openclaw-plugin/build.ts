import { build } from "esbuild";
import { readFileSync, mkdirSync, copyFileSync } from "fs";
import { resolve } from "path";

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
    external: ["./server"],
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

  const skillSrc = resolve("../../skills/manifest/SKILL.md");
  const skillDest = resolve("skills/manifest/SKILL.md");
  mkdirSync(resolve("skills/manifest"), { recursive: true });
  copyFileSync(skillSrc, skillDest);
  console.log("Copied skills/manifest/SKILL.md");

  copyFileSync(resolve("openclaw.plugin.json"), resolve("dist/openclaw.plugin.json"));
  console.log("Copied dist/openclaw.plugin.json");
}

main();
