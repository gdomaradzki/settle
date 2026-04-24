import "server-only";
import { initTRPC } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { db } from "./db";

function getCookieValue(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match?.split("=").slice(1).join("=");
}

async function getDefaultUser() {
  return db.user.findFirstOrThrow({ where: { role: "SUBMITTER" } });
}

export async function resolveUser(userId?: string) {
  if (userId) {
    return (
      (await db.user.findUnique({ where: { id: userId } })) ?? getDefaultUser()
    );
  }
  return getDefaultUser();
}

export async function createContext({ req }: FetchCreateContextFnOptions) {
  const userId = getCookieValue(req, "settle-user-id");
  const user = await resolveUser(userId);
  return { user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const { router, createCallerFactory } = t;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure;
