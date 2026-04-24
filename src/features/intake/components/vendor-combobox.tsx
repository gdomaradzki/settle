"use client";
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { AddVendorDialog } from "@/features/vendors/components/add-vendor-dialog";

interface Props {
  value: string | null;
  onChange: (vendorId: string) => void;
  initialVendorName?: string;
}

export function VendorCombobox({ value, onChange, initialVendorName }: Props) {
  const [open, setOpen] = useState(false);
  const [manualCreateOpen, setManualCreateOpen] = useState(false);
  const [manualCreateName, setManualCreateName] = useState("");
  const [search, setSearch] = useState("");
  // Track which initialVendorName the user has already dismissed the auto-dialog for
  const [dismissedName, setDismissedName] = useState<string | null>(null);

  // Ref to call the latest onChange without it being an effect dependency
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  });

  const { data: vendors } = trpc.vendor.list.useQuery();

  // Derived: find the vendor matching initialVendorName (null if no match or not yet loaded)
  const initialMatch = useMemo(() => {
    if (!vendors || !initialVendorName) return undefined;
    return vendors.find(
      (v) => v.name.toLowerCase() === initialVendorName.toLowerCase(),
    );
  }, [initialVendorName, vendors]);

  // Auto-select matched vendor via effect (calling external callback is a legitimate side effect)
  useEffect(() => {
    if (initialMatch) {
      onChangeRef.current(initialMatch.id);
    }
  }, [initialMatch]);

  // Derived: name to pre-fill in the create dialog when no vendor matches the extracted name
  const autoCreateName =
    vendors && initialVendorName && !initialMatch ? initialVendorName : null;
  const autoCreateOpen =
    autoCreateName !== null && autoCreateName !== dismissedName;

  const createOpen = manualCreateOpen || autoCreateOpen;
  const createInitialName = autoCreateOpen
    ? (autoCreateName ?? "")
    : manualCreateName;

  function handleCreateOpenChange(open: boolean) {
    if (!open && autoCreateOpen) {
      // User dismissed the auto-open dialog — don't reopen for this name
      setDismissedName(autoCreateName);
    }
    setManualCreateOpen(open);
  }

  const selectedVendor = vendors?.find((v) => v.id === value);
  const filtered = vendors?.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <Popover open={open} onOpenChange={(o) => setOpen(o)}>
        <PopoverTrigger
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-between font-normal",
            !selectedVendor && "text-muted-foreground",
          )}>
          {selectedVendor?.name ?? "Select vendor…"}
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
                      setSearch("");
                      setOpen(false);
                    }}>
                    <CheckIcon
                      className={cn(
                        "mr-2 size-3.5",
                        value === vendor.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {vendor.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setManualCreateName(search);
                    setOpen(false);
                    setManualCreateOpen(true);
                  }}>
                  <PlusIcon className="mr-2 size-3.5" />
                  Create new vendor{search ? ` &ldquo;${search}&rdquo;` : ""}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <AddVendorDialog
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        initialName={createInitialName}
        onCreated={(v) => onChange(v.id)}
      />
    </>
  );
}
