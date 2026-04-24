import type { InvoiceExtraction } from '../schemas';

// Dates relative to today so the demo always has plausible-looking invoices
function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  return daysFromNow(-n);
}

const CANNED: Record<string, InvoiceExtraction> = {
  'aws-invoice.pdf': {
    vendorName: 'Amazon Web Services',
    invoiceNumber: 'AWS-2026-05-INV',
    amountCents: 842_300,
    issueDate: daysAgo(15),
    dueDate: daysFromNow(15),
    lineItems: [
      { description: 'EC2 compute (t3.xlarge × 3)', amountCents: 412_400, type: 'EXPENSE' },
      { description: 'S3 storage (500 GB)', amountCents: 189_500, type: 'EXPENSE' },
      { description: 'Data transfer out', amountCents: 240_400, type: 'EXPENSE' },
    ],
  },
  'wework-invoice.pdf': {
    vendorName: 'WeWork',
    invoiceNumber: 'WW-2026-05',
    amountCents: 780_000,
    issueDate: today(),
    dueDate: daysFromNow(30),
    lineItems: [
      { description: 'Private office suite — May', amountCents: 600_000, type: 'EXPENSE' },
      { description: 'Conference room credits', amountCents: 100_000, type: 'EXPENSE' },
      { description: 'Parking (2 spots)', amountCents: 80_000, type: 'EXPENSE' },
    ],
  },
  'latham-invoice.pdf': {
    vendorName: 'Latham & Watkins LLP',
    invoiceNumber: 'LW-2026-INV-912',
    amountCents: 1_250_000,
    issueDate: daysAgo(5),
    dueDate: daysFromNow(25),
    lineItems: [
      { description: 'Legal counsel — Series B preparation (25 hrs)', amountCents: 1_000_000, type: 'EXPENSE' },
      { description: 'Filing and registration fees', amountCents: 150_000, type: 'EXPENSE' },
      { description: 'Document preparation', amountCents: 100_000, type: 'EXPENSE' },
    ],
  },
  'notion-invoice.pdf': {
    vendorName: 'Notion Labs',
    invoiceNumber: 'NTN-2026-1043',
    amountCents: 89_000,
    issueDate: today(),
    dueDate: daysFromNow(30),
    lineItems: [
      { description: 'Notion Team Plan — 15 seats', amountCents: 45_000, type: 'EXPENSE' },
      { description: 'Notion AI add-on — 15 seats', amountCents: 44_000, type: 'EXPENSE' },
    ],
  },
};

const REASONABLE_DEFAULT: InvoiceExtraction = {
  vendorName: '',
  invoiceNumber: null,
  amountCents: 0,
  issueDate: today(),
  dueDate: daysFromNow(30),
  lineItems: [],
};

export function getCannedExtraction(filename: string): InvoiceExtraction {
  return CANNED[filename.toLowerCase()] ?? REASONABLE_DEFAULT;
}
