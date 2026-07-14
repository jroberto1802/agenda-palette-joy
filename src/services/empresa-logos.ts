import { supabase } from "@/integrations/supabase/client";

const BUCKET = "empresa-logos";
const PUBLIC_SEGMENT = `/storage/v1/object/public/${BUCKET}/`;

function normalizeFileName(fileName: string) {
  return fileName.replace(/[^\w.-]+/g, "_");
}

function extractStoragePath(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  const index = logoUrl.indexOf(PUBLIC_SEGMENT);
  if (index === -1) return null;
  return decodeURIComponent(logoUrl.slice(index + PUBLIC_SEGMENT.length));
}

export async function uploadEmpresaLogo(
  file: File,
  currentLogoUrl?: string | null,
): Promise<string> {
  const storagePath = `default/${crypto.randomUUID()}_${normalizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const previousPath = extractStoragePath(currentLogoUrl);
  if (previousPath && previousPath !== storagePath) {
    await supabase.storage.from(BUCKET).remove([previousPath]).catch(() => undefined);
  }

  return data.publicUrl;
}

export async function removeEmpresaLogo(logoUrl: string | null | undefined): Promise<void> {
  const storagePath = extractStoragePath(logoUrl);
  if (!storagePath) return;
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw error;
}
