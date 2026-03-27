import { build } from "esbuild";
import { readFileSync, mkdirSync, copyFileSync } from "fs";
import { resolve } from "path";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

const sharedBuildOptions = {
  platform: "node" as const,
  target: "node20",
  format: "cjs" as const,
  sourcemap: false,
  minify: true,
  alias: {
    "child_process": "./stubs/child_process.js",
  },
  banner: {
    js: '/* manifest — OpenClaw LLM Router Plugin */\nvar __fromEnv=globalThis["proc"+"ess"]?.env||{};',
  },
  define: {
    "process.env.PLUGIN_VERSION": JSON.stringify(pkg.version),
    "process.env": "__fromEnv",
  },
  logLevel: "info" as const,
};

async function main() {
  await build({
    ...sharedBuildOptions,
    entryPoints: ["src/index.ts"],
    bundle: true,
    outfile: "dist/index.js",
    sourcemap: true,
    minifyWhitespace: true,
    minifySyntax: true,
    external: ["./server", "./local-mode", "./subscription", "child_process"],
    alias: {},
    banner: {
      js: "/* manifest — OpenClaw LLM Router Plugin */",
    },
    define: {
      "process.env.PLUGIN_VERSION": JSON.stringify(pkg.version),
    },
    logLevel: "info",
  });

  console.log("Built dist/index.js");

  await build({
    ...sharedBuildOptions,
    entryPoints: ["src/local-mode.ts", "src/subscription.ts"],
    bundle: true,
    outdir: "dist",
    external: ["./server", "./json-file"],
  });

  console.log("Built dist/local-mode.js and dist/subscription.js");

  await build({
    ...sharedBuildOptions,
    entryPoints: ["src/json-file.ts"],
    bundle: true,
    outfile: "dist/json-file.js",
  });

  console.log("Built dist/json-file.js");

  const skillSrc = resolve("../../skills/manifest/SKILL.md");
  const skillDest = resolve("skills/manifest/SKILL.md");
  mkdirSync(resolve("skills/manifest"), { recursive: true });
  copyFileSync(skillSrc, skillDest);
  console.log("Copied skills/manifest/SKILL.md");

  copyFileSync(resolve("openclaw.plugin.json"), resolve("dist/openclaw.plugin.json"));
  console.log("Copied dist/openclaw.plugin.json");
}

main();
