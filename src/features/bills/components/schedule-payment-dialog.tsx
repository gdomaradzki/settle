"use client";
import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatAbsoluteDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { BillWithRelations } from "../bill-service";
import type { PaymentMethod } from "@/generated/prisma/enums";

interface Props {
  bill: BillWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payDate: Date, method: PaymentMethod) => void;
  isPending?: boolean;
}

function defaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d;
}

export function SchedulePaymentDialog({
  bill,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: Props) {
  const [date, setDate] = useState<Date>(defaultDate);
  const [calOpen, setCalOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>(
    bill.vendor.paymentMethod as PaymentMethod,
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = date < today;

  function handleConfirm() {
    if (isPast) return;
    onConfirm(date, method);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Date picker */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Pay date</p>
            <Popover open={calOpen} onOpenChange={(o) => setCalOpen(o)}>
              <PopoverTrigger
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "w-full justify-start text-left font-normal",
                  isPast && "border-destructive text-destructive",
                )}>
                <CalendarIcon className="mr-2 size-4" />
                {formatAbsoluteDate(date)}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) {
                      setDate(d);
                      setCalOpen(false);
                    }
                  }}
                  disabled={{ before: today }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {isPast && (
              <p className="text-xs text-destructive">Select a future date.</p>
            )}
          </div>

          {/* Method */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Payment method</p>
            <div className="flex gap-4">
              {(["ACH", "CHECK"] as PaymentMethod[]).map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="method"
                    value={m}
                    checked={method === m}
                    onChange={() => setMethod(m)}
                    className="accent-foreground"
                  />
                  <span className="text-sm">
                    {m === "ACH" ? "ACH" : "Check"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isPast || isPending} onClick={handleConfirm}>
            {isPending ? "Scheduling…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
