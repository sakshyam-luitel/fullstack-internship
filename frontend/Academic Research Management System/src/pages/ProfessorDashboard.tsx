import { useEffect, useState } from "react";
import { gql } from "@apollo/client";
import { print } from "graphql";
import { useNavigate } from "react-router-dom";

interface Proposal {
  id: string;
  submittedByName: string | null;
  title: string;
  status: string;
  supervisorName: string | null;
  clusterName: string | null;
}

interface GraphQLResult<T> {
  data?: T;
  errors?: { message: string }[];
}

const ENDPOINT = "http://127.0.0.1:8000/graphql";
const ASSIGNED_PROPOSALS = gql`query AssignedProposals { assignedProposals { id submittedByName title status supervisorName clusterName } }`;

async function request<T>(query: ReturnType<typeof gql>): Promise<T> {
  const response = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("accessToken") ?? ""}` }, body: JSON.stringify({ query: print(query) }) });
  const result = (await response.json()) as GraphQLResult<T>;
  if (!response.ok || result.errors?.length) throw new Error(result.errors?.[0]?.message ?? "Request failed.");
  if (!result.data) throw new Error("The server returned no data.");
  return result.data;
}

function ProfessorDashboard() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await request<{ assignedProposals: Proposal[] }>(ASSIGNED_PROPOSALS);
        setProposals(result.assignedProposals);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Unable to load assigned proposals.");
      }
    };
    void load();
  }, []);

  return <main className="min-h-screen bg-slate-100 p-4 font-sans sm:p-8"><div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"><header className="flex items-center justify-between border-b border-slate-200 px-6 py-5"><div><p className="text-xs uppercase tracking-[0.2em] text-blue-600">Professor workspace</p><h1 className="mt-1 font-serif text-2xl text-slate-900">Assigned proposals</h1></div><button type="button" onClick={() => { localStorage.clear(); navigate("/login"); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Log out</button></header><section className="p-6"><p className="text-sm text-slate-500">Proposals assigned to you by your department administrator.</p>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-6 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Proposal</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Cluster</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Supervisor</th></tr></thead><tbody>{proposals.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No proposals have been assigned to you.</td></tr> : proposals.map((proposal) => <tr key={proposal.id} className="border-b border-slate-100"><td className="px-4 py-3 font-medium text-slate-800">{proposal.title}</td><td className="px-4 py-3 text-slate-600">{proposal.submittedByName ?? "Unknown student"}</td><td className="px-4 py-3 text-slate-600">{proposal.clusterName ?? "Not assigned"}</td><td className="px-4 py-3 capitalize text-slate-600">{proposal.status}</td><td className="px-4 py-3 text-slate-600">{proposal.supervisorName ?? "You"}</td></tr>)}</tbody></table></div></section></div></main>;
}

export default ProfessorDashboard;
