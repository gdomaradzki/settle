import type { Metadata } from "next";
import { TemplateForm } from "@/features/templates/components/template-form";

export const metadata: Metadata = { title: "New recurring bill — Settle" };

export default function NewTemplatePage() {
  return <TemplateForm />;
}
