"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CalendarIcon } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { formatUSD } from "@/lib/money";
import { formatAbsoluteDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { VendorCombobox } from "./vendor-combobox";
import { LineItemsField } from "./line-items-field";
import {
  billFormSchema,
  type BillFormValues,
  type InvoiceExtraction,
} from "../schemas";

interface Props {
  initialExtraction?: InvoiceExtraction | null;
  pdfUrl?: string | null;
  onReset?: () => void;
}

function DatePicker({
  value,
  onChange,
  placeholder,
}: {
  value?: Date;
  onChange: (d: Date) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={(o) => setOpen(o)}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-start font-normal",
          !value && "text-muted-foreground",
        )}>
        <CalendarIcon className="mr-2 size-3.5" />
        {value ? formatAbsoluteDate(value) : (placeholder ?? "Pick a date")}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            if (d) {
              onChange(d);
              setOpen(false);
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export function BillIntakeForm({ initialExtraction, pdfUrl, onReset }: Props) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [amountTouched, setAmountTouched] = useState(false);
  // Reset amountTouched when extraction changes using derived-state pattern
  const [prevExtraction, setPrevExtraction] = useState(initialExtraction);
  if (prevExtraction !== initialExtraction) {
    setPrevExtraction(initialExtraction);
    setAmountTouched(false);
  }
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Lazy initializer so dates are computed once at mount, not on every render
  const [initialDates] = useState(() => ({
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 86_400_000),
  }));

  const form = useForm<BillFormValues>({
    resolver: zodResolver(billFormSchema),
    defaultValues: {
      vendorId: "",
      invoiceNumber: "",
      amountCents: 0,
      issueDate: initialDates.issueDate,
      dueDate: initialDates.dueDate,
      memo: "",
      glCategory: "",
      lineItems: [{ description: "", amountCents: 0, type: "EXPENSE" }],
    },
  });

  const createBill = trpc.bill.create.useMutation();
  const createAndSubmit = trpc.bill.createAndSubmit.useMutation();

  const vendorId = useWatch({ control: form.control, name: "vendorId" });
  const amountCents = useWatch({ control: form.control, name: "amountCents" });
  const issueDate = useWatch({ control: form.control, name: "issueDate" });
  const dueDate = useWatch({ control: form.control, name: "dueDate" });

  // Apply extraction data when it changes (form.setValue is an external side effect — correct use of effect)
  useEffect(() => {
    if (!initialExtraction) return;
    form.setValue("invoiceNumber", initialExtraction.invoiceNumber ?? "");
    form.setValue("amountCents", initialExtraction.amountCents);
    form.setValue("issueDate", new Date(initialExtraction.issueDate));
    form.setValue("dueDate", new Date(initialExtraction.dueDate));
    if (initialExtraction.lineItems.length > 0) {
      form.setValue("lineItems", initialExtraction.lineItems);
    }
  }, [initialExtraction, form]);

  async function handleSaveDraft(values: BillFormValues) {
    setSavingDraft(true);
    try {
      const bill = await createBill.mutateAsync({
        ...values,
        pdfPath: pdfUrl ?? undefined,
      });
      await utils.bill.list.prefetch({});
      toast.success("Draft saved");
      router.push(`/bills/${bill.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmitForApproval(values: BillFormValues) {
    setSubmitting(true);
    try {
      const bill = await createAndSubmit.mutateAsync({
        ...values,
        pdfPath: pdfUrl ?? undefined,
      });
      await utils.bill.list.prefetch({});
      toast.success("Bill submitted");
      router.push(`/bills/${bill.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const isLoading = savingDraft || submitting;
  const errors = form.formState.errors;

  const extractionFailed =
    initialExtraction !== null &&
    initialExtraction !== undefined &&
    !initialExtraction.vendorName &&
    initialExtraction.amountCents === 0;

  return (
    <form className="space-y-5">
      {onReset && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {initialExtraction && !extractionFailed
              ? "✓ Extracted from PDF"
              : "Manual entry"}
          </p>
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Replace PDF
          </button>
        </div>
      )}

      {extractionFailed && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          We couldn&apos;t extract this automatically. Please fill it in
          manually.
        </div>
      )}

      {/* Vendor */}
      <div className="space-y-1.5">
        <Label>
          Vendor <span className="text-destructive">*</span>
        </Label>
        <VendorCombobox
          value={vendorId || null}
          onChange={(id) =>
            form.setValue("vendorId", id, { shouldValidate: true })
          }
          initialVendorName={initialExtraction?.vendorName || undefined}
        />
        {errors.vendorId && (
          <p className="text-xs text-destructive">{errors.vendorId.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Invoice # */}
        <div className="space-y-1.5">
          <Label>Invoice #</Label>
          <Input
            className="h-8 text-sm"
            placeholder="INV-001"
            {...form.register("invoiceNumber")}
          />
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <Label>
            Amount <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              step="0.01"
              min="0"
              className="pl-5 h-8 text-sm"
              value={(amountCents ?? 0) / 100 || ""}
              onChange={(e) => {
                setAmountTouched(true);
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

        {/* Issue date */}
        <div className="space-y-1.5">
          <Label>
            Issue date <span className="text-destructive">*</span>
          </Label>
          <DatePicker
            value={issueDate}
            onChange={(d) =>
              form.setValue("issueDate", d, { shouldValidate: true })
            }
            placeholder="Issue date"
          />
        </div>

        {/* Due date */}
        <div className="space-y-1.5">
          <Label>
            Due date <span className="text-destructive">*</span>
          </Label>
          <DatePicker
            value={dueDate}
            onChange={(d) =>
              form.setValue("dueDate", d, { shouldValidate: true })
            }
            placeholder="Due date"
          />
          {errors.dueDate && (
            <p className="text-xs text-destructive">{errors.dueDate.message}</p>
          )}
        </div>
      </div>

      {/* GL category */}
      <div className="space-y-1.5">
        <Label>GL category</Label>
        <Input
          className="h-8 text-sm"
          placeholder="e.g. Infrastructure"
          {...form.register("glCategory")}
        />
      </div>

      {/* Memo */}
      <div className="space-y-1.5">
        <Label>Memo</Label>
        <Textarea
          rows={2}
          className="resize-none text-sm"
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
        <LineItemsField form={form} amountTouched={amountTouched} />
      </div>

      <Separator />

      {/* Footer */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Total:{" "}
          <span className="font-medium text-foreground">
            {formatUSD(amountCents ?? 0)}
          </span>
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={form.handleSubmit(handleSaveDraft)}>
            {savingDraft ? "Saving…" : "Save as draft"}
          </Button>
          <Button
            type="button"
            disabled={isLoading}
            onClick={form.handleSubmit(handleSubmitForApproval)}>
            {submitting ? "Submitting…" : "Submit for approval"}
          </Button>
        </div>
      </div>
    </form>
  );
}
