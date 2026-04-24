'use client';
import { useState, useEffect } from 'react';
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc-client';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  value: string | null;
  onChange: (vendorId: string) => void;
  initialVendorName?: string;
}

export function VendorCombobox({ value, onChange, initialVendorName }: Props) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newMethod, setNewMethod] = useState<'ACH' | 'CHECK'>('ACH');
  const utils = trpc.useUtils();

  const { data: vendors } = trpc.vendor.list.useQuery();
  const createVendor = trpc.vendor.create.useMutation({
    onSuccess: (v) => {
      utils.vendor.list.invalidate();
      onChange(v.id);
      setCreateOpen(false);
      setNewName('');
      setNewEmail('');
      toast.success(`Vendor "${v.name}" created`);
    },
    onError: (e) => toast.error(e.message),
  });

  // On mount, try to match the extracted vendor name
  useEffect(() => {
    if (!initialVendorName || !vendors) return;
    const match = vendors.find(
      (v) => v.name.toLowerCase() === initialVendorName.toLowerCase(),
    );
    if (match) {
      onChange(match.id);
    } else if (initialVendorName) {
      setNewName(initialVendorName);
      setCreateOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVendorName, vendors]);

  const selectedVendor = vendors?.find((v) => v.id === value);
  const filtered = vendors?.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <Popover open={open} onOpenChange={(o) => setOpen(o)}>
        <PopoverTrigger
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'w-full justify-between font-normal',
            !selectedVendor && 'text-muted-foreground',
          )}
        >
          {selectedVendor?.name ?? 'Select vendor…'}
          <ChevronsUpDownIcon className="ml-2 size-3.5 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" side="bottom" align="start">
          <Command>
            <CommandInput
              placeholder="Search vendors…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                No vendors found.
              </CommandEmpty>
              <CommandGroup>
                {filtered?.map((vendor) => (
                  <CommandItem
                    key={vendor.id}
                    value={vendor.name}
                    onSelect={() => {
                      onChange(vendor.id);
                      setSearch('');
                      setOpen(false);
                    }}
                  >
                    <CheckIcon
                      className={cn('mr-2 size-3.5', value === vendor.id ? 'opacity-100' : 'opacity-0')}
                    />
                    {vendor.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setNewName(search);
                    setOpen(false);
                    setCreateOpen(true);
                  }}
                >
                  <PlusIcon className="mr-2 size-3.5" />
                  Create new vendor{search ? ` "${search}"` : ''}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Create vendor dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => setCreateOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Vendor name"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email (optional)</Label>
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="billing@vendor.com"
                type="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment method</Label>
              <div className="flex gap-4">
                {(['ACH', 'CHECK'] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="new-method"
                      value={m}
                      checked={newMethod === m}
                      onChange={() => setNewMethod(m)}
                      className="accent-foreground"
                    />
                    {m === 'ACH' ? 'ACH' : 'Check'}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newName.trim() || createVendor.isPending}
              onClick={() =>
                createVendor.mutate({
                  name: newName.trim(),
                  email: newEmail.trim() || undefined,
                  paymentMethod: newMethod,
                })
              }
            >
              {createVendor.isPending ? 'Creating…' : 'Create vendor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
