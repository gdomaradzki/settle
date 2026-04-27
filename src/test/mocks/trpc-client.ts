import { vi } from "vitest";

// Shared mock for @/lib/trpc-client.
// Use `unknown[]` for data arrays so callers can provide any shape in mockReturnValue.

export const mockVendorList = vi.fn(() => ({
  data: [] as unknown[],
  isLoading: false,
}));

export const mockBillList = vi.fn(() => ({
  data: [] as unknown[],
  isLoading: false,
}));

export const mockVendorCreate = vi.fn(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
}));

export const mockBillCreate = vi.fn(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
}));

export const mockBillCreateAndSubmit = vi.fn(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
}));

export const mockUtilsInvalidate = vi.fn();

export const trpc = {
  vendor: {
    list: { useQuery: mockVendorList },
    create: { useMutation: mockVendorCreate },
  },
  bill: {
    list: { useQuery: mockBillList },
    create: { useMutation: mockBillCreate },
    createAndSubmit: { useMutation: mockBillCreateAndSubmit },
  },
  useUtils: vi.fn(() => ({
    vendor: { list: { invalidate: mockUtilsInvalidate } },
    bill: { list: { invalidate: vi.fn(), prefetch: vi.fn() } },
  })),
};
