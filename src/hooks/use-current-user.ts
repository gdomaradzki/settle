import { trpc } from "@/lib/trpc-client";

export function useCurrentUser() {
  const { data } = trpc.user.current.useQuery();
  return data;
}
