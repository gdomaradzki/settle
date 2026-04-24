'use client';
import { useState, useEffect } from 'react';
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react';
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
import { buttonVariants } from '@/components/ui/button';
import { AddVendorDialog } from '@/features/vendors/components/add-vendor-dialog';

interface Props {
  value: string | null;
  onChange: (vendorId: string) => void;
  initialVendorName?: string;
}

export function VendorCombobox({ value, onChange, initialVendorName }: Props) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialName, setCreateInitialName] = useState('');
  const [search, setSearch] = useState('');

  const { data: vendors } = trpc.vendor.list.useQuery();

  // On mount, try to match the extracted vendor name
  useEffect(() => {
    if (!initialVendorName || !vendors) return;
    const match = vendors.find(
      (v) => v.name.toLowerCase() === initialVendorName.toLowerCase(),
    );
    if (match) {
      onChange(match.id);
    } else if (initialVendorName) {
      setCreateInitialName(initialVendorName);
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
                    setCreateInitialName(search);
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

      <AddVendorDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialName={createInitialName}
        onCreated={(v) => onChange(v.id)}
      />
    </>
  );
}
