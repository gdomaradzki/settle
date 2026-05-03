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
import {
  createTemplateInput,
  updateTemplateInput,
  type CreateTemplateInput,
  type UpdateTemplateInput,
} from "../schemas";

type ExistingTemplate = {
  id: string;
  description: string;
  amountCents: number;
  paymentDayOfMonth: number;
  memo: string | null;
  glCategory: string | null;
  endsAt: Date | null;
  maxOccurrences: number | null;
  requireApprovalPerInstance: boolean;
  vendor: { id: string; name: string };
  lineItems: { id: string; description: string; amountCents: number }[];
};

interface Props {
  template?: ExistingTemplate;
}

type CreateFormValues = CreateTemplateInput;
type UpdateFormValues = UpdateTemplateInput;

export function TemplateForm({ template }: Props) {
  const router = useRouter();
  const isEdit = !!template;

  const vendors = trpc.vendor.list.useQuery(undefined, { enabled: !isEdit });
  const createTemplate = trpc.templates.create.useMutation();
  const updateTemplate = trpc.templates.update.useMutation();

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createTemplateInput),
    defaultValues: {
      vendorId: "",
      description: "",
      amountCents: 1,
      paymentDayOfMonth: 1,
      memo: "",
      glCategory: "",
      endsAt: undefined,
      maxOccurrences: undefined,
      requireApprovalPerInstance: false,
      lineItems: [{ description: "", amountCents: 0 }],
    },
  });
  const updateForm = useForm<UpdateFormValues>({
    resolver: zodResolver(updateTemplateInput),
    defaultValues: template
      ? {
          id: template.id,
          description: template.description,
          amountCents: template.amountCents,
          memo: template.memo ?? "",
          glCategory: template.glCategory ?? "",
          endsAt: template.endsAt ?? undefined,
          maxOccurrences: template.maxOccurrences ?? undefined,
          requireApprovalPerInstance: template.requireApprovalPerInstance,
          lineItems: template.lineItems.map((li) => ({
            description: li.description,
            amountCents: li.amountCents,
          })),
        }
      : undefined,
  });

  // Use one form by mode. The unused one is harmless but never read.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = (isEdit ? updateForm : createForm) as any;

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const lineItems = useWatch({ control: form.control, name: "lineItems" });
  const totalCents = (lineItems ?? []).reduce(
    (sum: number, li: { amountCents?: number }) => sum + (li?.amountCents ?? 0),
    0,
  );

  async function onSubmitCreate(values: CreateFormValues) {
    const derivedTotal = values.lineItems.reduce(
      (sum, li) => sum + (li.amountCents ?? 0),
      0,
    );
    try {
      const t = await createTemplate.mutateAsync({
        ...values,
        amountCents: derivedTotal,
      });
      toast.success("Recurring bill created");
      router.push(`/templates/${t.id}`);
    } catch (e) {
      toast.error((e as Error).message ?? "Something went wrong");
    }
  }

  async function onSubmitUpdate(values: UpdateFormValues) {
    const derivedTotal = values.lineItems.reduce(
      (sum, li) => sum + (li.amountCents ?? 0),
      0,
    );
    try {
      await updateTemplate.mutateAsync({
        ...values,
        amountCents: derivedTotal,
      });
      toast.success("Recurring bill updated");
      router.push(`/templates/${values.id}`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message ?? "Something went wrong");
    }
  }

  const errors = form.formState.errors;
  const isPending = isEdit ? updateTemplate.isPending : createTemplate.isPending;
  const heading = isEdit ? "Edit recurring bill" : "New recurring bill";
  const submitLabel = isEdit
    ? isPending
      ? "Saving…"
      : "Save changes"
    : isPending
      ? "Creating…"
      : "Create recurring bill";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center gap-4">
        <Link
          href={isEdit ? `/templates/${template!.id}` : "/templates"}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeftIcon className="size-3.5" />
          {isEdit ? "Back" : "Recurring Bills"}
        </Link>
        <h1 className="text-lg font-semibold text-foreground">{heading}</h1>
      </div>

      <form
        onSubmit={
          isEdit
            ? updateForm.handleSubmit(onSubmitUpdate)
            : createForm.handleSubmit(onSubmitCreate)
        }
        className="space-y-5">
        {/* Vendor */}
        <div className="space-y-1.5">
          <Label>
            Vendor {!isEdit && <span className="text-destructive">*</span>}
          </Label>
          {isEdit ? (
            <p className="rounded-md border border-input bg-muted/40 px-3 py-1.5 text-sm text-foreground">
              {template!.vendor.name}
            </p>
          ) : (
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              {...createForm.register("vendorId")}>
              <option value="">Select vendor…</option>
              {vendors.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
          {!isEdit && errors.vendorId && (
            <p className="text-xs text-destructive">
              {errors.vendorId.message as string}
            </p>
          )}
          {isEdit && (
            <p className="text-xs text-muted-foreground">
              Vendor cannot be changed once a series exists.
            </p>
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
              {errors.description.message as string}
            </p>
          )}
        </div>

        {/* Payment day of month */}
        <div className="space-y-1.5">
          <Label>
            Pay vendor on day{" "}
            {!isEdit && <span className="text-destructive">*</span>}
          </Label>
          {isEdit ? (
            <p className="rounded-md border border-input bg-muted/40 px-3 py-1.5 text-sm text-foreground">
              Day {template!.paymentDayOfMonth}
            </p>
          ) : (
            <Input
              type="number"
              min={1}
              max={28}
              className="h-8 text-sm"
              {...createForm.register("paymentDayOfMonth", {
                valueAsNumber: true,
              })}
            />
          )}
          <p className="text-xs text-muted-foreground">
            {isEdit
              ? "Pay date is fixed at series creation. To change it, cancel and create a new series."
              : "1–28. Bills are created 10 days ahead for ACH, 15 for check."}
          </p>
          {!isEdit && errors.paymentDayOfMonth && (
            <p className="text-xs text-destructive">
              {errors.paymentDayOfMonth.message as string}
            </p>
          )}
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

        {/* End conditions */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Ends on</Label>
            <Input
              type="date"
              className="h-8 text-sm"
              defaultValue={
                template?.endsAt
                  ? new Date(template.endsAt).toISOString().slice(0, 10)
                  : ""
              }
              {...form.register("endsAt", {
                setValueAs: (v: string) => (v ? new Date(v) : undefined),
              })}
            />
            <p className="text-xs text-muted-foreground">
              No bill generated for pay dates after this.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Max occurrences</Label>
            <Input
              type="number"
              min={1}
              className="h-8 text-sm"
              {...form.register("maxOccurrences", {
                setValueAs: (v: string) =>
                  v === "" || v === null || v === undefined
                    ? undefined
                    : Number(v),
              })}
            />
            <p className="text-xs text-muted-foreground">
              Stops after this many bills have been generated.
            </p>
          </div>
        </div>

        {/* Approval toggle */}
        <div className="flex items-start gap-2">
          <input
            id="requireApprovalPerInstance"
            type="checkbox"
            className="mt-0.5"
            {...form.register("requireApprovalPerInstance")}
          />
          <div>
            <Label htmlFor="requireApprovalPerInstance" className="text-sm">
              Require approval each cycle
            </Label>
            <p className="text-xs text-muted-foreground">
              Each generated bill goes to PENDING_APPROVAL instead of paying
              automatically. Approving sends it straight to SCHEDULED.
            </p>
          </div>
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
                  {...form.register(`lineItems.${idx}.description` as const)}
                />
                {errors.lineItems?.[idx]?.description && (
                  <p className="mt-0.5 text-xs text-destructive">
                    {errors.lineItems[idx].description?.message as string}
                  </p>
                )}
              </div>
              <div className="w-28">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="pl-5 h-8 text-sm"
                    value={
                      ((form.watch(`lineItems.${idx}.amountCents` as const) ??
                        0) as number) / 100 || ""
                    }
                    onChange={(e) => {
                      const cents = Math.round(
                        parseFloat(e.target.value || "0") * 100,
                      );
                      form.setValue(
                        `lineItems.${idx}.amountCents` as const,
                        isNaN(cents) ? 0 : cents,
                        { shouldValidate: true },
                      );
                    }}
                  />
                </div>
                {errors.lineItems?.[idx]?.amountCents && (
                  <p className="mt-0.5 text-xs text-destructive">
                    {errors.lineItems[idx].amountCents?.message as string}
                  </p>
                )}
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
          <Button type="submit" disabled={isPending}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
