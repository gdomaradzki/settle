import type { Metadata } from "next";
import { NewTemplateForm } from "@/features/templates/components/new-template-form";

export const metadata: Metadata = { title: "New recurring bill — Settle" };

export default function NewTemplatePage() {
  return <NewTemplateForm />;
}
