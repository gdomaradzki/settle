import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";

const bodySchema = z.object({ userId: z.string() });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `settle-user-id=${user.id}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`,
      },
    },
  );
}
