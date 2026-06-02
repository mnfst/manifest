import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import RecordedOutline, {
  type OutlineRow,
} from "../../src/components/RecordedOutline";
import { MAX_COUNTED_MATCHES, type Role } from "../../src/components/recorded-message-helpers";

const ALL_ROLES: ReadonlySet<Role> = new Set<Role>(["user", "assistant", "system", "tool"]);

function buildRows(): OutlineRow[] {
  return [
    { index: 0, role: "system", roleLabel: "system", preview: "sys hello", tokens: 12 },
    { index: 1, role: "user", roleLabel: "user", preview: "first user", tokens: 50 },
    { index: 2, role: "assistant", roleLabel: "assistant", preview: "asst reply 1", tokens: 1500 },
    { index: 3, role: "tool", roleLabel: "tool", preview: "tool out", tokens: 8 },
    { index: 4, role: "user", roleLabel: "user", preview: "last user", tokens: 30 },
    { index: 5, role: "assistant", roleLabel: "assistant", preview: "asst reply 2", tokens: 2200 },
  ];
}

function defaultProps(overrides: Partial<Parameters<typeof RecordedOutline>[0]> = {}) {
  return {
    rows: buildRows(),
    activeIndex: null as number | null,
    visibleRoles: ALL_ROLES,
    searchQuery: "",
    onSearch: vi.fn(),
    onJump: vi.fn(),
    onToggleRole: vi.fn(),
    onJumpLastUser: vi.fn(),
    onJumpLastAssistant: vi.fn(),
    onJumpFirstUser: vi.fn(),
    ...overrides,
  };
}

describe("RecordedOutline — search input", () => {
  it("renders the input with the provided searchQuery value", () => {
    const props = defaultProps({ searchQuery: "hello" });
    render(() => <RecordedOutline {...props} />);
    const input = screen.getByLabelText("Search conversation") as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe("hello");
  });

  it("calls onSearch with the typed value when input changes", () => {
    const onSearch = vi.fn();
    render(() => <RecordedOutline {...defaultProps({ onSearch })} />);
    const input = screen.getByLabelText("Search conversation") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "needle" } });
    expect(onSearch).toHaveBeenCalledWith("needle");
  });

  it("renders the '/' keyboard hint", () => {
    render(() => <RecordedOutline {...defaultProps()} />);
    const kbd = document.querySelector(".recorded-modal__rail-kbd");
    expect(kbd).not.toBeNull();
    expect(kbd!.textContent).toBe("/");
  });
});

describe("RecordedOutline — role chips", () => {
  it("renders one chip per role with the correct data-role and label", () => {
    render(() => <RecordedOutline {...defaultProps()} />);
    for (const role of ["user", "assistant", "system", "tool"] as Role[]) {
      const chip = document.querySelector(`button[data-role="${role}"]`);
      expect(chip).not.toBeNull();
      const label = role.charAt(0).toUpperCase() + role.slice(1);
      expect(chip!.textContent).toContain(label);
    }
  });

  it("reflects active state via aria-pressed and active class", () => {
    const visibleRoles = new Set<Role>(["user", "assistant"]);
    render(() => <RecordedOutline {...defaultProps({ visibleRoles })} />);

    const userChip = document.querySelector('button[data-role="user"]')!;
    expect(userChip.getAttribute("aria-pressed")).toBe("true");
    expect(userChip.classList.contains("recorded-modal__rail-filter--active")).toBe(true);

    const systemChip = document.querySelector('button[data-role="system"]')!;
    expect(systemChip.getAttribute("aria-pressed")).toBe("false");
    expect(systemChip.classList.contains("recorded-modal__rail-filter--active")).toBe(false);
  });

  it("hides the check icon when inactive via opacity style", () => {
    const visibleRoles = new Set<Role>(["user"]);
    render(() => <RecordedOutline {...defaultProps({ visibleRoles })} />);

    const userChip = document.querySelector('button[data-role="user"]')!;
    const userCheck = userChip.querySelector(".recorded-modal__rail-filter-check") as HTMLElement;
    expect(userCheck.getAttribute("style")).toBeNull();

    const systemChip = document.querySelector('button[data-role="system"]')!;
    const systemCheck = systemChip.querySelector(".recorded-modal__rail-filter-check") as HTMLElement;
    expect(systemCheck.getAttribute("style")).toContain("opacity: 0");
  });

  it("calls onToggleRole with the clicked role", async () => {
    const onToggleRole = vi.fn();
    render(() => <RecordedOutline {...defaultProps({ onToggleRole })} />);
    await fireEvent.click(document.querySelector('button[data-role="system"]')!);
    expect(onToggleRole).toHaveBeenCalledWith("system");
  });

  it("renders the CheckIcon SVG inside each chip", () => {
    render(() => <RecordedOutline {...defaultProps()} />);
    const chips = document.querySelectorAll(".recorded-modal__rail-filter");
    expect(chips.length).toBe(4);
    chips.forEach((chip) => {
      expect(chip.querySelector("svg")).not.toBeNull();
    });
  });
});

describe("RecordedOutline — jump buttons", () => {
  it("calls onJumpFirstUser when 'First user' is clicked", async () => {
    const onJumpFirstUser = vi.fn();
    render(() => <RecordedOutline {...defaultProps({ onJumpFirstUser })} />);
    await fireEvent.click(screen.getByTitle("First user message"));
    expect(onJumpFirstUser).toHaveBeenCalledTimes(1);
  });

  it("calls onJumpLastUser when 'Last user' is clicked", async () => {
    const onJumpLastUser = vi.fn();
    render(() => <RecordedOutline {...defaultProps({ onJumpLastUser })} />);
    await fireEvent.click(screen.getByTitle("Last user message"));
    expect(onJumpLastUser).toHaveBeenCalledTimes(1);
  });

  it("calls onJumpLastAssistant when 'Last assistant' is clicked", async () => {
    const onJumpLastAssistant = vi.fn();
    render(() => <RecordedOutline {...defaultProps({ onJumpLastAssistant })} />);
    await fireEvent.click(screen.getByTitle("Last assistant reply"));
    expect(onJumpLastAssistant).toHaveBeenCalledTimes(1);
  });
});

describe("RecordedOutline — outline rows", () => {
  it("renders one outline row per filtered row", () => {
    render(() => <RecordedOutline {...defaultProps()} />);
    const rowButtons = document.querySelectorAll(".recorded-modal__outline-row");
    expect(rowButtons.length).toBe(6);
  });

  it("filters rows by visibleRoles", () => {
    const visibleRoles = new Set<Role>(["user"]);
    render(() => <RecordedOutline {...defaultProps({ visibleRoles })} />);
    const rowButtons = document.querySelectorAll(".recorded-modal__outline-row");
    expect(rowButtons.length).toBe(2);
    rowButtons.forEach((btn) => {
      expect(btn.getAttribute("data-role")).toBe("user");
    });
  });

  it("calls onJump with the row index on click", async () => {
    const onJump = vi.fn();
    render(() => <RecordedOutline {...defaultProps({ onJump })} />);
    const rowButtons = document.querySelectorAll(".recorded-modal__outline-row");
    await fireEvent.click(rowButtons[2]!);
    // 3rd row in the rows array has index === 2
    expect(onJump).toHaveBeenCalledWith(2);
  });

  it("marks the active row with aria-current and active class", () => {
    render(() => <RecordedOutline {...defaultProps({ activeIndex: 4 })} />);
    const rowButtons = Array.from(
      document.querySelectorAll(".recorded-modal__outline-row"),
    ) as HTMLElement[];
    const active = rowButtons.find((b) => b.classList.contains("recorded-modal__outline-row--active"));
    expect(active).toBeDefined();
    expect(active!.getAttribute("aria-current")).toBe("true");
    expect(active!.textContent).toContain("last user");
    // Non-active rows have no aria-current attribute
    const inactive = rowButtons.filter(
      (b) => !b.classList.contains("recorded-modal__outline-row--active"),
    );
    inactive.forEach((b) => expect(b.getAttribute("aria-current")).toBeNull());
  });

  it("renders index as 1-based and preview text", () => {
    render(() => <RecordedOutline {...defaultProps()} />);
    expect(screen.getByText("#1")).toBeDefined();
    expect(screen.getByText("#6")).toBeDefined();
    expect(screen.getByText("first user")).toBeDefined();
    expect(screen.getByText("asst reply 2")).toBeDefined();
  });

  it("formats tokens >= 1000 with a 'k' suffix and one decimal", () => {
    render(() => <RecordedOutline {...defaultProps()} />);
    // tokens 1500 → "1.5k"
    expect(screen.getByText("1.5k")).toBeDefined();
    // tokens 2200 → "2.2k"
    expect(screen.getByText("2.2k")).toBeDefined();
    // tokens 12 → "12"
    expect(screen.getByText("12")).toBeDefined();
  });
});

describe("RecordedOutline — match badge", () => {
  it("does not render the badge when matchCount is missing or zero", () => {
    const rows: OutlineRow[] = [
      { index: 0, role: "user", roleLabel: "user", preview: "a", tokens: 1 },
      { index: 1, role: "user", roleLabel: "user", preview: "b", tokens: 1, matchCount: 0 },
    ];
    render(() => <RecordedOutline {...defaultProps({ rows })} />);
    expect(document.querySelectorAll(".recorded-modal__outline-match").length).toBe(0);
  });

  it("renders matchCount when present and below the cap", () => {
    const rows: OutlineRow[] = [
      { index: 0, role: "user", roleLabel: "user", preview: "x", tokens: 1, matchCount: 3 },
    ];
    render(() => <RecordedOutline {...defaultProps({ rows })} />);
    const badge = document.querySelector(".recorded-modal__outline-match");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("3");
    expect(badge!.getAttribute("aria-label")).toBe("3 matches");
  });

  it("renders '<MAX>+' badge text and aria-label when at or above the cap", () => {
    const rows: OutlineRow[] = [
      {
        index: 0,
        role: "user",
        roleLabel: "user",
        preview: "x",
        tokens: 1,
        matchCount: MAX_COUNTED_MATCHES,
      },
    ];
    render(() => <RecordedOutline {...defaultProps({ rows })} />);
    const badge = document.querySelector(".recorded-modal__outline-match")!;
    expect(badge.textContent).toBe(`${MAX_COUNTED_MATCHES}+`);
    expect(badge.getAttribute("aria-label")).toBe(`More than ${MAX_COUNTED_MATCHES} matches`);
  });
});

describe("RecordedOutline — empty state", () => {
  it("renders 'No turns match the current filter.' when filtered list is empty", () => {
    const visibleRoles = new Set<Role>([]);
    render(() => <RecordedOutline {...defaultProps({ visibleRoles })} />);
    expect(screen.getByText("No turns match the current filter.")).toBeDefined();
  });

  it("renders the empty state when rows are empty", () => {
    render(() => <RecordedOutline {...defaultProps({ rows: [] })} />);
    expect(screen.getByText("No turns match the current filter.")).toBeDefined();
    expect(document.querySelectorAll(".recorded-modal__outline-row").length).toBe(0);
  });

  it("does not render the empty state when at least one row is visible", () => {
    render(() => <RecordedOutline {...defaultProps()} />);
    expect(document.querySelector(".recorded-modal__outline-empty")).toBeNull();
  });
});
