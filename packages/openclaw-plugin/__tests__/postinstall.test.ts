import { spawnSync } from "child_process";
import { join } from "path";
import { writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";

const SCRIPT = join(__dirname, "..", "scripts", "postinstall.cjs");

/** Create a temp preload script and return its path. */
function createPreload(code: string): string {
  const dir = join(tmpdir(), `postinstall-test-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "preload.cjs");
  writeFileSync(path, code);
  return path;
}

/**
 * Run the postinstall script with options:
 * - breakSqlite: inject a preload that makes require('better-sqlite3') throw
 * - stubSqlite: inject a preload that makes require('better-sqlite3') succeed
 * - ci: set CI=true in the env
 */
function runPostinstall(opts: {
  breakSqlite?: boolean;
  stubSqlite?: boolean;
  ci?: boolean;
}) {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
  };
  if (opts.ci) env.CI = "true";

  const args: string[] = [];

  if (opts.breakSqlite) {
    const preload = createPreload(
      `const M = require('module');
const orig = M._resolveFilename;
M._resolveFilename = function(req, ...a) {
  if (req === 'better-sqlite3') throw new Error('Cannot load better-sqlite3 native binding');
  return orig.call(this, req, ...a);
};`,
    );
    args.push("--require", preload);
  } else if (opts.stubSqlite) {
    const preload = createPreload(
      `const M = require('module');
const orig = M._resolveFilename;
M._resolveFilename = function(req, ...a) {
  if (req === 'better-sqlite3') return __filename;
  return orig.call(this, req, ...a);
};`,
    );
    args.push("--require", preload);
  }

  args.push(SCRIPT);

  return spawnSync("node", args, { encoding: "utf-8", env });
}

describe("postinstall.cjs", () => {
  it("exits cleanly when better-sqlite3 loads", () => {
    const child = runPostinstall({ stubSqlite: true });
    expect(child.status).toBe(0);
    expect(child.stderr).not.toContain(
      "better-sqlite3 native module not available",
    );
  });

  it("prints a warning when better-sqlite3 fails to load", () => {
    const child = runPostinstall({ breakSqlite: true });
    expect(child.status).toBe(0);
    expect(child.stderr).toContain(
      "better-sqlite3 native module not available",
    );
    expect(child.stderr).toContain("npm rebuild better-sqlite3");
    expect(child.stderr).toContain("openclaw plugins install manifest");
  });

  it("exits silently in CI even when better-sqlite3 is missing", () => {
    const child = runPostinstall({ breakSqlite: true, ci: true });
    expect(child.status).toBe(0);
    expect(child.stderr).not.toContain(
      "better-sqlite3 native module not available",
    );
  });

  it("always exits with code 0 (warning only, not a blocker)", () => {
    const child = runPostinstall({ breakSqlite: true });
    expect(child.status).toBe(0);
  });
});
