import { describe, it, expect } from "vitest";
import { createCallerFactory } from "@/server/trpc";
import { userRouter } from "@/features/users/user-router";
import { resetWithTruncate } from "@/test/setup";
import { createTestUser } from "@/test/factories";
import type { User } from "@/generated/prisma/client";

resetWithTruncate();

const factory = createCallerFactory(userRouter);

function caller(user: User) {
  return factory({ user: user as never, isAuthenticated: true });
}

describe("user.list", () => {
  it("returns all users ordered by name", async () => {
    const alice = await createTestUser({ name: "Alice" });
    await createTestUser({ name: "Bob" });

    const users = await caller(alice).list();
    expect(users.length).toBeGreaterThanOrEqual(2);

    const names = users.map((u) => u.name);
    expect(names.indexOf("Alice")).toBeLessThan(names.indexOf("Bob"));
  });

  it("returns id, name, email and role fields", async () => {
    const user = await createTestUser();
    const users = await caller(user).list();
    const row = users.find((u) => u.id === user.id);

    expect(row).toMatchObject({ id: user.id, name: user.name, email: user.email, role: user.role });
  });
});

describe("user.current", () => {
  it("returns the user from the caller context", async () => {
    const user = await createTestUser({ name: "Ada Chen", role: "APPROVER" });
    const result = await caller(user).current();

    expect(result.id).toBe(user.id);
    expect(result.name).toBe("Ada Chen");
    expect(result.role).toBe("APPROVER");
  });
});
