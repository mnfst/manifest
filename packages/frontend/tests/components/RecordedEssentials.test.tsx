import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import RecordedEssentials from "../../src/components/RecordedEssentials";

describe("RecordedEssentials", () => {
  it("renders both cards with titles when messages are provided", () => {
    render(() => (
      <RecordedEssentials
        lastUser={{ role: "user", content: "Hello world" }}
        assistantReply={{ role: "assistant", content: "Hi there" }}
      />
    ));
    expect(screen.getByText("Final user message")).toBeDefined();
    expect(screen.getByText("Assistant reply")).toBeDefined();
    expect(screen.getByText("Hello world")).toBeDefined();
    expect(screen.getByText("Hi there")).toBeDefined();
  });

  it("renders fallback text when messages are null", () => {
    render(() => (
      <RecordedEssentials lastUser={null} assistantReply={null} />
    ));
    expect(screen.getByText("No user turn in this recording.")).toBeDefined();
    expect(screen.getByText("Response not captured.")).toBeDefined();
  });

  it("shows 'Show full' button for long text and toggles expansion", async () => {
    const longText = "A".repeat(500);
    render(() => (
      <RecordedEssentials
        lastUser={{ role: "user", content: longText }}
        assistantReply={null}
      />
    ));

    // Should show truncated text and a "Show full" button
    const showFullBtn = screen.getByText("Show full");
    expect(showFullBtn).toBeDefined();

    // The full text should NOT be fully visible (truncated to 400 chars)
    const body = document.querySelector(".recorded-modal__essentials-body");
    expect(body!.textContent!.length).toBeLessThan(500);

    // Click "Show full" → full text visible
    await fireEvent.click(showFullBtn);
    expect(screen.getByText("Show less")).toBeDefined();
    const bodyAfter = document.querySelector(".recorded-modal__essentials-body");
    expect(bodyAfter!.textContent!.length).toBe(500);

    // Click "Show less" → truncated again
    await fireEvent.click(screen.getByText("Show less"));
    expect(screen.getByText("Show full")).toBeDefined();
  });

  it("renders tool_calls info when present", () => {
    render(() => (
      <RecordedEssentials
        lastUser={null}
        assistantReply={{
          role: "assistant",
          content: "Done",
          tool_calls: [
            { function: { name: "search" } },
            { function: { name: "read_file" } },
          ],
        }}
      />
    ));
    expect(screen.getByText("tool calls")).toBeDefined();
    // Shows count and function names
    const toolsDiv = document.querySelector(".recorded-modal__essentials-tools");
    expect(toolsDiv!.textContent).toContain("2");
    expect(toolsDiv!.textContent).toContain("search");
    expect(toolsDiv!.textContent).toContain("read_file");
  });

  it("renders 'unknown' for tool_calls without function name", () => {
    render(() => (
      <RecordedEssentials
        lastUser={null}
        assistantReply={{
          role: "assistant",
          content: "Done",
          tool_calls: [{}],
        }}
      />
    ));
    const toolsDiv = document.querySelector(".recorded-modal__essentials-tools");
    expect(toolsDiv!.textContent).toContain("unknown");
  });

  it("renders 'View in conversation' buttons when jump callbacks provided", async () => {
    const onJumpUser = vi.fn();
    const onJumpAssistant = vi.fn();
    render(() => (
      <RecordedEssentials
        lastUser={{ role: "user", content: "hi" }}
        assistantReply={{ role: "assistant", content: "hey" }}
        onJumpToLastUser={onJumpUser}
        onJumpToAssistant={onJumpAssistant}
      />
    ));
    const buttons = screen.getAllByText("View in conversation");
    expect(buttons.length).toBe(2);

    await fireEvent.click(buttons[0]);
    expect(onJumpUser).toHaveBeenCalledTimes(1);

    await fireEvent.click(buttons[1]);
    expect(onJumpAssistant).toHaveBeenCalledTimes(1);
  });

  it("does not render 'View in conversation' when no jump callbacks", () => {
    render(() => (
      <RecordedEssentials
        lastUser={{ role: "user", content: "hi" }}
        assistantReply={{ role: "assistant", content: "hey" }}
      />
    ));
    const buttons = document.querySelectorAll(".recorded-modal__essentials-jump");
    expect(buttons.length).toBe(0);
  });

  it("handles array content format (content parts)", () => {
    render(() => (
      <RecordedEssentials
        lastUser={{
          role: "user",
          content: [
            { type: "text", text: "Hello from array" },
            { type: "text", text: " content" },
          ],
        }}
        assistantReply={null}
      />
    ));
    expect(screen.getByText("Hello from array content")).toBeDefined();
  });

  it("applies accent classes correctly", () => {
    render(() => (
      <RecordedEssentials
        lastUser={{ role: "user", content: "u" }}
        assistantReply={{ role: "assistant", content: "a" }}
      />
    ));
    const cards = document.querySelectorAll(".recorded-modal__essentials-card");
    expect(cards[0].classList.contains("recorded-modal__essentials-card--user")).toBe(true);
    expect(cards[1].classList.contains("recorded-modal__essentials-card--assistant")).toBe(true);
  });

  it("does not show tool_calls section when array is empty", () => {
    render(() => (
      <RecordedEssentials
        lastUser={null}
        assistantReply={{
          role: "assistant",
          content: "Hi",
          tool_calls: [],
        }}
      />
    ));
    expect(document.querySelector(".recorded-modal__essentials-tools")).toBeNull();
  });

  it("shows message body even without tool_calls property", () => {
    render(() => (
      <RecordedEssentials
        lastUser={null}
        assistantReply={{ role: "assistant", content: "Just text" }}
      />
    ));
    expect(screen.getByText("Just text")).toBeDefined();
    expect(document.querySelector(".recorded-modal__essentials-tools")).toBeNull();
  });
});
