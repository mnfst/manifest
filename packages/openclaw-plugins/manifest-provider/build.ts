import { build } from "esbuild";
import { readFileSync, mkdirSync, copyFileSync } from "fs";
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
    sourcemap: true,
    minifyWhitespace: true,
    minifySyntax: true,
    banner: {
      js: "/* manifest — OpenClaw LLM Router Plugin */",
    },
    define: {
      "process.env.PLUGIN_VERSION": JSON.stringify(pkg.version),
    },
    logLevel: "info",
  });

  console.log("Built dist/index.js");

  const skillSrc = resolve("../../../skills/manifest/SKILL.md");
  const skillDest = resolve("skills/manifest/SKILL.md");
  mkdirSync(resolve("skills/manifest"), { recursive: true });
  copyFileSync(skillSrc, skillDest);
  console.log("Copied skills/manifest/SKILL.md");

  copyFileSync(resolve("openclaw.plugin.json"), resolve("dist/openclaw.plugin.json"));
  console.log("Copied dist/openclaw.plugin.json");
}

main();
