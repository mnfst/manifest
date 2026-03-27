import { build } from "esbuild";
import { readFileSync, copyFileSync } from "fs";
import { resolve } from "path";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

async function main() {
  await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    outfile: "dist/index.js",
    platform: "node",
    target: "node20",
    format: "cjs",
    sourcemap: false,
    minify: true,
    external: ["./server"],
    banner: {
      js: "/* manifest-local — OpenClaw Self-Hosted LLM Router */",
    },
    define: {
      "process.env.PLUGIN_VERSION": JSON.stringify(pkg.version),
    },
    logLevel: "info",
  });

  console.log("Built dist/index.js");

  copyFileSync(resolve("openclaw.plugin.json"), resolve("dist/openclaw.plugin.json"));
  console.log("Copied dist/openclaw.plugin.json");
}

main();
