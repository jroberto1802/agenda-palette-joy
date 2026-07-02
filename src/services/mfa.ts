import { supabase } from "@/integrations/supabase/client";
import type { Factor } from "@supabase/supabase-js";

export type MfaFactor = Factor;

export async function listMfaFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data;
}

export async function enrollTotp(friendlyName = "Autenticador") {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });
  if (error) throw error;
  return data;
}

export async function verifyTotpEnrollment(factorId: string, code: string) {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (challengeError) throw challengeError;

  const { data, error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) throw error;
  return data;
}

export async function unenrollFactor(factorId: string) {
  const { data, error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
  return data;
}

export async function getMfaAssuranceLevel() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return data;
}

export async function challengeAndVerifyMfa(factorId: string, code: string) {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (challengeError) throw challengeError;

  const { data, error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) throw error;
  return data;
}

export async function getVerifiedTotpFactor() {
  const { data } = await listMfaFactors();
  return data.totp.find((f) => f.status === "verified") ?? null;
}

export async function needsMfaChallenge() {
  const { data: aal } = await getMfaAssuranceLevel();
  return aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";
}
