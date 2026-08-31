import { describe, it, expect, beforeEach } from "vitest";
import { loadDesignProgress, saveDesignProgress, clearDesignProgress } from "./design";

describe("design progress (localStorage gate)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when nothing has been saved", () => {
    expect(loadDesignProgress()).toBeNull();
  });

  it("round-trips uploaded photos and their adjustments", () => {
    const progress = {
      uploadedUrls: { coverFront: "https://res.cloudinary.com/demo/image/upload/a.jpg" },
      adjustments: { coverFront: { scale: 1.5, x: 0.3, y: 0.7 } },
    };
    saveDesignProgress(progress);
    expect(loadDesignProgress()).toEqual(progress);
  });

  it("uses localStorage, not sessionStorage — survives an in-app browser's same-tab navigation to the PDF and back, which can tear down the tab's sessionStorage", () => {
    saveDesignProgress({ uploadedUrls: { coverFront: "x" }, adjustments: {} });
    expect(window.sessionStorage.getItem("gilly:design")).toBeNull();
    expect(window.localStorage.getItem("gilly:design")).not.toBeNull();
  });

  it("returns null for corrupted JSON instead of throwing", () => {
    window.localStorage.setItem("gilly:design", "{not json");
    expect(loadDesignProgress()).toBeNull();
  });

  it("clears saved progress", () => {
    saveDesignProgress({ uploadedUrls: { coverFront: "x" }, adjustments: {} });
    clearDesignProgress();
    expect(loadDesignProgress()).toBeNull();
  });
});
