import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL doesn't auto-cleanup in Vitest's per-file jsdom environments — register explicitly.
afterEach(cleanup);

// cmdk and Radix Popover use ResizeObserver / scrollIntoView which jsdom doesn't implement.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView = () => {};
}
