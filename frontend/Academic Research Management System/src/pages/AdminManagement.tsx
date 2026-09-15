import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { gql } from "@apollo/client";
import { print } from "graphql";

interface Department {
  id: string;
  name: string;
  code: string;
  createdAt: string;
}
interface DegreeProgram {
  id: string;
  name: string;
  level: string;
  departmentId: string;
}
interface Cluster {
  id: string;
  name: string;
  departmentId: string;
}
interface User {
  id: string;
  name: string;
  role: string;
}
interface Proposal {
  id: string;
  submittedBy: string | null;
  submittedByName: string | null;
  title: string;
  status: string;
  supervisorId: string | null;
  supervisorName: string | null;
  clusterId: string | null;
  groupMembers: { id: string; name: string }[];
}
interface Profile {
  userId: string;
  userName: string;
  role: string;
  departmentId: string;
  departmentName: string;
  degreeProgramName: string | null;
  supervisorName: string | null;
  supervisorId: string | null;
  academicRank: string | null;
  maxStudents: number | null;
  status: string | null;
}
interface GraphQLResult<T> {
  data?: T;
  errors?: { message: string }[];
}

type Tab = "departments" | "degrees" | "clusters" | "profiles" | "proposals";
type AdminRole = "admin" | "super_admin";
const ENDPOINT = "http://127.0.0.1:8000/graphql";
const DEPARTMENTS = gql`
  query Departments {
    departments {
      id
      name
      code
      createdAt
    }
  }
`;
const DEGREES = gql`
  query DegreePrograms {
    degreePrograms {
      id
      name
      level
      departmentId
    }
  }
`;
const CLUSTERS = gql`
  query Clusters {
    clusters {
      id
      name
      departmentId
    }
  }
`;
const USERS = gql`
  query Users {
    users {
      id
      name
      role
    }
  }
`;
const PROPOSALS = gql`
  query Proposals {
    proposals {
      id
      submittedBy
      submittedByName
      title
      status
      supervisorId
      supervisorName
      clusterId
      groupMembers { id name }
    }
  }
`;
const PROFILES = gql`
  query Profiles {
    profiles {
      userId
      userName
      role
      departmentId
      departmentName
      degreeProgramName
      supervisorName
      supervisorId
      academicRank
      maxStudents
      status
    }
  }
`;
const CREATE_DEPARTMENT = gql`
  mutation CreateDepartment($adminInput: DepartmentCreateInput!) {
    createDepartment(adminInput: $adminInput) {
      id
      name
      code
      createdAt
    }
  }
`;
const UPDATE_DEPARTMENT = gql`
  mutation UpdateDepartment($adminInput: DepartmentUpdateInput!) {
    updateDepartment(adminInput: $adminInput) {
      id
      name
      code
      createdAt
    }
  }
`;
const DELETE_DEPARTMENT = gql`
  mutation DeleteDepartment($adminInput: DepartmentDeleteInput!) {
    deleteDepartment(adminInput: $adminInput) {
      id
      name
      code
      createdAt
    }
  }
`;
const CREATE_DEGREE = gql`
  mutation CreateDegree($adminInput: DegreeProgramsInput!) {
    createDegreeProgram(adminInput: $adminInput) {
      id
      name
      level
      departmentId
    }
  }
`;
const UPDATE_DEGREE = gql`
  mutation UpdateDegree($adminInput: DegreeProgramUpdateInput!) {
    updateDegreeProgram(adminInput: $adminInput) {
      id
      name
      level
      departmentId
    }
  }
`;
const DELETE_DEGREE = gql`
  mutation DeleteDegree($adminInput: DegreeProgramDeleteInput!) {
    deleteDegreeProgram(adminInput: $adminInput) {
      id
      name
      level
      departmentId
    }
  }
`;
const CREATE_CLUSTER = gql`
  mutation CreateCluster($adminInput: ClusterInput!) {
    createCluster(adminInput: $adminInput) {
      id
      name
      departmentId
    }
  }
`;
const UPDATE_CLUSTER = gql`
  mutation UpdateCluster($adminInput: ClusterUpdateInput!) {
    updateCluster(adminInput: $adminInput) {
      id
      name
      departmentId
    }
  }
`;
const DELETE_CLUSTER = gql`
  mutation DeleteCluster($adminInput: ClusterDeleteInput!) {
    deleteCluster(adminInput: $adminInput) {
      id
      name
      departmentId
    }
  }
`;
const CREATE_STUDENT_PROFILE = gql`
  mutation CreateStudentProfile($adminInput: StudentProfilesInput!) {
    createStudentProfile(adminInput: $adminInput) {
      userId
      degreeProgramId
      supervisorId
      status
    }
  }
`;
const CREATE_PROFESSOR_PROFILE = gql`
  mutation CreateProfessorProfile($adminInput: ProfessorProfileInput!) {
    createProfessorProfile(adminInput: $adminInput) {
      userId
      academicRank
      maxStudents
    }
  }
`;
const UPDATE_STUDENT_PROFILE = gql`
  mutation UpdateStudentProfile($adminInput: StudentProfileUpdateInput!) {
    updateStudentProfile(adminInput: $adminInput) {
      userId
      degreeProgramId
      supervisorId
      status
    }
  }
`;
const UPDATE_PROFESSOR_PROFILE = gql`
  mutation UpdateProfessorProfile($adminInput: ProfessorProfileUpdateInput!) {
    updateProfessorProfile(adminInput: $adminInput) {
      userId
      academicRank
      maxStudents
    }
  }
`;
const ASSIGN_PROPOSAL = gql`
  mutation AssignProposal($adminInput: ProposalsReviewInput!) {
    assignProposal(adminInput: $adminInput) {
      id
      submittedBy
      submittedByName
      title
      status
      supervisorId
      supervisorName
      clusterId
    }
  }
`;
const ADD_PROPOSAL_MEMBER_AS_ADMIN = gql`
  mutation AddProposalMemberAsAdmin($studentInput: AdminProposalMemberInput!) {
    addProposalMemberAsAdmin(studentInput: $studentInput) { proposalId studentId }
  }
`;
const DELETE_PROPOSAL_MEMBER_AS_ADMIN = gql`
  mutation DeleteProposalMemberAsAdmin($studentInput: AdminProposalMemberInput!) {
    deleteProposalMemberAsAdmin(studentInput: $studentInput) { proposalId studentId }
  }
`;

async function request<T>(
  query: ReturnType<typeof gql>,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("accessToken") ?? ""}`,
    },
    body: JSON.stringify({ query: print(query), variables }),
  });
  const result = (await response.json()) as GraphQLResult<T>;
  if (!response.ok || result.errors?.length)
    throw new Error(result.errors?.[0]?.message ?? "Request failed.");
  if (!result.data) throw new Error("The server returned no data.");
  return result.data;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const buttonClass =
  "inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50";

function AdminManagement({ role }: { role: AdminRole }) {
  const [tab, setTab] = useState<Tab>(role === "super_admin" ? "departments" : "degrees");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [degrees, setDegrees] = useState<DegreeProgram[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    type: "department" | "degree" | "cluster";
    id: string;
  } | null>(null);
  const [departmentForm, setDepartmentForm] = useState({ name: "", code: "" });
  const [degreeForm, setDegreeForm] = useState({
    name: "",
    level: "undergraduate",
    departmentId: "",
  });
  const [clusterForm, setClusterForm] = useState({
    name: "",
    departmentId: "",
  });
  const [profileForm, setProfileForm] = useState({
    userId: "",
    degreeProgramId: "",
    supervisorId: "",
    status: "active",
    academicRank: "",
    maxStudents: "",
  });
  const [profileType, setProfileType] = useState<"student" | "professor">(
    "student",
  );
  const [assignmentForm, setAssignmentForm] = useState({
    proposalId: "",
    supervisorId: "",
    clusterId: "",
  });
  const [isDepartmentFormOpen, setIsDepartmentFormOpen] = useState(false);
  const [isDegreeFormOpen, setIsDegreeFormOpen] = useState(false);
  const [isClusterFormOpen, setIsClusterFormOpen] = useState(false);
  // Track the profile and proposal dialogs independently from the other forms.
  const [isProfileFormOpen, setIsProfileFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<{
    type: "student" | "professor";
    userId: string;
  } | null>(null);
  const [isProposalFormOpen, setIsProposalFormOpen] = useState(false);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [groupProposal, setGroupProposal] = useState<Proposal | null>(null);
  const [groupStudentId, setGroupStudentId] = useState("");

  const loadData = async () => {
    setError(null);
    try {
      const [departmentData, degreeData, clusterData, userData, proposalData, profileData] =
        await Promise.all([
          request<{ departments: Department[] }>(DEPARTMENTS),
          request<{ degreePrograms: DegreeProgram[] }>(DEGREES),
          request<{ clusters: Cluster[] }>(CLUSTERS),
          request<{ users: User[] }>(USERS),
          request<{ proposals: Proposal[] }>(PROPOSALS),
          request<{ profiles: Profile[] }>(PROFILES),
        ]);
      setDepartments(departmentData.departments);
      setDegrees(degreeData.degreePrograms);
      setClusters(clusterData.clusters);
      setUsers(userData.users);
      setProposals(proposalData.proposals);
      setProfiles(profileData.profiles);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load management data.",
      );
    }
  };

  useEffect(() => {
    const initializeManagementData = async () => {
      await loadData();
    };

    void initializeManagementData();
  }, []);
  const departmentName = (id: string) =>
    departments.find((item) => item.id === id)?.name ?? "Unknown department";
  // Keep cluster rows grouped by department and predictable within each group.
  const sortedClusters = [...clusters].sort((firstCluster, secondCluster) => {
    const departmentOrder = departmentName(firstCluster.departmentId).localeCompare(
      departmentName(secondCluster.departmentId),
      undefined,
      { sensitivity: "base" },
    );
    return departmentOrder || firstCluster.name.localeCompare(secondCluster.name);
  });
  const professors = users.filter(
    (user) => user.role.toLowerCase().replace(/^.*\./, "") === "professor",
  );
  const students = users.filter(
    (user) => user.role.toLowerCase().replace(/^.*\./, "") === "student",
  );
  const editable = (type: "department" | "degree" | "cluster", id: string) =>
    setEditing({ type, id });

  const saveDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editing?.type === "department")
        await request(UPDATE_DEPARTMENT, {
          adminInput: { id: editing.id, ...departmentForm },
        });
      else await request(CREATE_DEPARTMENT, { adminInput: departmentForm });
      setDepartmentForm({ name: "", code: "" });
      setEditing(null);
      setIsDepartmentFormOpen(false);
      setMessage("Department saved.");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save department.");
    }
  };
  const closeDepartmentForm = () => {
    setIsDepartmentFormOpen(false);
    setEditing(null);
    setDepartmentForm({ name: "", code: "" });
  };
  const saveDegree = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editing?.type === "degree")
        await request(UPDATE_DEGREE, {
          adminInput: { id: editing.id, ...degreeForm },
        });
      else await request(CREATE_DEGREE, { adminInput: degreeForm });
      setDegreeForm({ name: "", level: "undergraduate", departmentId: "" });
      setEditing(null);
      setIsDegreeFormOpen(false);
      setMessage("Degree program saved.");
      await loadData();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save degree program.",
      );
    }
  };
  const saveCluster = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editing?.type === "cluster")
        await request(UPDATE_CLUSTER, {
          adminInput: { id: editing.id, ...clusterForm },
        });
      else await request(CREATE_CLUSTER, { adminInput: clusterForm });
      setClusterForm({ name: "", departmentId: "" });
      setEditing(null);
      setIsClusterFormOpen(false);
      setMessage("Cluster saved.");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save cluster.");
    }
  };
  const deleteItem = async (
    mutation: ReturnType<typeof gql>,
    id: string,
    label: string,
  ) => {
    try {
      await request(mutation, { adminInput: { id } });
      setMessage(`${label} deleted.`);
      await loadData();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : `Unable to delete ${label.toLowerCase()}.`,
      );
    }
  };
  const createProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (profileType === "student")
        await request(editingProfile ? UPDATE_STUDENT_PROFILE : CREATE_STUDENT_PROFILE, {
          adminInput: {
            userId: profileForm.userId,
            degreeProgramId: profileForm.degreeProgramId,
            supervisorId: profileForm.supervisorId || null,
            status: profileForm.status,
          },
        });
      else
        await request(editingProfile ? UPDATE_PROFESSOR_PROFILE : CREATE_PROFESSOR_PROFILE, {
          adminInput: {
            userId: profileForm.userId,
            academicRank: profileForm.academicRank,
            maxStudents: Number(profileForm.maxStudents),
          },
        });
      setMessage("Profile created.");
      setProfileForm({
        userId: "",
        degreeProgramId: "",
        supervisorId: "",
        status: "active",
        academicRank: "",
        maxStudents: "",
      });
      setIsProfileFormOpen(false);
      setEditingProfile(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create profile.");
    }
  };
  const assignProposal = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await request(ASSIGN_PROPOSAL, {
        adminInput: {
          proposalId: assignmentForm.proposalId,
          supervisorId: assignmentForm.supervisorId,
          clusterId: assignmentForm.clusterId || null,
          status: "assigned",
        },
      });
      setMessage("Proposal assigned.");
      setAssignmentForm({ proposalId: "", supervisorId: "", clusterId: "" });
      setEditingProposalId(null);
      setIsProposalFormOpen(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to assign proposal.");
    }
  };

  const adjustProposalMember = async (proposal: Proposal, studentId: string, add: boolean) => {
    try {
      await request(add ? ADD_PROPOSAL_MEMBER_AS_ADMIN : DELETE_PROPOSAL_MEMBER_AS_ADMIN, {
        studentInput: { proposalId: proposal.id, studentId },
      });
      setGroupStudentId("");
      await loadData();
      setGroupProposal((current) => current && current.id === proposal.id
        ? { ...current, groupMembers: add
          ? [...current.groupMembers, users.find((user) => user.id === studentId) ?? { id: studentId, name: "Student" }]
          : current.groupMembers.filter((member) => member.id !== studentId) }
        : current);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update proposal group.");
    }
  };

  const tabs: [Tab, string][] = role === "super_admin"
    ? [["departments", "Departments"]]
    : [
        ["degrees", "Degree programs"],
        ["clusters", "Clusters"],
        ["profiles", "Profiles"],
        ["proposals", "Proposal assignment"],
      ];
  return (
    <div className="min-h-full p-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setError(null);
              setMessage(null);
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {message && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {tab === "departments" && (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-0 py-4">
            <div>
              <h2 className="text-lg font-medium text-slate-800">
                Departments
              </h2>
              <p className="text-sm text-slate-500">
                Manage academic departments
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setDepartmentForm({ name: "", code: "" });
                setIsDepartmentFormOpen(true);
              }}
              className={buttonClass}
            >
              <Plus size={16} aria-hidden="true" />
              Create department
            </button>
          </div>
          <div className="overflow-x-auto pt-6">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Created At</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No departments found.
                    </td>
                  </tr>
                ) : (
                  departments.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {item.id}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.code}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          title={`Edit ${item.name}`}
                          aria-label={`Edit ${item.name}`}
                          onClick={() => {
                            editable("department", item.id);
                            setDepartmentForm({
                              name: item.name,
                              code: item.code,
                            });
                            setIsDepartmentFormOpen(true);
                          }}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title={`Delete ${item.name}`}
                          aria-label={`Delete ${item.name}`}
                          onClick={() => {
                            if (window.confirm(`Delete department "${item.name}"?`)) {
                              void deleteItem(DELETE_DEPARTMENT, item.id, "Department");
                            }
                          }}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "degrees" && (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-0 py-4">
            <div>
              <h2 className="text-lg font-medium text-slate-800">
                Degree programs
              </h2>
              <p className="text-sm text-slate-500">Manage degree programs</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setDegreeForm({
                  name: "",
                  level: "undergraduate",
                  departmentId: "",
                });
                setIsDegreeFormOpen(true);
              }}
              className={buttonClass}
            >
              <Plus size={16} aria-hidden="true" />
              Create degree program
            </button>
          </div>
          <div className="overflow-x-auto pt-6">
            <table className="w-full min-w-[800px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {degrees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No degree programs found.
                    </td>
                  </tr>
                ) : (
                  degrees.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {item.id}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">
                        {item.level}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {departmentName(item.departmentId)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          title={`Edit ${item.name}`}
                          aria-label={`Edit ${item.name}`}
                          onClick={() => {
                            editable("degree", item.id);
                            setDegreeForm({
                              name: item.name,
                              level: item.level,
                              departmentId: item.departmentId,
                            });
                            setIsDegreeFormOpen(true);
                          }}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title={`Delete ${item.name}`}
                          aria-label={`Delete ${item.name}`}
                          onClick={() =>
                            void deleteItem(
                              DELETE_DEGREE,
                              item.id,
                              "Degree program",
                            )
                          }
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {isDegreeFormOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {editing?.type === "degree"
                        ? "Edit degree program"
                        : "Create degree program"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {editing?.type === "degree"
                        ? "Update the degree program details."
                        : "Add a degree program to a department."}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close degree program form"
                    onClick={() => {
                      setEditing(null);
                      setDegreeForm({ name: "", level: "undergraduate", departmentId: "" });
                      setIsDegreeFormOpen(false);
                    }}
                    className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <form className="mt-6 space-y-4" onSubmit={saveDegree}>
                  <label className="block text-sm font-medium text-slate-700">
                    Program name
                    <input
                      required
                      value={degreeForm.name}
                      onChange={(event) => setDegreeForm({ ...degreeForm, name: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Level
                    <select
                      required
                      value={degreeForm.level}
                      onChange={(event) => setDegreeForm({ ...degreeForm, level: event.target.value })}
                      className={inputClass}
                    >
                      <option>undergraduate</option>
                      <option>postgraduate</option>
                      <option>doctoral</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Department
                    <select
                      required
                      value={degreeForm.departmentId}
                      onChange={(event) => setDegreeForm({ ...degreeForm, departmentId: event.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select department</option>
                      {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setDegreeForm({ name: "", level: "undergraduate", departmentId: "" });
                        setIsDegreeFormOpen(false);
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
                      {editing?.type === "degree" ? "Save changes" : "Create degree program"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      )}
      {tab === "clusters" && (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-0 py-4">
            <div>
              <h2 className="text-lg font-medium text-slate-800">Clusters</h2>
              <p className="text-sm text-slate-500">Manage research clusters</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setClusterForm({ name: "", departmentId: "" });
                setIsClusterFormOpen(true);
              }}
              className={buttonClass}
            >
              <Plus size={16} aria-hidden="true" />
              Create cluster
            </button>
          </div>
          <div className="overflow-x-auto pt-6">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clusters.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No clusters found.
                    </td>
                  </tr>
                ) : (
                  sortedClusters.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {item.id}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {departmentName(item.departmentId)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          title={`Edit ${item.name}`}
                          aria-label={`Edit ${item.name}`}
                          onClick={() => {
                            editable("cluster", item.id);
                            setClusterForm({
                              name: item.name,
                              departmentId: item.departmentId,
                            });
                            setIsClusterFormOpen(true);
                          }}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title={`Delete ${item.name}`}
                          aria-label={`Delete ${item.name}`}
                          onClick={() =>
                            void deleteItem(DELETE_CLUSTER, item.id, "Cluster")
                          }
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {isClusterFormOpen && (
            /* Cluster forms use a modal so creation stays focused above the table. */
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setEditing(null);
                  setClusterForm({ name: "", departmentId: "" });
                  setIsClusterFormOpen(false);
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="cluster-form-title"
                className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
              >
                {/* The dialog header identifies the current create or edit action. */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2
                      id="cluster-form-title"
                      className="text-xl font-semibold text-slate-900"
                    >
                      {editing?.type === "cluster"
                        ? "Edit cluster"
                        : "Create cluster"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Add a research cluster and assign it to a department.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setClusterForm({ name: "", departmentId: "" });
                      setIsClusterFormOpen(false);
                    }}
                    aria-label="Close cluster form"
                    title="Close cluster form"
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>

                {/* The cluster fields collect the values required by the GraphQL mutation. */}
                <form onSubmit={saveCluster} className="mt-6 grid gap-4">
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    Cluster name
                    <input
                      required
                      autoFocus
                      value={clusterForm.name}
                      onChange={(event) =>
                        setClusterForm({
                          ...clusterForm,
                          name: event.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    Department
                    <select
                      required
                      value={clusterForm.departmentId}
                      onChange={(event) =>
                        setClusterForm({
                          ...clusterForm,
                          departmentId: event.target.value,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="">Select department</option>
                      {departments.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setClusterForm({ name: "", departmentId: "" });
                        setIsClusterFormOpen(false);
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <Plus size={16} aria-hidden="true" />
                      {editing?.type === "cluster"
                        ? "Save changes"
                        : "Create cluster"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      )}
      {tab === "profiles" && (
        <section className="mt-6">
          {/* Profile management keeps the table visible while opening creation in a modal. */}
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-0 py-4">
            <div>
              <h2 className="text-lg font-medium text-slate-800">Profiles</h2>
              <p className="text-sm text-slate-500">Create student and professor profiles</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingProfile(null);
                setProfileForm({
                  userId: "",
                  degreeProgramId: "",
                  supervisorId: "",
                  status: "active",
                  academicRank: "",
                  maxStudents: "",
                });
                setIsProfileFormOpen(true);
              }}
              className={buttonClass}
            >
              <Plus size={16} aria-hidden="true" />
              Create profile
            </button>
          </div>
          {isProfileFormOpen && (
            /* Profile fields change with the selected student or professor type. */
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="profile-form-title"
                className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 id="profile-form-title" className="text-xl font-semibold text-slate-900">
                      {editingProfile ? "Edit profile" : "Create profile"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Add a profile for an existing student or professor.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close profile form"
                    title="Close profile form"
                    onClick={() => setIsProfileFormOpen(false)}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <form onSubmit={createProfile} className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    Profile type
                    <select
                      value={profileType}
                      onChange={(event) => {
                        setProfileType(event.target.value as "student" | "professor");
                        setProfileForm({ ...profileForm, userId: "" });
                      }}
                      className={inputClass}
                    >
                      <option value="student">Student profile</option>
                      <option value="professor">Professor profile</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    User
                    <select
                      required
                      value={profileForm.userId}
                      onChange={(event) =>
                        setProfileForm({ ...profileForm, userId: event.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">Select {profileType}</option>
                      {users
                        .filter(
                          (item) =>
                            item.role.toLowerCase().replace(/^.*\./, "") === profileType,
                        )
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {profileType === "student" ? (
                    <>
                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        Degree program
                        <select
                          required
                          value={profileForm.degreeProgramId}
                          onChange={(event) =>
                            setProfileForm({
                              ...profileForm,
                              degreeProgramId: event.target.value,
                            })
                          }
                          className={inputClass}
                        >
                          <option value="">Select degree program</option>
                          {degrees.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        Supervisor
                        <select
                          value={profileForm.supervisorId}
                          onChange={(event) =>
                            setProfileForm({
                              ...profileForm,
                              supervisorId: event.target.value,
                            })
                          }
                          className={inputClass}
                        >
                          <option value="">Supervisor (optional)</option>
                          {professors.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        Academic rank
                        <input
                          required
                          value={profileForm.academicRank}
                          onChange={(event) =>
                            setProfileForm({
                              ...profileForm,
                              academicRank: event.target.value,
                            })
                          }
                          className={inputClass}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        Maximum students
                        <input
                          required
                          type="number"
                          min="1"
                          value={profileForm.maxStudents}
                          onChange={(event) =>
                            setProfileForm({
                              ...profileForm,
                              maxStudents: event.target.value,
                            })
                          }
                          className={inputClass}
                        />
                      </label>
                    </>
                  )}
                  <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProfile(null);
                        setIsProfileFormOpen(false);
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      {editingProfile ? <Pencil size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                      Create profile
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Department</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Profile details</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody>{profiles.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No profiles found.</td></tr> : profiles.map((profile) => <tr key={profile.userId} className="border-b border-slate-100"><td className="px-4 py-3 font-medium text-slate-800">{profile.departmentName}</td><td className="px-4 py-3 text-slate-600">{profile.userName}</td><td className="px-4 py-3 capitalize text-slate-600">{profile.role}</td><td className="px-4 py-3 text-slate-600">{profile.role.toLowerCase() === "student" ? `${profile.degreeProgramName ?? "No degree program"}${profile.supervisorName ? ` · Supervisor: ${profile.supervisorName}` : ""}` : `${profile.academicRank ?? "No rank"}${profile.maxStudents !== null ? ` · Max students: ${profile.maxStudents}` : ""}`}</td><td className="px-4 py-3 capitalize text-slate-600">{profile.status ?? "Active"}</td><td className="px-4 py-3 text-right"><button type="button" title={`Edit ${profile.userName}'s profile`} aria-label={`Edit ${profile.userName}'s profile`} onClick={() => { const type = profile.role.toLowerCase().replace(/^.*\./, "") as "student" | "professor"; setEditingProfile({ type, userId: profile.userId }); setProfileType(type); setProfileForm({ userId: profile.userId, degreeProgramId: degrees.find((degree) => degree.name === profile.degreeProgramName)?.id ?? "", supervisorId: "", status: profile.status ?? "active", academicRank: profile.academicRank ?? "", maxStudents: profile.maxStudents?.toString() ?? "" }); setIsProfileFormOpen(true); }} className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"><Pencil size={17} aria-hidden="true" /></button></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "proposals" && (
        <section className="mt-6">
          {/* Proposal assignment stays above the table so the workflow is easy to start. */}
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-0 py-4">
            <div>
              <h2 className="text-lg font-medium text-slate-800">Proposal assignment</h2>
              <p className="text-sm text-slate-500">Assign proposals to professors and clusters</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAssignmentForm({ proposalId: "", supervisorId: "", clusterId: "" });
                setEditingProposalId(null);
                setIsProposalFormOpen(true);
              }}
              className={buttonClass}
            >
              <Plus size={16} aria-hidden="true" />
              Assign proposal
            </button>
          </div>
          {isProposalFormOpen && (
            /* Assignment fields keep the selected proposal and reviewers together in one dialog. */
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="proposal-form-title"
                className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 id="proposal-form-title" className="text-xl font-semibold text-slate-900">
                      {editingProposalId ? "Edit proposal assignment" : "Assign student proposal"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Choose a professor and optionally place the proposal in a cluster.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close proposal assignment form"
                    title="Close proposal assignment form"
                    onClick={() => setIsProposalFormOpen(false)}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <form onSubmit={assignProposal} className="mt-6 grid gap-4">
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    Student proposal
                    <select
                      required
                      value={assignmentForm.proposalId}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          proposalId: event.target.value,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="">Select student proposal</option>
                      {proposals
                        .filter(
                          (proposal) =>
                            proposal.submittedBy &&
                            students.some(
                              (student) => student.id === proposal.submittedBy,
                            ),
                        )
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title} ({item.status})
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    Professor
                    <select
                      required
                      value={assignmentForm.supervisorId}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          supervisorId: event.target.value,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="">Select professor</option>
                      {professors.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    Cluster
                    <select
                      value={assignmentForm.clusterId}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          clusterId: event.target.value,
                        })
                      }
                      className={inputClass}
                    >
                      <option value="">Select cluster (optional)</option>
                      {sortedClusters.map((item) => (
                        <option key={item.id} value={item.id}>
                          {departmentName(item.departmentId)}: {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProposalId(null);
                        setIsProposalFormOpen(false);
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <Plus size={16} aria-hidden="true" />
                      Assign proposal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Proposal</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Group</th>
                  <th className="px-4 py-3">Assigned professor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {proposals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No proposals found.
                    </td>
                  </tr>
                ) : (
                  proposals.map((proposal) => (
                    <tr key={proposal.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">{proposal.title}</td>
                      <td className="px-4 py-3 text-slate-600">{proposal.submittedByName ?? "Unknown student"}</td>
                      <td className="px-4 py-3 text-slate-600">{proposal.groupMembers.length + 1}/3</td>
                      <td className="px-4 py-3 text-slate-600">{proposal.supervisorName ?? "Unassigned"}</td>
                      <td className="px-4 py-3 capitalize text-slate-600">{proposal.status}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          title={`Edit assignment for ${proposal.title}`}
                          aria-label={`Edit assignment for ${proposal.title}`}
                          onClick={() => {
                            setEditingProposalId(proposal.id);
                            setAssignmentForm({
                              proposalId: proposal.id,
                              supervisorId: proposal.supervisorId ?? "",
                              clusterId: proposal.clusterId ?? "",
                            });
                            setIsProposalFormOpen(true);
                          }}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title={`Adjust students for ${proposal.title}`}
                          aria-label={`Adjust students for ${proposal.title}`}
                          onClick={() => { setGroupProposal(proposal); setGroupStudentId(""); }}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          <Users size={17} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {groupProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Adjust proposal students</h2>
                <p className="mt-1 text-sm text-slate-500">{groupProposal.title} · {groupProposal.groupMembers.length + 1}/3 students</p>
              </div>
              <button type="button" aria-label="Close student group" onClick={() => setGroupProposal(null)} className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="mt-5 space-y-3">
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-medium">{groupProposal.submittedByName ?? "Proposal owner"} (owner)</p>
                {groupProposal.groupMembers.map((member) => (
                  <div key={member.id} className="mt-2 flex items-center justify-between">
                    <span>{member.name}</span>
                    <button type="button" onClick={() => void adjustProposalMember(groupProposal, member.id, false)} className="text-sm text-red-600 hover:text-red-700">Remove</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <select value={groupStudentId} onChange={(event) => setGroupStudentId(event.target.value)} className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">Select department student</option>
                  {users.filter((user) => user.role.toLowerCase().replace(/^.*\./, "") === "student" && user.id !== groupProposal.submittedBy && !groupProposal.groupMembers.some((member) => member.id === user.id)).map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
                </select>
                <button type="button" disabled={!groupStudentId || groupProposal.groupMembers.length >= 2} onClick={() => void adjustProposalMember(groupProposal, groupStudentId, true)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Add</button>
              </div>
              <button type="button" onClick={() => setGroupProposal(null)} className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700">Done</button>
            </div>
          </div>
        </div>
      )}
      {isDepartmentFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {editing?.type === "department"
                    ? "Edit department"
                    : "Create department"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editing?.type === "department"
                    ? "Update the department details."
                    : "Add a department to the research workspace."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close department form"
                onClick={closeDepartmentForm}
                className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={saveDepartment} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Department name
                <input
                  required
                  value={departmentForm.name}
                  onChange={(event) =>
                    setDepartmentForm({
                      ...departmentForm,
                      name: event.target.value,
                    })
                  }
                  className={inputClass}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Department code
                <input
                  required
                  value={departmentForm.code}
                  onChange={(event) =>
                    setDepartmentForm({
                      ...departmentForm,
                      code: event.target.value,
                    })
                  }
                  className={inputClass}
                />
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDepartmentForm}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {editing?.type === "department"
                    ? "Save changes"
                    : "Create department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default AdminManagement;
