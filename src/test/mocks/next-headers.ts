import { vi } from "vitest";

export const cookies = vi.fn(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  has: vi.fn(),
  getAll: vi.fn(() => []),
}));

export const headers = vi.fn(() => new Headers());
