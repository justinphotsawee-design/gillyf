import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// globals: false in vitest.config.ts means React Testing Library's own
// auto-cleanup (which detects a global `afterEach`) never wires itself up,
// so each test's rendered tree would otherwise pile up in the DOM across
// tests in the same file.
afterEach(() => cleanup());

// jsdom doesn't implement ResizeObserver — TemplatePreview's Slot uses one
// to track the drawn image's container size.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = MockResizeObserver;
}
