import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted runs before imports so mockPut is defined when the mock factory
// executes (which happens when @vercel/blob is first imported below).
const mockPut = vi.hoisted(() => vi.fn());

vi.mock("@vercel/blob", () => ({
  put: mockPut,
}));

import { storeInvoicePdf } from "@/features/intake/services/store-invoice-pdf";

describe("storeInvoicePdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a URL string on successful upload", async () => {
    mockPut.mockResolvedValue({
      url: "https://blob.vercel-storage.com/invoice-abc123.pdf",
    });

    const result = await storeInvoicePdf("base64data", "invoice.pdf");

    expect(result).toMatch(/^https:\/\//);
    expect(mockPut).toHaveBeenCalledOnce();
    expect(mockPut).toHaveBeenCalledWith(
      "invoice.pdf",
      expect.any(Buffer),
      expect.objectContaining({ access: "public", contentType: "application/pdf" }),
    );
  });

  it("returns null when the upload throws", async () => {
    mockPut.mockRejectedValue(new Error("Upload failed"));

    const result = await storeInvoicePdf("base64data", "invoice.pdf");

    expect(result).toBeNull();
  });

  it("returns null and does not throw when the token is missing", async () => {
    mockPut.mockRejectedValue(new Error("No token found"));

    await expect(storeInvoicePdf("data", "file.pdf")).resolves.toBeNull();
  });
});
