'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon } from 'lucide-react';
import { trpc } from '@/lib/trpc-client';
import { formatUSD } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AddVendorDialog } from './add-vendor-dialog';

export type VendorWithOutstanding = {
  id: string;
  name: string;
  email: string | null;
  paymentMethod: 'ACH' | 'CHECK';
  achAccountLast4: string | null;
  achRoutingLast4: string | null;
  mailingAddress: string | null;
  defaultGlCategory: string | null;
  createdAt: Date;
  outstandingCount: number;
  outstandingCents: number;
};

function accountSummary(vendor: VendorWithOutstanding): string {
  if (vendor.paymentMethod === 'ACH' && vendor.achAccountLast4) {
    return `****${vendor.achAccountLast4}`;
  }
  if (vendor.mailingAddress) {
    const addr = vendor.mailingAddress;
    return addr.length > 40 ? addr.slice(0, 40) + '…' : addr;
  }
  return '—';
}

function outstandingLabel(count: number, cents: number): string {
  if (count === 0) return '0 · —';
  return `${count} · ${formatUSD(cents)}`;
}

interface Props {
  initialVendors: VendorWithOutstanding[];
}

export function VendorsTable({ initialVendors }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const utils = trpc.useUtils();
  const router = useRouter();

  const { data: vendors } = trpc.vendor.list.useQuery(undefined, {
    initialData: initialVendors as VendorWithOutstanding[],
  });

  const vendorList = (vendors ?? initialVendors) as VendorWithOutstanding[];

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-foreground">Vendors</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <PlusIcon className="mr-1.5 size-3.5" />
          Add vendor
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col">Name</TableHead>
              <TableHead scope="col">Method</TableHead>
              <TableHead scope="col" className="hidden sm:table-cell">Account</TableHead>
              <TableHead scope="col" className="hidden md:table-cell">GL Category</TableHead>
              <TableHead scope="col" className="text-right">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendorList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No vendors yet. Click "+ Add vendor" to create one.
                </TableCell>
              </TableRow>
            ) : (
              vendorList.map((v) => (
                <TableRow
                  key={v.id}
                  tabIndex={0}
                  title="View outstanding bills"
                  onClick={() => router.push(`/bills?vendor=${v.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`/bills?vendor=${v.id}`)}
                  className="cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/40 outline-none"
                >
                  <TableCell className="py-3 font-medium">{v.name}</TableCell>
                  <TableCell className="py-3">
                    <Badge variant={v.paymentMethod === 'ACH' ? 'secondary' : 'outline'} className="text-xs">
                      {v.paymentMethod === 'ACH' ? 'ACH' : 'Check'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell py-3 text-sm text-muted-foreground font-mono">
                    {accountSummary(v)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-3 text-sm text-muted-foreground">
                    {v.defaultGlCategory ?? '—'}
                  </TableCell>
                  <TableCell className="py-3 text-right tabular-nums text-sm">
                    {outstandingLabel(v.outstandingCount, v.outstandingCents)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AddVendorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => utils.vendor.list.invalidate()}
      />
    </div>
  );
}
