"use client";
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
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
  // Optimistic entry for a vendor just created — shown immediately before the query refetches
  const [optimisticVendor, setOptimisticVendor] = useState<{
    id: string;
    name: string;
  } | null>(null);

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

  // Auto-select matched vendor via effect. Depend on the ID (primitive), not the object —
  // vendors is a new array on every refetch, which would re-fire the effect and overwrite
  // any manual selection the user made after the initial auto-select.
  const initialMatchId = initialMatch?.id;
  useEffect(() => {
    if (initialMatchId) {
      onChangeRef.current(initialMatchId);
    }
  }, [initialMatchId]);

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

  // Once the refetch catches up, drop the optimistic entry so canonical data takes over
  useEffect(() => {
    if (optimisticVendor && vendors?.some((v) => v.id === optimisticVendor.id)) {
      setOptimisticVendor(null);
    }
  }, [vendors, optimisticVendor]);

  const selectedVendor =
    vendors?.find((v) => v.id === value) ??
    (optimisticVendor?.id === value ? optimisticVendor : undefined);
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
              {/* CommandEmpty from cmdk never fires here because the footer CommandItem
                  is registered in the same Command context and always matches the search
                  (its text includes the query). Use a plain conditional render instead. */}
              {search && filtered?.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No vendors match &ldquo;{search}&rdquo;.
                </p>
              )}
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
            </CommandList>
            {/* Pinned footer — lives outside CommandList so it never scrolls away */}
            <div className="border-t p-1">
              <CommandItem
                onSelect={() => {
                  setManualCreateName(search);
                  setOpen(false);
                  setManualCreateOpen(true);
                }}>
                <PlusIcon className="mr-2 size-3.5" />
                {search ? `Create "${search}"` : "Create new vendor"}
              </CommandItem>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      <AddVendorDialog
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        initialName={createInitialName}
        onCreated={(v) => {
          onChange(v.id);
          setOptimisticVendor(v);
          setOpen(false);
        }}
      />
    </>
  );
}
