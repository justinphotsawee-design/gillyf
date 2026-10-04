import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TemplatePreview, { DEFAULT_ADJUSTMENT, MIN_SCALE, MAX_SCALE } from "./TemplatePreview";

// jsdom has no layout engine, so ResizeObserver never fires on its own —
// report a fixed non-zero size synchronously so drag/zoom math has
// something to work with instead of the "not yet measured" null branch.
class SizingResizeObserver {
  cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe() {
    this.cb(
      [{ contentRect: { width: 300, height: 200 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver
    );
  }
  unobserve() {}
  disconnect() {}
}

function renderEmpty(overrides: Partial<Parameters<typeof TemplatePreview>[0]> = {}) {
  const onAdjustChange = vi.fn();
  const onRemove = vi.fn();
  const onSlotClick = vi.fn();
  render(
    <TemplatePreview
      uploadedUrls={{}}
      uploadingSlots={{}}
      adjustments={{}}
      onAdjustChange={onAdjustChange}
      onSlotClick={onSlotClick}
      onRemove={onRemove}
      {...overrides}
    />
  );
  return { onAdjustChange, onRemove, onSlotClick };
}

function renderWithPhoto(overrides: Partial<Parameters<typeof TemplatePreview>[0]> = {}) {
  const onAdjustChange = vi.fn();
  const onRemove = vi.fn();
  const onSlotClick = vi.fn();
  render(
    <TemplatePreview
      uploadedUrls={{ coverFront: "https://res.cloudinary.com/demo/image/upload/photo.jpg" }}
      uploadingSlots={{}}
      adjustments={{}}
      onAdjustChange={onAdjustChange}
      onSlotClick={onSlotClick}
      onRemove={onRemove}
      {...overrides}
    />
  );
  const slot = document.querySelector(".cursor-move") as HTMLElement;
  return { onAdjustChange, onRemove, onSlotClick, slot };
}

function tap(el: HTMLElement, pointerId = 1, x = 50, y = 50) {
  fireEvent.pointerDown(el, { pointerId, clientX: x, clientY: y });
  fireEvent.pointerUp(el, { pointerId, clientX: x, clientY: y });
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", SizingResizeObserver);
});

describe("TemplatePreview — empty slots", () => {
  it("renders an empty slot as an 'Add photo' target", () => {
    renderEmpty();
    expect(screen.getAllByText("Add photo").length).toBeGreaterThan(0);
  });

  it("clicking an empty slot calls onSlotClick with that slot's id", () => {
    const { onSlotClick } = renderEmpty();
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(onSlotClick).toHaveBeenCalledWith("coverFront");
  });

  it("disables the empty-slot button while that slot is uploading", () => {
    renderEmpty({ uploadingSlots: { coverFront: true } });
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toBeDisabled();
    expect(screen.getAllByText("Uploading…").length).toBeGreaterThan(0);
  });
});

describe("TemplatePreview — filled slot: remove / replace", () => {
  it("clicking the remove button calls onRemove with the slot id", () => {
    const { onRemove } = renderWithPhoto();
    fireEvent.click(screen.getByRole("button", { name: /remove photo/i }));
    expect(onRemove).toHaveBeenCalledWith("coverFront");
  });

  it("clicking the replace (pencil) button calls onSlotClick, not onRemove", () => {
    const { onSlotClick, onRemove } = renderWithPhoto();
    fireEvent.click(screen.getByRole("button", { name: /change photo/i }));
    expect(onSlotClick).toHaveBeenCalledWith("coverFront");
    expect(onRemove).not.toHaveBeenCalled();
  });
});

describe("TemplatePreview — tap-to-toggle delete overlay (debounced)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not remove the photo from a single tap alone", () => {
    const { onRemove, slot } = renderWithPhoto();
    tap(slot);
    vi.advanceTimersByTime(500);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("a drag (pointer moves >6px before release) does not toggle the delete overlay at all", () => {
    const { onRemove, slot } = renderWithPhoto();
    fireEvent.pointerDown(slot, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(slot, { pointerId: 1, clientX: 90, clientY: 80 });
    fireEvent.pointerUp(slot, { pointerId: 1, clientX: 90, clientY: 80 });
    vi.advanceTimersByTime(500);
    expect(onRemove).not.toHaveBeenCalled();
  });
});

describe("TemplatePreview — double-click resets zoom instead of deleting (regression)", () => {
  // Bug: the first tap of a double-click opened the delete overlay with its
  // "Remove photo" button centered right under the pointer; the double-
  // click's second tap then landed on that button and deleted the photo
  // instead of resetting zoom. Fixed by deferring the overlay-open by
  // 300ms so a same-spot second tap cancels it instead of a button
  // appearing under an in-flight gesture. See TemplatePreview.tsx's
  // tapTimerRef.
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("two same-spot taps within the debounce window, followed by dblclick, reset the adjustment and never call onRemove", () => {
    const { onRemove, onAdjustChange, slot } = renderWithPhoto({
      adjustments: { coverFront: { scale: 2.4, x: 0.1, y: 0.9 } },
    });

    tap(slot); // first tap of the double-click
    tap(slot); // second tap, arrives before the first tap's 300ms timer fires
    fireEvent.doubleClick(slot); // the browser's own dblclick, same gesture

    vi.advanceTimersByTime(500); // drain any timers that might still be pending

    expect(onRemove).not.toHaveBeenCalled();
    expect(onAdjustChange).toHaveBeenCalledWith("coverFront", DEFAULT_ADJUSTMENT);
  });

  it("a genuine single tap (no second tap follows) still opens the overlay after the grace window", () => {
    const { onRemove, slot } = renderWithPhoto();
    tap(slot);
    vi.advanceTimersByTime(350);
    fireEvent.click(screen.getByRole("button", { name: /remove photo/i }));
    expect(onRemove).toHaveBeenCalledWith("coverFront");
  });
});

describe("TemplatePreview — wheel zoom", () => {
  it("zooming in clamps at MAX_SCALE", () => {
    const { onAdjustChange, slot } = renderWithPhoto({
      adjustments: { coverFront: { scale: 2.9, x: 0.5, y: 0.5 } },
    });
    fireEvent.wheel(slot, { deltaY: -100000 });
    expect(onAdjustChange).toHaveBeenLastCalledWith(
      "coverFront",
      expect.objectContaining({ scale: MAX_SCALE })
    );
  });

  it("zooming out clamps at MIN_SCALE", () => {
    const { onAdjustChange, slot } = renderWithPhoto({
      adjustments: { coverFront: { scale: 0.4, x: 0.5, y: 0.5 } },
    });
    fireEvent.wheel(slot, { deltaY: 100000 });
    expect(onAdjustChange).toHaveBeenLastCalledWith(
      "coverFront",
      expect.objectContaining({ scale: MIN_SCALE })
    );
  });

  it("does nothing on an empty slot (no image to zoom)", () => {
    const { onAdjustChange } = renderEmpty();
    const container = document.querySelector(".bg-white");
    if (container) fireEvent.wheel(container, { deltaY: -100 });
    expect(onAdjustChange).not.toHaveBeenCalled();
  });
});

describe("TemplatePreview — drag to pan", () => {
  it("dragging the photo calls onAdjustChange for that slot", () => {
    const { onAdjustChange, slot } = renderWithPhoto();
    fireEvent.pointerDown(slot, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(slot, { pointerId: 1, clientX: 90, clientY: 70 });
    expect(onAdjustChange).toHaveBeenCalledWith(
      "coverFront",
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
    );
  });
});

describe("TemplatePreview — Packaging's fixed artwork slot", () => {
  it("renders the fixed packaging image with no add/remove/replace controls", () => {
    renderEmpty();
    const fixedImg = document.querySelector('img[src="/pic/packaging-right_new.png"]');
    expect(fixedImg).toBeTruthy();
    // FixedSlot renders no buttons of its own — every button on the page
    // must belong to one of the real upload slots instead.
    expect(screen.queryByRole("button", { name: /remove photo/i })).not.toBeInTheDocument();
  });
});
