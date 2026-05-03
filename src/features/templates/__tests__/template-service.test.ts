import { describe, it, expect } from "vitest";
import { db, resetWithTruncate } from "@/test/setup";
import { createTestUser, createTestVendor } from "@/test/factories";
import { updateTemplate } from "@/features/templates/template-service";

resetWithTruncate();

async function seedTemplate() {
  const user = await createTestUser();
  const vendor = await createTestVendor({ paymentMethod: "ACH" });
  const template = await db.billTemplate.create({
    data: {
      vendorId: vendor.id,
      description: "Original description",
      amountCents: 100_00,
      paymentDayOfMonth: 5,
      createdById: user.id,
      lineItems: {
        create: [{ description: "Original line", amountCents: 100_00 }],
      },
    },
    include: { lineItems: true },
  });
  return { user, vendor, template };
}

describe("updateTemplate", () => {
  it("updates editable fields and replaces line items", async () => {
    const { template } = await seedTemplate();

    await updateTemplate({
      id: template.id,
      description: "Renamed description",
      amountCents: 250_00,
      memo: "Updated memo",
      glCategory: "Updated category",
      endsAt: new Date("2027-01-01"),
      maxOccurrences: 12,
      requireApprovalPerInstance: true,
      lineItems: [
        { description: "Line A", amountCents: 100_00 },
        { description: "Line B", amountCents: 150_00 },
      ],
    });

    const updated = await db.billTemplate.findUniqueOrThrow({
      where: { id: template.id },
      include: { lineItems: { orderBy: { description: "asc" } } },
    });
    const u = updated as unknown as {
      description: string;
      amountCents: number;
      memo: string | null;
      glCategory: string | null;
      endsAt: Date | null;
      maxOccurrences: number | null;
      requireApprovalPerInstance: boolean;
      paymentDayOfMonth: number;
      vendorId: string;
      lineItems: { description: string; amountCents: number }[];
    };
    expect(u.description).toBe("Renamed description");
    expect(u.amountCents).toBe(250_00);
    expect(u.memo).toBe("Updated memo");
    expect(u.glCategory).toBe("Updated category");
    expect(u.endsAt?.toISOString()).toBe(new Date("2027-01-01").toISOString());
    expect(u.maxOccurrences).toBe(12);
    expect(u.requireApprovalPerInstance).toBe(true);
    expect(u.lineItems.map((li) => li.description)).toEqual(["Line A", "Line B"]);
    expect(u.lineItems.map((li) => li.amountCents)).toEqual([100_00, 150_00]);
  });

  it("does not change vendorId or paymentDayOfMonth", async () => {
    const { template } = await seedTemplate();
    const originalVendorId = template.vendorId;

    await updateTemplate({
      id: template.id,
      description: "Renamed",
      amountCents: 100_00,
      lineItems: [{ description: "Line", amountCents: 100_00 }],
    });

    const after = await db.billTemplate.findUniqueOrThrow({
      where: { id: template.id },
    });
    const a = after as unknown as { vendorId: string; paymentDayOfMonth: number };
    expect(a.vendorId).toBe(originalVendorId);
    expect(a.paymentDayOfMonth).toBe(5);
  });

  it("clears nullable fields when omitted from input", async () => {
    const { template } = await seedTemplate();

    // First, populate optional fields
    await updateTemplate({
      id: template.id,
      description: "With extras",
      amountCents: 100_00,
      memo: "memo",
      glCategory: "cat",
      endsAt: new Date("2027-01-01"),
      maxOccurrences: 5,
      requireApprovalPerInstance: true,
      lineItems: [{ description: "Line", amountCents: 100_00 }],
    });

    // Then submit again without those fields → they clear
    await updateTemplate({
      id: template.id,
      description: "Stripped",
      amountCents: 100_00,
      lineItems: [{ description: "Line", amountCents: 100_00 }],
    });

    const after = await db.billTemplate.findUniqueOrThrow({
      where: { id: template.id },
    });
    const a = after as unknown as {
      memo: string | null;
      glCategory: string | null;
      endsAt: Date | null;
      maxOccurrences: number | null;
      requireApprovalPerInstance: boolean;
    };
    expect(a.memo).toBeNull();
    expect(a.glCategory).toBeNull();
    expect(a.endsAt).toBeNull();
    expect(a.maxOccurrences).toBeNull();
    expect(a.requireApprovalPerInstance).toBe(false);
  });

  it("does not modify previously generated bills", async () => {
    const { template, vendor, user } = await seedTemplate();
    // Pre-existing bill from a past generation
    const priorBill = await db.bill.create({
      data: {
        vendorId: vendor.id,
        amountCents: 100_00,
        currency: "USD",
        issueDate: new Date("2026-04-05"),
        dueDate: new Date("2026-04-15"),
        status: "PAID",
        createdById: user.id,
        recurringTemplateId: template.id,
      },
    });

    await updateTemplate({
      id: template.id,
      description: "After edit",
      amountCents: 999_99,
      lineItems: [{ description: "New line", amountCents: 999_99 }],
    });

    const refreshed = await db.bill.findUniqueOrThrow({
      where: { id: priorBill.id },
    });
    const r = refreshed as unknown as { amountCents: number; status: string };
    expect(r.amountCents).toBe(100_00); // unchanged
    expect(r.status).toBe("PAID");
  });
});
