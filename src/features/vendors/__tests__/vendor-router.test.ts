import { describe, it, expect } from "vitest";
import { createCallerFactory } from "@/server/trpc";
import { vendorRouter } from "@/features/vendors/vendor-router";
import { resetWithTruncate } from "@/test/setup";
import { createTestUser, createTestVendor, createTestBill } from "@/test/factories";
import type { User } from "@/generated/prisma/client";

resetWithTruncate();

const factory = createCallerFactory(vendorRouter);

function caller(user: User, isAuthenticated = true) {
  return factory({ user: user as never, isAuthenticated });
}

// ─── list ─────────────────────────────────────────────────────────────────────

describe("vendor.list", () => {
  it("returns vendors in alphabetical order", async () => {
    const user = await createTestUser();
    await createTestVendor({ name: "Zebra Corp" });
    await createTestVendor({ name: "Apple Inc" });

    const vendors = await caller(user).list();
    const names = vendors.map((v) => v.name);
    expect(names.indexOf("Apple Inc")).toBeLessThan(names.indexOf("Zebra Corp"));
  });

  it("includes outstanding count and cents for open bills", async () => {
    const user = await createTestUser();
    const vendor = await createTestVendor();
    await createTestBill({ vendorId: vendor.id, status: "APPROVED", amountCents: 50_000, createdById: user.id });
    await createTestBill({ vendorId: vendor.id, status: "PAID", amountCents: 99_999, createdById: user.id });

    const vendors = await caller(user).list();
    const row = vendors.find((v) => v.id === vendor.id);
    expect(row?.outstandingCount).toBe(1);
    expect(row?.outstandingCents).toBe(50_000);
  });
});

// ─── create ───────────────────────────────────────────────────────────────────

describe("vendor.create", () => {
  it("creates a vendor when authenticated", async () => {
    const user = await createTestUser();
    const vendor = await caller(user).create({
      name: "New Vendor",
      paymentMethod: "ACH",
      achAccountLast4: "1234",
      achRoutingLast4: "5678",
    });

    expect(vendor.name).toBe("New Vendor");
    expect(vendor.paymentMethod).toBe("ACH");
    expect(vendor.achAccountLast4).toBe("1234");
  });

  it("throws CONFLICT on case-insensitive duplicate name", async () => {
    const user = await createTestUser();
    await createTestVendor({ name: "Acme Corp" });

    await expect(
      caller(user).create({ name: "acme corp", paymentMethod: "CHECK" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const user = await createTestUser();

    await expect(
      caller(user, false).create({ name: "Ghost Vendor", paymentMethod: "ACH" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
