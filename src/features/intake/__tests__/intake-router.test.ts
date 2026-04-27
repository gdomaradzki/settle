import { describe, it, expect, vi } from "vitest";
import { createCallerFactory } from "@/server/trpc";
import { intakeRouter } from "@/features/intake/intake-router";
import { createTestUser } from "@/test/factories";
import type { User } from "@/generated/prisma/client";

// Both external services are mocked — no DB interaction needed for this router.
const mockCreate = vi.hoisted(() => vi.fn());
const mockPut = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: mockCreate } };
  }),
}));
vi.mock("@vercel/blob", () => ({ put: mockPut }));

const factory = createCallerFactory(intakeRouter);

function caller(user: User) {
  return factory({ user: user as never, isAuthenticated: true });
}

describe("intake.extractFromPdf", () => {
  it("returns { extraction, pdfUrl } when both services succeed", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    const fakeExtraction = {
      vendorName: "Acme",
      invoiceNumber: "INV-1",
      amountCents: 100_00,
      issueDate: "2026-01-01",
      dueDate: "2026-01-31",
      lineItems: [{ description: "Service", amountCents: 100_00, type: "EXPENSE" }],
    };

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(fakeExtraction) }],
    });
    mockPut.mockResolvedValue({ url: "https://blob.example.com/invoice.pdf" });

    const user = await createTestUser();
    const result = await caller(user).extractFromPdf({
      pdfBase64: "ZmFrZQ==",
      filename: "invoice.pdf",
    });

    expect(result.extraction.vendorName).toBe("Acme");
    expect(result.pdfUrl).toMatch(/^https:\/\//);

    delete process.env.ANTHROPIC_API_KEY;
    vi.clearAllMocks();
  });

  it("returns canned extraction and null pdfUrl when services fail gracefully", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockPut.mockRejectedValue(new Error("Blob unavailable"));

    const user = await createTestUser();
    const result = await caller(user).extractFromPdf({
      pdfBase64: "ZmFrZQ==",
      filename: "aws-invoice.pdf",
    });

    expect(result.extraction.vendorName).toBe("Amazon Web Services");
    expect(result.pdfUrl).toBeNull();

    vi.clearAllMocks();
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const user = await createTestUser();
    const unauthCaller = factory({ user: user as never, isAuthenticated: false });

    await expect(
      unauthCaller.extractFromPdf({ pdfBase64: "ZmFrZQ==", filename: "test.pdf" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
