// The signed-in user's token and role, as Login.tsx stores them.
export type AppRole = "super_admin" | "admin" | "student" | "professor";

export const getAccessToken = () => localStorage.getItem("accessToken");
export const getRole = () => localStorage.getItem("userRole");

export const isSignedIn = () => Boolean(getAccessToken());

export function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("userRole");
}
