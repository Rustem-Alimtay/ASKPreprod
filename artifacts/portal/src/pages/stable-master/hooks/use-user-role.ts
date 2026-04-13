import { useQuery } from "@tanstack/react-query";

export function useUserRole() {
  const { data } = useQuery<{ role: string }>({
    queryKey: ["/api/sm2/me"],
  });
  return data?.role || "";
}
