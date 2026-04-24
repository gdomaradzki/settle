"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { BillWithRelations } from "../bill-service";

interface Props {
  bill: BillWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
}

export function RejectBillDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: Props) {
  const [reason, setReason] = useState("");
  const isValid = reason.trim().length >= 3;

  function handleConfirm() {
    if (!isValid) return;
    onConfirm(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject bill</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="reject-reason">Rejection reason</Label>
          <Textarea
            id="reject-reason"
            placeholder="Explain why this bill is being rejected…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="resize-none"
          />
          {reason.length > 0 && !isValid && (
            <p className="text-xs text-destructive">
              Reason must be at least 3 characters.
            </p>
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
            variant="destructive"
            disabled={!isValid || isPending}
            onClick={handleConfirm}>
            {isPending ? "Rejecting…" : "Reject bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
