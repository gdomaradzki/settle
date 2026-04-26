"use client";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Must be a valid email").optional().or(z.literal("")),
  paymentMethod: z.enum(["ACH", "CHECK"]),
  defaultGlCategory: z.string().optional(),
  achAccountLast4: z
    .string()
    .regex(/^\d{4}$/, "Must be exactly 4 digits")
    .optional()
    .or(z.literal("")),
  achRoutingLast4: z
    .string()
    .regex(/^\d{4}$/, "Must be exactly 4 digits")
    .optional()
    .or(z.literal("")),
  mailingAddress: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: "",
  email: "",
  paymentMethod: "ACH",
  defaultGlCategory: "",
  achAccountLast4: "",
  achRoutingLast4: "",
  mailingAddress: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (vendor: { id: string; name: string }) => void;
  initialName?: string;
}

export function AddVendorDialog({
  open,
  onOpenChange,
  onCreated,
  initialName,
}: Props) {
  const {
    register,
    control,
    reset,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    shouldUnregister: false, // preserve ACH/CHECK values when fields toggle
    defaultValues: EMPTY,
  });

  const method = useWatch({ control, name: "paymentMethod" });
  const nameValue = useWatch({ control, name: "name" });
  const utils = trpc.useUtils();

  const { data: existingVendors } = trpc.vendor.list.useQuery();

  // Client-side duplicate check — avoids the round-trip for the common case
  const isDuplicateName =
    nameValue.trim().length > 0 &&
    (existingVendors?.some(
      (v) => v.name.toLowerCase() === nameValue.trim().toLowerCase(),
    ) ??
      false);

  useEffect(() => {
    if (open) {
      reset({ ...EMPTY, name: initialName ?? "" });
    }
  }, [open, initialName, reset]);

  const createVendor = trpc.vendor.create.useMutation({
    onSuccess: (v) => {
      utils.vendor.list.invalidate();
      toast.success(`Vendor "${v.name}" created`);
      onCreated?.(v);
      onOpenChange(false);
    },
    onError: (e) => {
      const isDuplicate =
        e.message === "A vendor with this name already exists." ||
        e.message.includes("Unique constraint failed");
      if (isDuplicate) {
        setError("name", { message: "A vendor with this name already exists." });
      } else {
        toast.error(e.message);
      }
    },
  });

  const onSubmit = (data: FormValues) => {
    createVendor.mutate({
      name: data.name,
      email: data.email || undefined,
      paymentMethod: data.paymentMethod,
      defaultGlCategory: data.defaultGlCategory || undefined,
      achAccountLast4: data.achAccountLast4 || undefined,
      achRoutingLast4: data.achRoutingLast4 || undefined,
      mailingAddress: data.mailingAddress || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New vendor</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Name — always visible */}
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input placeholder="Vendor name" autoFocus {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
            {!errors.name && isDuplicateName && (
              <p className="text-xs text-destructive">
                A vendor with this name already exists.
              </p>
            )}
          </div>

          {/* Email — always visible */}
          <div className="space-y-1.5">
            <Label>Email (optional)</Label>
            <Input
              placeholder="billing@vendor.com"
              type="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Payment method — always visible */}
          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <div className="flex gap-4">
              {(["ACH", "CHECK"] as const).map((m) => (
                <label
                  key={m}
                  className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    value={m}
                    className="accent-zinc-900 dark:accent-zinc-300"
                    {...register("paymentMethod")}
                  />
                  {m === "ACH" ? "ACH" : "Check"}
                </label>
              ))}
            </div>
          </div>

          {/* GL Category — always visible */}
          <div className="space-y-1.5">
            <Label>Default GL category (optional)</Label>
            <Input
              placeholder="e.g. Infrastructure"
              {...register("defaultGlCategory")}
            />
          </div>

          {/* ACH fields — conditional */}
          {method === "ACH" && (
            <>
              <div className="space-y-1.5">
                <Label>Account last 4 (optional)</Label>
                <Input
                  placeholder="1234"
                  maxLength={4}
                  {...register("achAccountLast4")}
                />
                {errors.achAccountLast4 && (
                  <p className="text-xs text-destructive">
                    {errors.achAccountLast4.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Routing last 4 (optional)</Label>
                <Input
                  placeholder="5678"
                  maxLength={4}
                  {...register("achRoutingLast4")}
                />
                {errors.achRoutingLast4 && (
                  <p className="text-xs text-destructive">
                    {errors.achRoutingLast4.message}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Check field — conditional */}
          {method === "CHECK" && (
            <div className="space-y-1.5">
              <Label>Mailing address (optional)</Label>
              <textarea
                rows={3}
                placeholder="123 Main St, Anytown, USA 12345"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                {...register("mailingAddress")}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={createVendor.isPending || isDuplicateName}
            onClick={handleSubmit(onSubmit)}>
            {createVendor.isPending ? "Creating…" : "Create vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
