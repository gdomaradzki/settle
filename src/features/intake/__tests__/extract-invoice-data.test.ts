import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCannedExtraction } from "@/features/intake/lib/canned-extractions";

// vi.hoisted ensures mockCreate is initialised before the mock factory runs
// (which happens when @anthropic-ai/sdk is first imported by the module below).
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  // Use a regular function — arrow functions cannot be used as constructors
  // and `new Anthropic(...)` in the service would throw at runtime.
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: mockCreate } };
  }),
}));

import { extractInvoiceData } from "@/features/intake/services/extract-invoice-data";

describe("extractInvoiceData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("returns canned fallback (reasonable defaults) when API key is unset and filename is unknown", async () => {
    const result = await extractInvoiceData("base64data", "mystery-vendor.pdf");

    expect(result.vendorName).toBe("");
    expect(result.invoiceNumber).toBeNull();
    expect(result.amountCents).toBe(0);
    expect(result.lineItems).toHaveLength(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns the matching canned extraction when API key is unset and filename is recognized", async () => {
    const result = await extractInvoiceData("base64data", "aws-invoice.pdf");

    const canned = getCannedExtraction("aws-invoice.pdf");
    expect(result.vendorName).toBe(canned.vendorName);
    expect(result.amountCents).toBe(canned.amountCents);
    expect(result.lineItems).toHaveLength(canned.lineItems.length);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("calls Anthropic and returns parsed extraction when API key is set and response is valid", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    const fakeExtraction = {
      vendorName: "Acme Corp",
      invoiceNumber: "INV-001",
      amountCents: 150_00,
      issueDate: "2026-01-01",
      dueDate: "2026-01-31",
      lineItems: [
        { description: "Widget", amountCents: 150_00, type: "EXPENSE" },
      ],
    };

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(fakeExtraction) }],
    });

    const result = await extractInvoiceData("base64data", "invoice.pdf");

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(result.vendorName).toBe("Acme Corp");
    expect(result.amountCents).toBe(150_00);
    expect(result.lineItems[0].description).toBe("Widget");
  });

  it("falls back to canned data when the Anthropic response fails schema validation", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"unexpectedField": true}' }],
    });

    const result = await extractInvoiceData("base64data", "aws-invoice.pdf");
    expect(result.vendorName).toBe("Amazon Web Services");
  });

  it("falls back to canned data when Anthropic SDK throws a network error", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    mockCreate.mockRejectedValue(new Error("Network error"));

    const result = await extractInvoiceData("base64data", "wework-invoice.pdf");
    expect(result.vendorName).toBe("WeWork");
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});
