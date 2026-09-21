import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";

// The dashboard section lives in the URL (/dashboard/<section>), so a refresh, the
// back button and a pasted link all land on the same screen. An unknown or missing
// section falls back to the role's default one.
export function useSection<T extends string>(
  sections: readonly T[],
  fallback: T,
): [T, (section: T) => void] {
  const { section } = useParams();
  const navigate = useNavigate();
  const current = sections.includes(section as T) ? (section as T) : fallback;
  const go = useCallback(
    (next: T) => navigate(`/dashboard/${next}`),
    [navigate],
  );
  return [current, go];
}
