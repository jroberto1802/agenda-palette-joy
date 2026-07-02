import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { profileKeys } from "@/lib/query-keys";
import { getMyProfile } from "@/services/pessoas";

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: getMyProfile,
    enabled: !!user,
  });
}
