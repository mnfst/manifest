import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, join } from "path";

const distPath = resolve(__dirname, "../dist/index.js");
const localModeDistPath = resolve(__dirname, "../dist/local-mode.js");
const subscriptionDistPath = resolve(__dirname, "../dist/subscription.js");
const jsonFileDistPath = resolve(__dirname, "../dist/json-file.js");
const pkgPath = resolve(__dirname, "../package.json");
const backendPkgPath = resolve(__dirname, "../../backend/package.json");

// These tests verify properties of the built bundle.
// They require `npm run build` to have been run first.
const describeIfBuilt = existsSync(distPath) ? describe : describe.skip;

describeIfBuilt("built bundle (dist/index.js)", () => {
  let bundleContent: string;
  let pkg: { version: string };

  beforeAll(() => {
    bundleContent = readFileSync(distPath, "utf-8");
    pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  });

  it("does not contain inlined child_process code", () => {
    // child_process is externalized, and since nothing actually imports it
    // (the transitive dep was via @opentelemetry/resources which is stubbed),
    // it should be completely absent from the bundle.
    expect(bundleContent).not.toContain("execSync");
    expect(bundleContent).not.toContain("spawnSync");
  });

  it("does not contain eval( calls", () => {
    // protobufjs inquire uses: eval("quire".replace(/^/,"re"))
    // Match eval( but not "evaluateX" or similar identifiers
    const evalCalls = bundleContent.match(/\beval\s*\(/g);
    expect(evalCalls).toBeNull();
  });

  it("includes the banner comment", () => {
    expect(bundleContent).toMatch(
      /^\/\* manifest .* OpenClaw LLM Router Plugin \*\//,
    );
  });

  it("does not contain readFile references outside local-mode config", () => {
    // dist/index.js is scanned as a single file by OpenClaw, so it must not
    // contain file-read helpers at all. File I/O lives in sidecar modules.
    expect(bundleContent).not.toMatch(/\breadFileSync\b|\breadFile\b/);
  });

  it("does not contain string concatenation obfuscation", () => {
    expect(bundleContent).not.toContain('"proc"+"ess"');
    expect(bundleContent).not.toContain("__fromEnv");
  });

  it("includes source map reference", () => {
    expect(bundleContent).toContain("//# sourceMappingURL=");
  });

  it("builds local-mode/subscription sidecars", () => {
    expect(existsSync(localModeDistPath)).toBe(true);
    expect(existsSync(subscriptionDistPath)).toBe(true);
    expect(existsSync(jsonFileDistPath)).toBe(true);
  });

  it("local-mode sidecar does not contain readFile references", () => {
    if (!existsSync(localModeDistPath)) return;
    const content = readFileSync(localModeDistPath, "utf-8");
    expect(content).not.toMatch(/\breadFileSync\b|\breadFile\b/);
  });

  it("subscription sidecar does not contain readFile references", () => {
    if (!existsSync(subscriptionDistPath)) return;
    const content = readFileSync(subscriptionDistPath, "utf-8");
    expect(content).not.toMatch(/\breadFileSync\b|\breadFile\b/);
  });

  it("json-file sidecar does not contain fetch references", () => {
    if (!existsSync(jsonFileDistPath)) return;
    const content = readFileSync(jsonFileDistPath, "utf-8");
    expect(content).not.toMatch(/\bfetch\b|\bpost\b|http\.request/i);
  });

  it("dist/backend/ contains no .js.map or .d.ts files", () => {
    const backendDir = resolve(__dirname, "../dist/backend");
    if (!existsSync(backendDir)) return;

    const walk = (dir: string): string[] => {
      const entries = readdirSync(dir, { withFileTypes: true });
      return entries.flatMap((e) =>
        e.isDirectory()
          ? walk(join(dir, e.name))
          : [join(dir, e.name)],
      );
    };

    const files = walk(backendDir);
    const sourceMaps = files.filter((f) => f.endsWith(".js.map"));
    const declarations = files.filter((f) => f.endsWith(".d.ts"));

    expect(sourceMaps).toEqual([]);
    expect(declarations).toEqual([]);
  });

  it("public/ contains no og-image.png", () => {
    const publicDir = resolve(__dirname, "../dist/public");
    if (!existsSync(publicDir)) return;

    const files = readdirSync(publicDir);
    expect(files).not.toContain("og-image.png");
  });

  it("public/fonts/ contains no latin-ext font files", () => {
    const fontsDir = resolve(__dirname, "../dist/public/fonts");
    if (!existsSync(fontsDir)) return;

    const files = readdirSync(fontsDir);
    const latinExtFiles = files.filter((f) => f.includes("latin-ext"));
    expect(latinExtFiles).toEqual([]);
  });
});

describe("build configuration", () => {
  it("package.json includes backend runtime dependencies", () => {
    const pluginPkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      dependencies?: Record<string, string>;
    };
    const backendPkg = JSON.parse(readFileSync(backendPkgPath, "utf-8")) as {
      dependencies?: Record<string, string>;
    };

    const missingOrMismatched = Object.entries(backendPkg.dependencies ?? {})
      .filter(([name]) => !name.startsWith("@types/"))
      .filter(([name, version]) => pluginPkg.dependencies?.[name] !== version)
      .map(([name, version]) => `${name}@${version}`);

    expect(missingOrMismatched).toEqual([]);
  });

  it("build.ts reads version from package.json", () => {
    const buildPath = resolve(__dirname, "../build.ts");
    const buildContent = readFileSync(buildPath, "utf-8");

    // Should reference pkg.version, not a hardcoded string
    expect(buildContent).toContain("pkg.version");
    expect(buildContent).not.toMatch(
      /PLUGIN_VERSION.*['"]5\.0\.0['"]/,
    );
  });

  it("stubs/child_process.js exists and exports a no-op exec", () => {
    const stubPath = resolve(__dirname, "../stubs/child_process.js");
    expect(existsSync(stubPath)).toBe(true);

    const stub = require(stubPath);
    expect(typeof stub.exec).toBe("function");
  });

  it("build.ts externalizes child_process", () => {
    const buildPath = resolve(__dirname, "../build.ts");
    const buildContent = readFileSync(buildPath, "utf-8");

    expect(buildContent).toContain("child_process");
    expect(buildContent).toMatch(/external.*child_process/s);
  });

  it("build.ts keeps ./server as external", () => {
    const buildPath = resolve(__dirname, "../build.ts");
    const buildContent = readFileSync(buildPath, "utf-8");

    expect(buildContent).toContain("./server");
    expect(buildContent).toMatch(/external.*\.\/server/);
  });

  it("openclaw.plugin.json version matches package.json version", () => {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const pluginJsonPath = resolve(__dirname, "../openclaw.plugin.json");
    const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
    expect(pluginJson.version).toBe(pkg.version);
  });
});
