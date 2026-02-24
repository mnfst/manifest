import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@solidjs/testing-library";
import type { UpdateInfo } from "../../src/services/local-mode";
import { createSignal } from "solid-js";

const { mockSignal } = vi.hoisted(() => {
  // Dynamically import solid-js for the hoisted block
  const { createSignal: cs } = require("solid-js");
  const signal = cs<UpdateInfo | null>(null);
  return { mockSignal: signal as ReturnType<typeof createSignal<UpdateInfo | null>> };
});

vi.mock("../../src/services/local-mode.js", () => ({
  get updateInfo() {
    return mockSignal[0];
  },
}));

import VersionIndicator from "../../src/components/VersionIndicator";

describe("VersionIndicator", () => {
  beforeEach(() => {
    mockSignal[1](null);
  });

  it("renders nothing when no update info", () => {
    const { container } = render(() => <VersionIndicator />);
    expect(container.querySelector(".version-indicator")).toBeNull();
  });

  it("renders current version when no update available", () => {
    mockSignal[1]({ version: "5.6.3" });
    const { container } = render(() => <VersionIndicator />);
    const el = container.querySelector(".version-indicator");
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain("v5.6.3");
    expect(el!.classList.contains("version-indicator--update")).toBe(false);
  });

  it("renders update notice when update available", () => {
    mockSignal[1]({
      version: "5.6.3",
      latestVersion: "6.0.0",
      updateAvailable: true,
    });
    const { container } = render(() => <VersionIndicator />);
    const el = container.querySelector(".version-indicator");
    expect(el).not.toBeNull();
    expect(el!.classList.contains("version-indicator--update")).toBe(true);
    expect(el!.textContent).toContain("New version available");
  });

  it("shows version range in tooltip", () => {
    mockSignal[1]({
      version: "5.6.3",
      latestVersion: "6.0.0",
      updateAvailable: true,
    });
    const { container } = render(() => <VersionIndicator />);
    const range = container.querySelector(".version-indicator__range");
    expect(range).not.toBeNull();
    expect(range!.textContent).toContain("v5.6.3");
    expect(range!.textContent).toContain("v6.0.0");
  });

  it("shows upgrade command in tooltip", () => {
    mockSignal[1]({
      version: "5.6.3",
      latestVersion: "6.0.0",
      updateAvailable: true,
    });
    const { container } = render(() => <VersionIndicator />);
    const cmd = container.querySelector(".version-indicator__command");
    expect(cmd).not.toBeNull();
    expect(cmd!.textContent).toContain("openclaw plugins upgrade manifest");
  });

  it("renders copy button in tooltip", () => {
    mockSignal[1]({
      version: "5.6.3",
      latestVersion: "6.0.0",
      updateAvailable: true,
    });
    const { container } = render(() => <VersionIndicator />);
    const btn = container.querySelector(".version-indicator__copy-btn");
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute("aria-label")).toBe("Copy upgrade command");
  });

  it("has correct aria-label for version display", () => {
    mockSignal[1]({ version: "5.6.3" });
    const { container } = render(() => <VersionIndicator />);
    const el = container.querySelector(".version-indicator");
    expect(el!.getAttribute("aria-label")).toBe("Version 5.6.3");
  });

  it("has correct aria-label when update available", () => {
    mockSignal[1]({
      version: "5.6.3",
      latestVersion: "6.0.0",
      updateAvailable: true,
    });
    const { container } = render(() => <VersionIndicator />);
    const el = container.querySelector(".version-indicator");
    expect(el!.getAttribute("aria-label")).toBe("Update available: v6.0.0");
  });
});
