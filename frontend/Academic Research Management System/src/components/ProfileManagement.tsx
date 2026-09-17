import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { print } from "graphql";
import { API_ORIGIN } from "../utils/uploadAvatar";
import {
  CREATE_PROFESSOR_PROFILE,
  CREATE_STUDENT_PROFILE,
  UPDATE_PROFESSOR_PROFILE,
  UPDATE_STUDENT_PROFILE,
} from "../mutations/mutations";

export interface AdminProfile {
  userId: string;
  userName: string;
  role: string;
  degreeProgramName: string | null;
  degreeLevel: string | null;
  supervisorName: string | null;
  supervisorId: string | null;
  academicRank: string | null;
  maxStudents: number | null;
  status: string | null;
  rollNumber: string | null;
}

interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  degreeProgramId: string | null;
}

interface DegreeProgramOption {
  id: string;
  name: string;
  level: string;
}

interface ProfileManagementProps {
  profileType: "student" | "professor";
  // The users of the selected group (e.g. Master's students); each row is one of them.
  users: DirectoryUser[];
  profiles: AdminProfile[];
  degreePrograms: DegreeProgramOption[];
  professors: { id: string; name: string }[];
  // Degree level of the selected student group, used to narrow the program list.
  degreeLevel?: string | null;
  onSaved: () => Promise<void>;
}

const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const emptyForm = { userId: "", degreeProgramId: "", supervisorId: "", status: "active", rollNumber: "", academicRank: "", maxStudents: "" };

async function request(document: typeof CREATE_STUDENT_PROFILE, variables: Record<string, unknown>) {
  const response = await fetch(`${API_ORIGIN}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("accessToken") ?? ""}` },
    body: JSON.stringify({ query: print(document), variables }),
  });
  const result = (await response.json()) as { errors?: { message: string }[] };
  if (!response.ok || result.errors?.length) throw new Error(result.errors?.[0]?.message ?? "Request failed.");
}

// Student or professor profiles for one group of users, with a create/edit form.
function ProfileManagement({ profileType, users, profiles, degreePrograms, professors, degreeLevel, onSaved }: ProfileManagementProps) {
  const [form, setForm] = useState(emptyForm);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const profileFor = (userId: string) => profiles.find((profile) => profile.userId === userId) ?? null;
  const usersWithoutProfile = users.filter((user) => !profileFor(user.id));
  const programs = degreeLevel ? degreePrograms.filter((program) => program.level === degreeLevel) : degreePrograms;
  const noun = profileType === "student" ? "student" : "professor";

  const openForm = (user: DirectoryUser | null) => {
    const profile = user ? profileFor(user.id) : null;
    setEditingUserId(profile ? user!.id : null);
    setForm({
      userId: user?.id ?? "",
      degreeProgramId:
        degreePrograms.find((program) => program.name === profile?.degreeProgramName)?.id ?? user?.degreeProgramId ?? (programs.length === 1 ? programs[0].id : ""),
      supervisorId: profile?.supervisorId ?? "",
      status: profile?.status ?? "active",
      rollNumber: profile?.rollNumber ?? "",
      academicRank: profile?.academicRank ?? "",
      maxStudents: profile?.maxStudents?.toString() ?? "",
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      if (profileType === "student") {
        await request(editingUserId ? UPDATE_STUDENT_PROFILE : CREATE_STUDENT_PROFILE, {
          adminInput: {
            userId: form.userId,
            degreeProgramId: form.degreeProgramId,
            supervisorId: form.supervisorId || null,
            status: form.status,
            rollNumber: form.rollNumber.trim() || null,
          },
        });
      } else {
        await request(editingUserId ? UPDATE_PROFESSOR_PROFILE : CREATE_PROFESSOR_PROFILE, {
          adminInput: { userId: form.userId, academicRank: form.academicRank.trim(), maxStudents: Number(form.maxStudents) },
        });
      }
      setIsFormOpen(false);
      await onSaved();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Unable to save the profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {usersWithoutProfile.length === 0
            ? `Every ${noun} here has a profile.`
            : `${usersWithoutProfile.length} ${noun}${usersWithoutProfile.length === 1 ? "" : "s"} without a profile.`}
        </p>
        <button
          type="button"
          disabled={usersWithoutProfile.length === 0}
          onClick={() => openForm(null)}
          className="inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" />
          Create {noun} profile
        </button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Name</th>
              {profileType === "student" ? (
                <>
                  <th className="px-4 py-3">Roll number</th>
                  <th className="px-4 py-3">Degree program</th>
                  <th className="px-4 py-3">Supervisor</th>
                  <th className="px-4 py-3">Status</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3">Academic rank</th>
                  <th className="px-4 py-3">Maximum students</th>
                </>
              )}
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No {noun}s in this group.</td>
              </tr>
            ) : (
              users.map((user) => {
                const profile = profileFor(user.id);
                return (
                  <tr key={user.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </td>
                    {!profile ? (
                      <td colSpan={profileType === "student" ? 4 : 2} className="px-4 py-3 text-sm italic text-slate-400">No profile yet</td>
                    ) : profileType === "student" ? (
                      <>
                        <td className="px-4 py-3 text-slate-600">{profile.rollNumber ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{profile.degreeProgramName ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{profile.supervisorName ?? "Not assigned"}</td>
                        <td className="px-4 py-3 capitalize text-slate-600">{profile.status ?? "active"}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-slate-600">{profile.academicRank ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{profile.maxStudents ?? "—"}</td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right">
                      {profile ? (
                        <button
                          type="button"
                          title={`Edit ${user.name}'s profile`}
                          aria-label={`Edit ${user.name}'s profile`}
                          onClick={() => openForm(user)}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                      ) : (
                        <button type="button" onClick={() => openForm(user)} className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50">
                          Create profile
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div role="dialog" aria-modal="true" className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{editingUserId ? `Edit ${noun} profile` : `Create ${noun} profile`}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {profileType === "student" ? "Roll number, degree program and supervisor." : "Academic rank and how many students they can supervise."}
                </p>
              </div>
              <button type="button" aria-label="Close profile form" onClick={() => setIsFormOpen(false)} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={save} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                {profileType === "student" ? "Student" : "Professor"}
                <select
                  required
                  disabled={Boolean(editingUserId)}
                  value={form.userId}
                  onChange={(event) => {
                    const user = users.find((item) => item.id === event.target.value);
                    setForm({ ...form, userId: event.target.value, degreeProgramId: user?.degreeProgramId ?? form.degreeProgramId });
                  }}
                  className={`${inputClass} disabled:bg-slate-100`}
                >
                  <option value="">Select {noun}</option>
                  {(editingUserId ? users : usersWithoutProfile).map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </label>
              {profileType === "student" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Roll number <span className="font-normal text-slate-500">(optional)</span>
                      <input value={form.rollNumber} onChange={(event) => setForm({ ...form, rollNumber: event.target.value })} className={inputClass} />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Degree program
                      <select required value={form.degreeProgramId} onChange={(event) => setForm({ ...form, degreeProgramId: event.target.value })} className={inputClass}>
                        <option value="">Select program</option>
                        {programs.map((program) => (
                          <option key={program.id} value={program.id}>{program.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block text-sm font-medium text-slate-700">
                    Supervisor <span className="font-normal text-slate-500">(optional)</span>
                    <select value={form.supervisorId} onChange={(event) => setForm({ ...form, supervisorId: event.target.value })} className={inputClass}>
                      <option value="">Not assigned</option>
                      {professors.map((professor) => (
                        <option key={professor.id} value={professor.id}>{professor.name}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Academic rank
                    <input required value={form.academicRank} onChange={(event) => setForm({ ...form, academicRank: event.target.value })} placeholder="e.g. Associate Professor" className={inputClass} />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Maximum students
                    <input required type="number" min="1" value={form.maxStudents} onChange={(event) => setForm({ ...form, maxStudents: event.target.value })} className={inputClass} />
                  </label>
                </div>
              )}
              {formError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={isSaving} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                  {isSaving ? "Saving..." : editingUserId ? "Save changes" : "Create profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfileManagement;
