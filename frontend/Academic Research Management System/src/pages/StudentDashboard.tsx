import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { gql } from "@apollo/client";
import { print } from "graphql";
import { useNavigate } from "react-router-dom";

interface Proposal {
  id: string;
  title: string;
  status: string;
  supervisorName: string | null;
  groupMembers: { id: string; name: string }[];
}
interface Student { id: string; name: string; }

interface GraphQLResult<T> {
  data?: T;
  errors?: { message: string }[];
}

const ENDPOINT = "http://127.0.0.1:8000/graphql";
const MY_PROPOSALS = gql`query MyProposals { myProposals { id title status supervisorName groupMembers { id name } } }`;
const AVAILABLE_MEMBERS = gql`query AvailableGroupMembers { availableGroupMembers { id name } }`;
const CREATE_PROPOSAL = gql`mutation CreateProposal($studentInput: ProposalsInput!) { createProposalByUser(studentInput: $studentInput) { id title status supervisorName groupMembers { id name } } }`;
const UPDATE_PROPOSAL = gql`mutation UpdateProposal($studentInput: ProposalUpdateInput!) { updateProposalByUser(studentInput: $studentInput) { id title status supervisorName groupMembers { id name } } }`;
const DELETE_PROPOSAL = gql`mutation DeleteProposal($studentInput: ProposalDeleteInput!) { deleteProposalByUser(studentInput: $studentInput) { id } }`;
const ADD_MEMBER = gql`mutation AddMember($studentInput: ProposalCandidatesMutation!) { createProposalCandidate(studentInput: $studentInput) { proposalId studentId } }`;
const REMOVE_MEMBER = gql`mutation RemoveMember($studentInput: ProposalMemberDeleteInput!) { deleteProposalCandidate(studentInput: $studentInput) { proposalId studentId } }`;

async function request<T>(query: ReturnType<typeof gql>, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("accessToken") ?? ""}` },
    body: JSON.stringify({ query: print(query), variables }),
  });
  const result = (await response.json()) as GraphQLResult<T>;
  if (!response.ok || result.errors?.length) throw new Error(result.errors?.[0]?.message ?? "Request failed.");
  if (!result.data) throw new Error("The server returned no data.");
  return result.data;
}

function StudentDashboard() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [availableMembers, setAvailableMembers] = useState<Student[]>([]);
  const [groupProposal, setGroupProposal] = useState<Proposal | null>(null);
  const [selectedMember, setSelectedMember] = useState("");
  const [newProposalMembers, setNewProposalMembers] = useState<string[]>([]);
  const [editing, setEditing] = useState<Proposal | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("draft");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      const [result, members] = await Promise.all([
        request<{ myProposals: Proposal[] }>(MY_PROPOSALS),
        request<{ availableGroupMembers: Student[] }>(AVAILABLE_MEMBERS),
      ]);
      setProposals(result.myProposals);
      setAvailableMembers(members.availableGroupMembers);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load proposals.");
    }
  };

  useEffect(() => {
    Promise.all([
      request<{ myProposals: Proposal[] }>(MY_PROPOSALS),
      request<{ availableGroupMembers: Student[] }>(AVAILABLE_MEMBERS),
    ])
      .then(([result, members]) => {
        setProposals(result.myProposals);
        setAvailableMembers(members.availableGroupMembers);
      })
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : "Unable to load proposals.");
      });
  }, []);

  const closeForm = () => {
    setOpen(false);
    setEditing(null);
    setTitle("");
    setStatus("draft");
    setNewProposalMembers([]);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      if (editing) {
        await request(UPDATE_PROPOSAL, { studentInput: { id: editing.id, title, status } });
      } else {
        const created = await request<{ createProposalByUser: { id: string } }>(CREATE_PROPOSAL, {
          studentInput: { title, status: "draft" },
        });
        for (const studentId of newProposalMembers) {
          await request(ADD_MEMBER, {
            studentInput: { proposalId: created.createProposalByUser.id, studentId },
          });
        }
        if (status !== "draft") {
          await request(UPDATE_PROPOSAL, {
            studentInput: { id: created.createProposalByUser.id, title, status },
          });
        }
      }
      closeForm();
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save proposal.");
    }
  };

  const remove = async (proposal: Proposal) => {
    if (!window.confirm(`Delete proposal "${proposal.title}"?`)) return;
    try {
      await request(DELETE_PROPOSAL, { studentInput: { id: proposal.id } });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete proposal.");
    }
  };

  const addMember = async () => {
    if (!groupProposal || !selectedMember) return;
    if (groupProposal.groupMembers.length >= 2) {
      setError("A proposal can have only two additional group members.");
      return;
    }
    if (groupProposal.groupMembers.some((member) => member.id === selectedMember)) {
      setError("That student is already in this group.");
      return;
    }
    try {
      await request(ADD_MEMBER, { studentInput: { proposalId: groupProposal.id, studentId: selectedMember } });
      setSelectedMember("");
      setGroupProposal(null);
      await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to add group member."); }
  };

  const removeMember = async (proposal: Proposal, studentId: string) => {
    try {
      await request(REMOVE_MEMBER, { studentInput: { proposalId: proposal.id, studentId } });
      await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to remove group member."); }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 font-sans sm:p-8">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div><p className="text-xs uppercase tracking-[0.2em] text-blue-600">Student workspace</p><h1 className="mt-1 font-serif text-2xl text-slate-900">My proposals</h1></div>
          <button type="button" onClick={() => { localStorage.clear(); navigate("/login"); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Log out</button>
        </header>
        <section className="p-6">
          <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-medium text-slate-800">Research proposals</h2><p className="text-sm text-slate-500">Create, update, and track your submitted proposals.</p></div><button type="button" onClick={() => { setEditing(null); setTitle(""); setStatus("draft"); setNewProposalMembers([]); setOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus size={16} /> New proposal</button></div>
          {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[800px] border-collapse text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Title</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Group members</th><th className="px-4 py-3">Supervisor</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{proposals.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No proposals yet.</td></tr> : proposals.map((proposal) => <tr key={proposal.id} className="border-b border-slate-100"><td className="px-4 py-3 font-medium text-slate-800">{proposal.title}</td><td className="px-4 py-3 capitalize text-slate-600">{proposal.status}</td><td className="px-4 py-3 text-slate-600">{proposal.groupMembers.length + 1}/3 {proposal.groupMembers.length ? `· ${proposal.groupMembers.map((member) => member.name).join(", ")}` : "· Add at least one"}</td><td className="px-4 py-3 text-slate-600">{proposal.supervisorName ?? "Not assigned"}</td><td className="px-4 py-3 text-right"><button type="button" title="Add group members" onClick={() => setGroupProposal(proposal)} className="mr-1 inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Plus size={16} /></button><button type="button" title="Edit proposal" onClick={() => { setEditing(proposal); setTitle(proposal.title); setStatus(proposal.status); setOpen(true); }} className="mr-1 inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Pencil size={16} /></button><button type="button" title="Delete proposal" onClick={() => void remove(proposal)} className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>
        </section>
      </div>
      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold text-slate-900">{editing ? "Edit proposal" : "Create proposal"}</h2><p className="mt-1 text-sm text-slate-500">Keep your proposal details up to date.</p></div><button type="button" aria-label="Close proposal form" onClick={closeForm}><X size={18} /></button></div><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-medium text-slate-700">Title<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label><label className="block text-sm font-medium text-slate-700">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="draft">Draft</option><option value="submitted">Submitted</option></select></label>{!editing && <label className="block text-sm font-medium text-slate-700">Group members <span className="font-normal text-slate-500">(choose up to 2)</span><select multiple value={newProposalMembers} onChange={(event) => setNewProposalMembers(Array.from(event.target.selectedOptions, (option) => option.value).slice(0, 2))} className="mt-1 h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">{availableMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">{newProposalMembers.length}/2 additional members selected</span></label>}<div className="flex justify-end gap-3"><button type="button" onClick={closeForm} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium">Cancel</button><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white">{editing ? "Save changes" : "Create proposal"}</button></div></form></div></div>}
      {groupProposal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold text-slate-900">Proposal group</h2><p className="mt-1 text-sm text-slate-500">Groups must contain 2–3 students from your department.</p></div><button type="button" aria-label="Close group form" onClick={() => setGroupProposal(null)}><X size={18} /></button></div><div className="mt-5 space-y-3">{groupProposal.groupMembers.map((member) => <div key={member.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{member.name}</span><button type="button" onClick={() => void removeMember(groupProposal, member.id)} className="text-red-600">Remove</button></div>)}<div className="flex gap-2"><select value={selectedMember} onChange={(event) => setSelectedMember(event.target.value)} className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Select a department student</option>{availableMembers.filter((member) => !groupProposal.groupMembers.some((selected) => selected.id === member.id)).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select><button type="button" disabled={!selectedMember || groupProposal.groupMembers.length >= 2} onClick={() => void addMember()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Add</button></div><button type="button" onClick={() => setGroupProposal(null)} className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium">Done</button></div></div></div>}
    </main>
  );
}

export default StudentDashboard;
