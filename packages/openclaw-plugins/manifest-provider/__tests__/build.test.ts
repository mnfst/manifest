import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const distPath = resolve(__dirname, "../dist/index.js");
const pkgPath = resolve(__dirname, "../package.json");

// These tests verify properties of the built bundle.
// They require `npm run build` to have been run first.
const describeIfBuilt = existsSync(distPath) ? describe : describe.skip;

describeIfBuilt("built bundle (dist/index.js)", () => {
  let bundleContent: string;

  beforeAll(() => {
    bundleContent = readFileSync(distPath, "utf-8");
  });

  it("does not contain inlined child_process code", () => {
    expect(bundleContent).not.toContain("execSync");
    expect(bundleContent).not.toContain("spawnSync");
  });

  it("does not contain eval( calls", () => {
    const evalCalls = bundleContent.match(/\beval\s*\(/g);
    expect(evalCalls).toBeNull();
  });

  it("includes the banner comment", () => {
    expect(bundleContent).toMatch(
      /^\/\* manifest .* OpenClaw LLM Router Plugin \*\//,
    );
  });

  it("does not contain string concatenation obfuscation", () => {
    expect(bundleContent).not.toContain('"proc"+"ess"');
    expect(bundleContent).not.toContain("__fromEnv");
  });

  it("includes source map reference", () => {
    expect(bundleContent).toContain("//# sourceMappingURL=");
  });

  it("does not contain embedded server code", () => {
    // Cloud plugin should not include NestJS or server bootstrapping
    expect(bundleContent).not.toContain("NestFactory");
    expect(bundleContent).not.toContain("MANIFEST_EMBEDDED");
  });

  it("does not ship local-mode sidecars", () => {
    expect(existsSync(resolve(__dirname, "../dist/local-mode.js"))).toBe(false);
    expect(existsSync(resolve(__dirname, "../dist/server.js"))).toBe(false);
    expect(existsSync(resolve(__dirname, "../dist/backend"))).toBe(false);
  });

  it("does not contain subscription discovery code", () => {
    expect(bundleContent).not.toContain("discoverSubscriptionProviders");
    expect(bundleContent).not.toContain("registerSubscriptionProviders");
    expect(bundleContent).not.toContain("supportsSubscriptionProvider");
  });
});

describe("build configuration", () => {
  it("build.ts reads version from package.json", () => {
    const buildPath = resolve(__dirname, "../build.ts");
    const buildContent = readFileSync(buildPath, "utf-8");

    expect(buildContent).toContain("pkg.version");
    expect(buildContent).not.toMatch(
      /PLUGIN_VERSION.*['"]5\.0\.0['"]/,
    );
  });

  it("openclaw.plugin.json version matches package.json version", () => {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const pluginJsonPath = resolve(__dirname, "../openclaw.plugin.json");
    const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
    expect(pluginJson.version).toBe(pkg.version);
  });

  it("openclaw.plugin.json declares manifest provider", () => {
    const pluginJsonPath = resolve(__dirname, "../openclaw.plugin.json");
    const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
    expect(pluginJson.providers).toEqual(["manifest"]);
  });

  it("package.json does not include backend dependencies", () => {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = Object.keys(pkg.dependencies || {});
    expect(deps).not.toContain("@nestjs/core");
    expect(deps).not.toContain("typeorm");
    expect(deps).not.toContain("sql.js");
    expect(deps).not.toContain("pg");
  });
});
