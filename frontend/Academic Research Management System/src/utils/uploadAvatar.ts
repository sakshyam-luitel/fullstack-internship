const ENDPOINT = import.meta.env.VITE_API_URL
// Files, avatars and the REST routes live on the same server as /graphql, so their
// origin comes from the one VITE_API_URL setting instead of a second hardcoded copy.
export const API_ORIGIN = new URL(ENDPOINT).origin;

const UPLOAD_PROFILE_IMAGE = `mutation UploadProfileImage($file: Upload!) { uploadProfileImage(file: $file) { avatarUrl } }`;

interface UploadAvatarResponse {
  data?: { uploadProfileImage: { avatarUrl: string | null } };
  errors?: { message: string }[];
}

// Multipart upload per the GraphQL multipart request spec that Strawberry's
// Upload scalar expects — plain JSON can't carry a file, so this bypasses the
// app's usual JSON `request()` helper only for this one mutation.
export async function uploadAvatarImage(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append("operations", JSON.stringify({ query: UPLOAD_PROFILE_IMAGE, variables: { file: null } }));
  formData.append("map", JSON.stringify({ "0": ["variables.file"] }));
  formData.append("0", file);

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") ?? ""}` },
    body: formData,
  });
  // A rejected request (e.g. uploads disabled on the server) can come back as plain text, not JSON.
  const text = await response.text();
  let result: UploadAvatarResponse;
  try {
    result = JSON.parse(text) as UploadAvatarResponse;
  } catch {
    throw new Error(`Unable to upload image (${response.status}${text ? `: ${text}` : ""}).`);
  }
  if (!response.ok || result.errors?.length) {
    throw new Error(result.errors?.[0]?.message ?? "Unable to upload image.");
  }
  return result.data?.uploadProfileImage.avatarUrl ?? null;
}

export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  return avatarUrl.startsWith("http") ? avatarUrl : `${API_ORIGIN}${avatarUrl}`;
}
