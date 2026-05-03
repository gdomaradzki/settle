import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServerCaller } from "@/server/root-router";
import { TemplateForm } from "@/features/templates/components/template-form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const caller = await createServerCaller();
    const t = await caller.templates.get(id);
    return { title: `Edit ${t.description} — Settle` };
  } catch {
    return { title: "Edit recurring bill — Settle" };
  }
}

export default async function EditTemplatePage({ params }: Props) {
  const { id } = await params;

  let template;
  try {
    const caller = await createServerCaller();
    template = await caller.templates.get(id);
  } catch {
    notFound();
  }

  return (
    <TemplateForm
      template={{
        id: template.id,
        description: template.description,
        amountCents: template.amountCents,
        paymentDayOfMonth: template.paymentDayOfMonth,
        memo: template.memo,
        glCategory: template.glCategory,
        endsAt: template.endsAt,
        maxOccurrences: template.maxOccurrences,
        requireApprovalPerInstance: template.requireApprovalPerInstance,
        vendor: { id: template.vendor.id, name: template.vendor.name },
        lineItems: template.lineItems,
      }}
    />
  );
}
