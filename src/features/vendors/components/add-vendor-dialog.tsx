'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (vendor: { id: string; name: string }) => void;
  initialName?: string;
}

export function AddVendorDialog({ open, onOpenChange, onCreated, initialName }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState<'ACH' | 'CHECK'>('ACH');
  const utils = trpc.useUtils();

  // Reset and pre-fill whenever the dialog opens
  useEffect(() => {
    if (open) {
      setName(initialName ?? '');
      setEmail('');
      setMethod('ACH');
    }
  }, [open, initialName]);

  const createVendor = trpc.vendor.create.useMutation({
    onSuccess: (v) => {
      utils.vendor.list.invalidate();
      toast.success(`Vendor "${v.name}" created`);
      onCreated?.(v);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New vendor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vendor name"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email (optional)</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="billing@vendor.com"
              type="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <div className="flex gap-4">
              {(['ACH', 'CHECK'] as const).map((m) => (
                <label key={m} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="vendor-method"
                    value={m}
                    checked={method === m}
                    onChange={() => setMethod(m)}
                    className="accent-foreground"
                  />
                  {m === 'ACH' ? 'ACH' : 'Check'}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || createVendor.isPending}
            onClick={() =>
              createVendor.mutate({
                name: name.trim(),
                email: email.trim() || undefined,
                paymentMethod: method,
              })
            }
          >
            {createVendor.isPending ? 'Creating…' : 'Create vendor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
