import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServerCaller } from "@/server/root-router";
import { TemplateDetailView } from "@/features/templates/components/template-detail-view";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const caller = await createServerCaller();
    const t = await caller.templates.get(id);
    return { title: `${t.description} — Settle` };
  } catch {
    return { title: "Template — Settle" };
  }
}

export default async function TemplateDetailPage({ params }: Props) {
  const { id } = await params;

  let template;
  try {
    const caller = await createServerCaller();
    template = await caller.templates.get(id);
  } catch {
    notFound();
  }

  return <TemplateDetailView initialTemplate={template} />;
}
