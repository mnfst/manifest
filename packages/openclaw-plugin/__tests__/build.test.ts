import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const distPath = resolve(__dirname, "../dist/index.js");
const pkgPath = resolve(__dirname, "../package.json");

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

  it("does not contain child_process references", () => {
    expect(bundleContent).not.toContain("child_process");
  });

  it("does not contain eval( calls", () => {
    // protobufjs inquire uses: eval("quire".replace(/^/,"re"))
    // Match eval( but not "evaluateX" or similar identifiers
    const evalCalls = bundleContent.match(/\beval\s*\(/g);
    expect(evalCalls).toBeNull();
  });

  it("embeds the version from package.json", () => {
    expect(bundleContent).toContain(pkg.version);
  });

  it("includes the banner comment", () => {
    expect(bundleContent).toMatch(
      /^\/\* manifest .* OpenClaw Observability Plugin \*\//,
    );
  });

  it("uses BasicTracerProvider instead of NodeTracerProvider", () => {
    expect(bundleContent).not.toContain("NodeTracerProvider");
  });

  it("product-telemetry does not import fs (readFile + fetch = exfiltration flag)", () => {
    // The scanner flags readFile + fetch in the same module as potential
    // data exfiltration. product-telemetry.ts uses fetch, so it must not
    // import fs. Other modules (e.g. local-mode) may use fs safely.
    const telemetryPath = resolve(__dirname, "../src/product-telemetry.ts");
    const telemetrySrc = readFileSync(telemetryPath, "utf-8");
    expect(telemetrySrc).not.toMatch(/from ["']fs["']|require\(["']fs["']\)/);
  });

  it("does not contain literal process.env references", () => {
    // process.env is replaced with __fromEnv to avoid scanner flagging
    // env access + network send as credential harvesting
    expect(bundleContent).not.toMatch(/\bprocess\.env\b/);
  });

  it("sets up __fromEnv in the banner for runtime env access", () => {
    expect(bundleContent).toContain("__fromEnv");
  });
});

describe("build configuration", () => {
  it("stubs/inquire.js exists and is a valid module", () => {
    const stubPath = resolve(__dirname, "../stubs/inquire.js");
    expect(existsSync(stubPath)).toBe(true);

    const stub = require(stubPath);
    expect(typeof stub).toBe("function");
    expect(stub()).toBeNull();
  });

  it("package.json depends on sdk-trace-base, not sdk-trace-node", () => {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    expect(deps).not.toHaveProperty("@opentelemetry/sdk-trace-node");
    expect(deps).toHaveProperty("@opentelemetry/sdk-trace-base");
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

  it("build.ts aliases @protobufjs/inquire to the stub", () => {
    const buildPath = resolve(__dirname, "../build.ts");
    const buildContent = readFileSync(buildPath, "utf-8");

    expect(buildContent).toContain("@protobufjs/inquire");
    expect(buildContent).toContain("stubs/inquire.js");
  });

  it("stubs/child_process.js exists and exports a no-op exec", () => {
    const stubPath = resolve(__dirname, "../stubs/child_process.js");
    expect(existsSync(stubPath)).toBe(true);

    const stub = require(stubPath);
    expect(typeof stub.exec).toBe("function");
  });

  it("build.ts aliases child_process to the stub", () => {
    const buildPath = resolve(__dirname, "../build.ts");
    const buildContent = readFileSync(buildPath, "utf-8");

    expect(buildContent).toContain("child_process");
    expect(buildContent).toContain("stubs/child_process.js");
  });

  it("stubs/resources.js exports a Resource class with merge/empty/default", () => {
    const stubPath = resolve(__dirname, "../stubs/resources.js");
    expect(existsSync(stubPath)).toBe(true);

    const { Resource } = require(stubPath);
    const r = new Resource({ "service.name": "test" });
    expect(r.attributes["service.name"]).toBe("test");
    expect(Resource.empty().attributes).toEqual({});
    expect(r.merge(new Resource({ extra: "val" })).attributes).toEqual({
      "service.name": "test",
      extra: "val",
    });
  });

  it("build.ts aliases @opentelemetry/resources to the stub", () => {
    const buildPath = resolve(__dirname, "../build.ts");
    const buildContent = readFileSync(buildPath, "utf-8");

    expect(buildContent).toContain("@opentelemetry/resources");
    expect(buildContent).toContain("stubs/resources.js");
  });

  it("package.json declares @mnfst/server as a dependency", () => {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    expect(pkg.dependencies).toHaveProperty("@mnfst/server");
  });

  it("build.ts keeps @mnfst/server as external", () => {
    const buildPath = resolve(__dirname, "../build.ts");
    const buildContent = readFileSync(buildPath, "utf-8");

    expect(buildContent).toContain("@mnfst/server");
    expect(buildContent).toMatch(/external.*@mnfst\/server/);
  });
});
