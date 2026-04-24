import { PrismaClient, UserRole, PaymentMethod, BillStatus, LineItemType } from '../generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_UNPOOLED! }),
});

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

type VendorRef = { id: string; defaultGlCategory: string | null };

type BillSeed = {
  vendor: VendorRef;
  invoiceNumber?: string;
  amountCents: number;
  issueDate: Date;
  dueDate: Date;
  status: BillStatus;
  memo?: string;
  lineItems: { description: string; amountCents: number; type?: LineItemType }[];
  submittedAt?: Date;
  approvedAt?: Date;
  approvedById?: string;
  rejectedAt?: Date;
  rejectedReason?: string;
  scheduledPayDate?: Date;
  scheduledMethod?: PaymentMethod;
  paidAt?: Date;
  paymentConfirmation?: string;
};

async function createBill(seed: BillSeed, createdById: string) {
  const bill = await db.bill.create({
    data: {
      vendorId: seed.vendor.id,
      invoiceNumber: seed.invoiceNumber,
      amountCents: seed.amountCents,
      currency: 'USD',
      issueDate: seed.issueDate,
      dueDate: seed.dueDate,
      status: seed.status,
      memo: seed.memo,
      glCategory: seed.vendor.defaultGlCategory,
      submittedAt: seed.submittedAt,
      approvedAt: seed.approvedAt,
      approvedById: seed.approvedById,
      rejectedAt: seed.rejectedAt,
      rejectedReason: seed.rejectedReason,
      scheduledPayDate: seed.scheduledPayDate,
      scheduledMethod: seed.scheduledMethod,
      paidAt: seed.paidAt,
      paymentConfirmation: seed.paymentConfirmation,
      createdById,
    },
  });

  if (seed.lineItems.length > 0) {
    await db.billLineItem.createMany({
      data: seed.lineItems.map((li) => ({
        billId: bill.id,
        description: li.description,
        amountCents: li.amountCents,
        type: li.type ?? LineItemType.EXPENSE,
      })),
    });
  }

  type EventRow = { billId: string; type: string; actorId: string; payload?: { [key: string]: string }; createdAt: Date };
  const events: EventRow[] = [];

  events.push({ billId: bill.id, type: 'created', actorId: createdById, createdAt: seed.issueDate });

  if (seed.submittedAt) {
    events.push({ billId: bill.id, type: 'submitted', actorId: createdById, createdAt: seed.submittedAt });
  }
  if (seed.approvedAt && seed.approvedById) {
    events.push({ billId: bill.id, type: 'approved', actorId: seed.approvedById, createdAt: seed.approvedAt });
  }
  if (seed.rejectedAt && seed.approvedById) {
    events.push({
      billId: bill.id,
      type: 'rejected',
      actorId: seed.approvedById,
      payload: seed.rejectedReason ? { reason: seed.rejectedReason } : undefined,
      createdAt: seed.rejectedAt,
    });
  }
  if (seed.scheduledPayDate) {
    const scheduledAt = seed.approvedAt ? addDays(seed.approvedAt, 1) : addDays(seed.issueDate, 5);
    events.push({ billId: bill.id, type: 'scheduled', actorId: createdById, createdAt: scheduledAt });
  }
  if (seed.paidAt) {
    events.push({
      billId: bill.id,
      type: 'paid',
      actorId: createdById,
      payload: seed.paymentConfirmation ? { confirmation: seed.paymentConfirmation } : undefined,
      createdAt: seed.paidAt,
    });
  }

  await db.billEvent.createMany({ data: events });
  return bill;
}

async function main() {
  const now = new Date();

  // Wipe in FK order (idempotent re-run)
  await db.billEvent.deleteMany();
  await db.billLineItem.deleteMany();
  await db.bill.deleteMany();
  await db.vendor.deleteMany();
  await db.user.deleteMany();

  // ─── Users ─────────────────────────────────────────────────────────────────
  const gus = await db.user.create({
    data: { name: 'Gus Silva', email: 'gus@settle.demo', role: UserRole.SUBMITTER },
  });
  const ada = await db.user.create({
    data: { name: 'Ada Chen', email: 'ada@settle.demo', role: UserRole.APPROVER },
  });

  // ─── Vendors ────────────────────────────────────────────────────────────────
  const aws = await db.vendor.create({
    data: {
      name: 'AWS',
      email: 'billing@aws.amazon.com',
      paymentMethod: PaymentMethod.ACH,
      achAccountLast4: '4821',
      achRoutingLast4: '0260',
      defaultGlCategory: 'Infrastructure',
    },
  });
  const wework = await db.vendor.create({
    data: {
      name: 'WeWork',
      email: 'invoices@wework.com',
      paymentMethod: PaymentMethod.ACH,
      achAccountLast4: '3390',
      achRoutingLast4: '0265',
      defaultGlCategory: 'Rent & Occupancy',
    },
  });
  const latham = await db.vendor.create({
    data: {
      name: 'Latham & Watkins LLP',
      email: 'billing@lw.com',
      paymentMethod: PaymentMethod.CHECK,
      mailingAddress: '555 11th St NW, Washington, DC 20004',
      defaultGlCategory: 'Legal',
    },
  });
  const notion = await db.vendor.create({
    data: {
      name: 'Notion Labs',
      email: 'billing@notion.so',
      paymentMethod: PaymentMethod.ACH,
      achAccountLast4: '7741',
      achRoutingLast4: '0260',
      defaultGlCategory: 'Software & SaaS',
    },
  });
  const marcus = await db.vendor.create({
    data: {
      name: 'Marcus Lee Design',
      email: 'marcus@mldesign.co',
      paymentMethod: PaymentMethod.CHECK,
      mailingAddress: '240 Kent Ave, Brooklyn, NY 11249',
      defaultGlCategory: 'Design & Creative',
    },
  });

  // ─── Bills ──────────────────────────────────────────────────────────────────

  // 2 × DRAFT
  await createBill(
    {
      vendor: aws,
      invoiceNumber: 'AWS-2024-1101',
      amountCents: 120000,
      issueDate: addDays(now, -5),
      dueDate: addDays(now, 25),
      status: BillStatus.DRAFT,
      memo: 'Monthly cloud infrastructure',
      lineItems: [
        { description: 'EC2 compute (us-east-1)', amountCents: 75000 },
        { description: 'S3 storage', amountCents: 25000 },
        { description: 'Data transfer', amountCents: 20000 },
      ],
    },
    gus.id,
  );

  await createBill(
    {
      vendor: notion,
      invoiceNumber: 'NTN-2024-0892',
      amountCents: 45000,
      issueDate: addDays(now, -2),
      dueDate: addDays(now, 28),
      status: BillStatus.DRAFT,
      memo: 'Team plan renewal',
      lineItems: [{ description: 'Notion Team Plan — 15 seats × $3', amountCents: 45000 }],
    },
    gus.id,
  );

  // 3 × PENDING_APPROVAL — at least two above the $5 000 (500 000 cents) threshold
  await createBill(
    {
      vendor: latham,
      invoiceNumber: 'LW-2024-INV-889',
      amountCents: 1250000, // $12,500
      issueDate: addDays(now, -10),
      dueDate: addDays(now, 3),
      status: BillStatus.PENDING_APPROVAL,
      memo: 'Series A legal counsel — October',
      submittedAt: addDays(now, -8),
      lineItems: [
        { description: 'Attorney fees — 25 hrs @ $400', amountCents: 1000000 },
        { description: 'Filing fees', amountCents: 150000 },
        { description: 'Document preparation', amountCents: 100000 },
      ],
    },
    gus.id,
  );

  await createBill(
    {
      vendor: wework,
      invoiceNumber: 'WW-NOV-2024',
      amountCents: 780000, // $7,800
      issueDate: addDays(now, -7),
      dueDate: addDays(now, 5),
      status: BillStatus.PENDING_APPROVAL,
      memo: 'November office space',
      submittedAt: addDays(now, -6),
      lineItems: [
        { description: 'Private office — Suite 4B (Nov)', amountCents: 600000 },
        { description: 'Conference room credits', amountCents: 100000 },
        { description: 'Parking (2 spots)', amountCents: 80000 },
      ],
    },
    gus.id,
  );

  await createBill(
    {
      vendor: marcus,
      invoiceNumber: 'MLD-2024-047',
      amountCents: 65000, // $650 — below threshold; aged into 61+ bucket for aging report demo
      issueDate: addDays(now, -90),
      dueDate: addDays(now, -75),
      status: BillStatus.PENDING_APPROVAL,
      memo: 'Logo refresh — final delivery',
      submittedAt: addDays(now, -89),
      lineItems: [{ description: 'Final logo files + brand guide', amountCents: 65000 }],
    },
    gus.id,
  );

  // 2 × APPROVED
  await createBill(
    {
      vendor: aws,
      invoiceNumber: 'AWS-2024-1001',
      amountCents: 230000, // $2,300
      issueDate: addDays(now, -15),
      dueDate: addDays(now, 7),
      status: BillStatus.APPROVED,
      submittedAt: addDays(now, -13),
      approvedAt: addDays(now, -12),
      approvedById: ada.id,
      lineItems: [
        { description: 'EC2 compute', amountCents: 180000 },
        { description: 'RDS storage', amountCents: 50000 },
      ],
    },
    gus.id,
  );

  await createBill(
    {
      vendor: notion,
      invoiceNumber: 'NTN-2024-0791',
      amountCents: 89000, // $890 — aged into 31–60 bucket for aging report demo
      issueDate: addDays(now, -60),
      dueDate: addDays(now, -45),
      status: BillStatus.APPROVED,
      submittedAt: addDays(now, -58),
      approvedAt: addDays(now, -57),
      approvedById: ada.id,
      lineItems: [{ description: 'Notion AI add-on — 15 seats', amountCents: 89000 }],
    },
    gus.id,
  );

  // 3 × SCHEDULED
  await createBill(
    {
      vendor: wework,
      invoiceNumber: 'WW-OCT-2024',
      amountCents: 420000, // $4,200
      issueDate: addDays(now, -20),
      dueDate: addDays(now, 5),
      status: BillStatus.SCHEDULED,
      submittedAt: addDays(now, -18),
      approvedAt: addDays(now, -17),
      approvedById: ada.id,
      scheduledPayDate: addDays(now, 3),
      scheduledMethod: PaymentMethod.ACH,
      lineItems: [{ description: 'October office space', amountCents: 420000 }],
    },
    gus.id,
  );

  await createBill(
    {
      vendor: notion,
      invoiceNumber: 'NTN-2024-0753',
      amountCents: 175000, // $1,750
      issueDate: addDays(now, -12),
      dueDate: addDays(now, 12),
      status: BillStatus.SCHEDULED,
      submittedAt: addDays(now, -11),
      approvedAt: addDays(now, -10),
      approvedById: ada.id,
      scheduledPayDate: addDays(now, 8),
      scheduledMethod: PaymentMethod.ACH,
      lineItems: [{ description: 'Annual plan upgrade', amountCents: 175000 }],
    },
    gus.id,
  );

  await createBill(
    {
      vendor: marcus,
      invoiceNumber: 'MLD-2024-039',
      amountCents: 34000, // $340
      issueDate: addDays(now, -9),
      dueDate: addDays(now, 20),
      status: BillStatus.SCHEDULED,
      submittedAt: addDays(now, -8),
      approvedAt: addDays(now, -7),
      approvedById: ada.id,
      scheduledPayDate: addDays(now, 15),
      scheduledMethod: PaymentMethod.CHECK,
      lineItems: [{ description: 'Icon set revisions', amountCents: 34000 }],
    },
    gus.id,
  );

  // 3 × PAID
  await createBill(
    {
      vendor: aws,
      invoiceNumber: 'AWS-2024-0901',
      amountCents: 4850000, // $48,500
      issueDate: addDays(now, -75),
      dueDate: addDays(now, -45),
      status: BillStatus.PAID,
      submittedAt: addDays(now, -73),
      approvedAt: addDays(now, -72),
      approvedById: ada.id,
      scheduledPayDate: addDays(now, -50),
      scheduledMethod: PaymentMethod.ACH,
      paidAt: addDays(now, -50),
      paymentConfirmation: 'ACH-20241001-001892',
      lineItems: [
        { description: 'Annual reserved instance — production cluster', amountCents: 4200000 },
        { description: 'Data egress charges', amountCents: 400000 },
        { description: 'Support plan', amountCents: 250000 },
      ],
    },
    gus.id,
  );

  await createBill(
    {
      vendor: wework,
      invoiceNumber: 'WW-SEP-2024',
      amountCents: 320000, // $3,200
      issueDate: addDays(now, -60),
      dueDate: addDays(now, -30),
      status: BillStatus.PAID,
      submittedAt: addDays(now, -58),
      approvedAt: addDays(now, -57),
      approvedById: ada.id,
      scheduledPayDate: addDays(now, -35),
      scheduledMethod: PaymentMethod.ACH,
      paidAt: addDays(now, -35),
      paymentConfirmation: 'ACH-20240915-004421',
      lineItems: [{ description: 'September office space', amountCents: 320000 }],
    },
    gus.id,
  );

  await createBill(
    {
      vendor: marcus,
      invoiceNumber: 'MLD-2024-021',
      amountCents: 78000, // $780
      issueDate: addDays(now, -50),
      dueDate: addDays(now, -20),
      status: BillStatus.PAID,
      submittedAt: addDays(now, -49),
      approvedAt: addDays(now, -48),
      approvedById: ada.id,
      scheduledPayDate: addDays(now, -25),
      scheduledMethod: PaymentMethod.CHECK,
      paidAt: addDays(now, -25),
      paymentConfirmation: 'CHK-20241003-007712',
      lineItems: [{ description: 'Brand identity — initial concepts', amountCents: 78000 }],
    },
    gus.id,
  );

  // 1 × REJECTED
  await createBill(
    {
      vendor: latham,
      invoiceNumber: 'LW-2024-INV-771',
      amountCents: 2500000, // $25,000
      issueDate: addDays(now, -45),
      dueDate: addDays(now, -20),
      status: BillStatus.REJECTED,
      submittedAt: addDays(now, -43),
      approvedById: ada.id,
      rejectedAt: addDays(now, -40),
      rejectedReason: 'Duplicate invoice — already paid under LW-2024-INV-770',
      lineItems: [
        { description: 'Series A legal counsel — September (DUPLICATE)', amountCents: 2500000 },
      ],
    },
    gus.id,
  );

  console.log(`Seeded: 2 users, 5 vendors, 14 bills`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
