import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  challengeAndVerifyMfa,
  enrollTotp,
  getVerifiedTotpFactor,
  listMfaFactors,
  unenrollFactor,
  verifyTotpEnrollment,
} from "@/services/mfa";

export const mfaKeys = {
  all: ["mfa"] as const,
  factors: () => [...mfaKeys.all, "factors"] as const,
};

export function useMfaFactors() {
  return useQuery({
    queryKey: mfaKeys.factors(),
    queryFn: listMfaFactors,
  });
}

export function useVerifiedTotpFactor() {
  return useQuery({
    queryKey: [...mfaKeys.factors(), "verified"],
    queryFn: getVerifiedTotpFactor,
  });
}

export function useEnrollTotp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (friendlyName?: string) => enrollTotp(friendlyName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mfaKeys.all }),
  });
}

export function useVerifyTotpEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ factorId, code }: { factorId: string; code: string }) =>
      verifyTotpEnrollment(factorId, code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mfaKeys.all }),
  });
}

export function useUnenrollFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (factorId: string) => unenrollFactor(factorId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mfaKeys.all }),
  });
}

export function useChallengeMfa() {
  return useMutation({
    mutationFn: ({ factorId, code }: { factorId: string; code: string }) =>
      challengeAndVerifyMfa(factorId, code),
  });
}
