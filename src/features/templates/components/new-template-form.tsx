"use client";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon, ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc-client";
import { formatUSD } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createTemplateInput, type CreateTemplateInput } from "../schemas";

export function NewTemplateForm() {
  const router = useRouter();
  const vendors = trpc.vendor.list.useQuery();
  const createTemplate = trpc.templates.create.useMutation();

  const form = useForm<CreateTemplateInput>({
    resolver: zodResolver(createTemplateInput),
    defaultValues: {
      vendorId: "",
      description: "",
      amountCents: 0,
      paymentDayOfMonth: 1,
      memo: "",
      glCategory: "",
      lineItems: [{ description: "", amountCents: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const lineItems = useWatch({ control: form.control, name: "lineItems" });
  const totalCents = lineItems.reduce((sum, li) => sum + (li.amountCents ?? 0), 0);

  async function onSubmit(values: CreateTemplateInput) {
    try {
      const t = await createTemplate.mutateAsync(values);
      toast.success("Recurring bill created");
      router.push(`/templates/${t.id}`);
    } catch (e) {
      toast.error((e as Error).message ?? "Something went wrong");
    }
  }

  const errors = form.formState.errors;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/templates"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeftIcon className="size-3.5" />
          Recurring Bills
        </Link>
        <h1 className="text-lg font-semibold text-foreground">
          New recurring bill
        </h1>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Vendor */}
        <div className="space-y-1.5">
          <Label>
            Vendor <span className="text-destructive">*</span>
          </Label>
          <select
            className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            {...form.register("vendorId")}>
            <option value="">Select vendor…</option>
            {vendors.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {errors.vendorId && (
            <p className="text-xs text-destructive">{errors.vendorId.message}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label>
            Description <span className="text-destructive">*</span>
          </Label>
          <Input
            className="h-8 text-sm"
            placeholder="e.g. Monthly office rent"
            {...form.register("description")}
          />
          {errors.description && (
            <p className="text-xs text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Total amount */}
          <div className="space-y-1.5">
            <Label>
              Total amount <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                className="pl-5 h-8 text-sm"
                value={(form.watch("amountCents") ?? 0) / 100 || ""}
                onChange={(e) => {
                  const cents = Math.round(
                    parseFloat(e.target.value || "0") * 100,
                  );
                  form.setValue("amountCents", isNaN(cents) ? 0 : cents, {
                    shouldValidate: true,
                  });
                }}
              />
            </div>
            {errors.amountCents && (
              <p className="text-xs text-destructive">
                {errors.amountCents.message}
              </p>
            )}
          </div>

          {/* Payment day of month */}
          <div className="space-y-1.5">
            <Label>
              Pay vendor on day <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              min={1}
              max={28}
              className="h-8 text-sm"
              {...form.register("paymentDayOfMonth", { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">
              1–28. Bills are created 10 days ahead for ACH, 15 for check.
            </p>
            {errors.paymentDayOfMonth && (
              <p className="text-xs text-destructive">
                {errors.paymentDayOfMonth.message}
              </p>
            )}
          </div>
        </div>

        {/* GL category */}
        <div className="space-y-1.5">
          <Label>GL category</Label>
          <Input
            className="h-8 text-sm"
            placeholder="e.g. Rent &amp; Occupancy"
            {...form.register("glCategory")}
          />
        </div>

        {/* Memo */}
        <div className="space-y-1.5">
          <Label>Memo</Label>
          <Input
            className="h-8 text-sm"
            placeholder="Optional note…"
            {...form.register("memo")}
          />
        </div>

        <Separator />

        {/* Line items */}
        <div className="space-y-2">
          <Label>
            Line items <span className="text-destructive">*</span>
          </Label>
          {fields.map((field, idx) => (
            <div key={field.id} className="flex gap-2 items-start">
              <div className="flex-1">
                <Input
                  className="h-8 text-sm"
                  placeholder="Description"
                  {...form.register(`lineItems.${idx}.description`)}
                />
                {errors.lineItems?.[idx]?.description && (
                  <p className="mt-0.5 text-xs text-destructive">
                    {errors.lineItems[idx].description?.message}
                  </p>
                )}
              </div>
              <div className="relative w-28">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="pl-5 h-8 text-sm"
                  value={
                    (form.watch(`lineItems.${idx}.amountCents`) ?? 0) / 100 || ""
                  }
                  onChange={(e) => {
                    const cents = Math.round(
                      parseFloat(e.target.value || "0") * 100,
                    );
                    form.setValue(
                      `lineItems.${idx}.amountCents`,
                      isNaN(cents) ? 0 : cents,
                      { shouldValidate: true },
                    );
                  }}
                />
              </div>
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="mt-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2Icon className="size-4" />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => append({ description: "", amountCents: 0 })}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <PlusIcon className="size-3.5" />
            Add line item
          </button>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Total:{" "}
            <span className="font-medium text-foreground">
              {formatUSD(totalCents)}
            </span>
          </p>
          <Button type="submit" disabled={createTemplate.isPending}>
            {createTemplate.isPending ? "Creating…" : "Create recurring bill"}
          </Button>
        </div>
      </form>
    </div>
  );
}
