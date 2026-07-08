import { supabase } from "@/integrations/supabase/client";

const BUCKET = "profile-avatars";
const PUBLIC_SEGMENT = `/storage/v1/object/public/${BUCKET}/`;

function normalizeFileName(fileName: string) {
  return fileName.replace(/[^\w.-]+/g, "_");
}

function extractStoragePath(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  const index = avatarUrl.indexOf(PUBLIC_SEGMENT);
  if (index === -1) return null;
  return decodeURIComponent(avatarUrl.slice(index + PUBLIC_SEGMENT.length));
}

export async function uploadProfileAvatar(
  profileId: string,
  file: File,
  currentAvatarUrl?: string | null,
): Promise<string> {
  const storagePath = `${profileId}/${crypto.randomUUID()}_${normalizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const previousPath = extractStoragePath(currentAvatarUrl);
  if (previousPath && previousPath !== storagePath) {
    await supabase.storage.from(BUCKET).remove([previousPath]).catch(() => undefined);
  }

  return data.publicUrl;
}

export async function removeProfileAvatar(avatarUrl: string | null | undefined): Promise<void> {
  const storagePath = extractStoragePath(avatarUrl);
  if (!storagePath) return;
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw error;
}
