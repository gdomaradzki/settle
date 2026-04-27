"use client";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { PlusIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BillFormValues } from "../schemas";

interface Props {
  form: UseFormReturn<BillFormValues>;
  amountTouched: boolean;
}

export function LineItemsField({ form, amountTouched }: Props) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });
  // Subscribe so this component re-renders when items change (drives the displayed value)
  useWatch({ control: form.control, name: "lineItems" });

  function updateBillAmount() {
    if (amountTouched) return;
    const items = form.getValues("lineItems") ?? [];
    const sum = items.reduce((s, li) => s + (li?.amountCents ?? 0), 0);
    form.setValue("amountCents", sum, { shouldValidate: false });
  }

  const error = form.formState.errors.lineItems;

  return (
    <div className="space-y-2">
      {fields.map((field, i) => (
        <div key={field.id} className="flex items-start gap-2">
          <Input
            placeholder="Description"
            className="flex-1 h-8 text-sm"
            {...form.register(`lineItems.${i}.description`)}
          />
          <div className="relative w-28">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="pl-5 h-8 text-sm text-right w-28"
              value={
                (form.watch(`lineItems.${i}.amountCents`) ?? 0) / 100 || ""
              }
              onChange={(e) => {
                const cents = Math.round(
                  parseFloat(e.target.value || "0") * 100,
                );
                form.setValue(
                  `lineItems.${i}.amountCents`,
                  isNaN(cents) ? 0 : cents,
                );
                updateBillAmount();
              }}
            />
          </div>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            {...form.register(`lineItems.${i}.type`)}>
            <option value="EXPENSE">Expense</option>
            <option value="ITEM">Item</option>
          </select>
          <button
            type="button"
            onClick={() => {
              remove(i);
              updateBillAmount();
            }}
            className="mt-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <XIcon className="size-3.5" />
          </button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={() =>
          append({ description: "", amountCents: 0, type: "EXPENSE" })
        }>
        <PlusIcon className="size-3" />
        Add line item
      </Button>

      {error && (
        <p className={cn("text-xs text-destructive")}>
          {typeof error.message === "string"
            ? error.message
            : "Check line items"}
        </p>
      )}
    </div>
  );
}
