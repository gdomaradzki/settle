import { Separator } from "@/components/ui/separator";
import { formatUSD } from "@/lib/money";
import { formatAbsoluteDate } from "@/lib/dates";
import type { BillWithRelations } from "../bill-service";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function BillFields({ bill }: { bill: BillWithRelations }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Field
          label="Vendor"
          value={
            <span>
              {bill.vendor.name}
              {bill.vendor.email && (
                <span className="block text-xs font-normal text-muted-foreground">
                  {bill.vendor.email}
                </span>
              )}
            </span>
          }
        />
        <Field label="Invoice #" value={bill.invoiceNumber} />
        <Field label="Amount" value={formatUSD(bill.amountCents)} />
        <Field label="Currency" value={bill.currency} />
        <Field
          label="Issued"
          value={formatAbsoluteDate(new Date(bill.issueDate))}
        />
        <Field label="Due" value={formatAbsoluteDate(new Date(bill.dueDate))} />
        {bill.glCategory && (
          <Field label="GL category" value={bill.glCategory} />
        )}
        {bill.vendor.paymentMethod && (
          <Field label="Payment method" value={bill.vendor.paymentMethod} />
        )}
      </dl>

      {bill.memo && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Memo</p>
          <p className="text-sm text-foreground">{bill.memo}</p>
        </div>
      )}

      {bill.lineItems.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Line items ({bill.lineItems.length})
            </p>
            <ul className="space-y-1.5">
              {bill.lineItems.map((li) => (
                <li
                  key={li.id}
                  className="flex items-center justify-between gap-4">
                  <span className="text-sm text-foreground truncate">
                    {li.description}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground shrink-0">
                    {formatUSD(li.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
