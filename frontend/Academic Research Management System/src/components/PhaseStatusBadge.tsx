import { phaseStatus } from "../utils/adminManagement";
import type { ResearchPhase } from "../types/adminManagement";

export default function PhaseStatusBadge({ phase }: { phase: ResearchPhase }) {
  const status = phaseStatus(phase);
  return (
    <span className={`rounded-full px-2 py-0.5 font-medium ${status.className}`}>
      {status.label}
    </span>
  );
}
