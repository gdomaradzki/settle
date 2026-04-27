import { vi } from "vitest";

// Stable router object — tests can import and assert on these directly.
// vi.clearAllMocks() resets call history between tests.
export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

export const useRouter = vi.fn(() => mockRouter);

export const usePathname = vi.fn(() => "/");

export const useSearchParams = vi.fn(() => new URLSearchParams());

export const useParams = vi.fn(() => ({}));

export const redirect = vi.fn();

export const notFound = vi.fn();
