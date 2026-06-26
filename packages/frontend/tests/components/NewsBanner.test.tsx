import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import NewsBanner from "../../src/components/NewsBanner";
import type { NewsItem } from "../../src/services/news";

const item: NewsItem = {
  id: "test-news-1",
  title: "Test headline",
  blurb: "Test blurb copy.",
  thumbnail: "/news/test.jpg",
  href: "https://www.youtube.com/watch?v=abc123",
  cta: "Watch",
};

describe("NewsBanner", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("renders the item with a new-tab link and self-hosted thumbnail", () => {
    const { container, getByText } = render(() => <NewsBanner item={item} />);
    const link = container.querySelector("a.news-banner") as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe(item.href);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");

    const img = container.querySelector(
      ".news-banner__thumb",
    ) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(item.thumbnail);
    expect(img.getAttribute("alt")).toBe(item.title);

    expect(getByText(item.title)).toBeTruthy();
    expect(getByText(item.blurb)).toBeTruthy();
    expect(getByText("Watch →")).toBeTruthy();
  });

  it("hides the banner and persists when dismissed", () => {
    const { container } = render(() => <NewsBanner item={item} />);
    const dismiss = container.querySelector(
      ".news-banner__dismiss",
    ) as HTMLButtonElement;

    fireEvent.click(dismiss);

    expect(container.querySelector(".news-banner")).toBeNull();
    expect(localStorage.getItem(`news_dismissed_${item.id}`)).toBe("1");
  });

  it("renders nothing when already dismissed", () => {
    localStorage.setItem(`news_dismissed_${item.id}`, "1");
    const { container } = render(() => <NewsBanner item={item} />);
    expect(container.querySelector(".news-banner")).toBeNull();
  });

  it("renders when reading storage throws", () => {
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage blocked");
      });
    const { container } = render(() => <NewsBanner item={item} />);
    expect(container.querySelector(".news-banner")).not.toBeNull();
    spy.mockRestore();
  });

  it("still dismisses when writing storage throws", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage blocked");
      });
    const { container } = render(() => <NewsBanner item={item} />);
    fireEvent.click(
      container.querySelector(".news-banner__dismiss") as HTMLButtonElement,
    );
    expect(container.querySelector(".news-banner")).toBeNull();
    spy.mockRestore();
  });
});
