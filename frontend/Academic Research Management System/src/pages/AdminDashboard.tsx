import NavigationBar from "../components/NavigationBar";
import Button from "../components/Button";
import { Eye, EyeOff, Menu, Pencil, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CREATE_USER, UPDATE_USER } from "../mutations/mutations";
import { CURRENT_USER_QUERY, DEGREE_PROGRAMS_QUERY, DEPARTMENTSQUERY, PROFILES_QUERY, USERSQUERY } from "../queries/queries";
import ProfileManagement, { type AdminProfile } from "../components/ProfileManagement";
import { print } from "graphql";
import AdminManagement from "./AdminManagement";
import { resolveAvatarUrl, uploadAvatarImage } from "../utils/uploadAvatar";

interface User {
  id: string;
  departmentId: string | null;
  name: string;
  email: string;
  password: string;
  role: string;
  createdAt: string;
  degreeProgramId: string | null;
  degreeLevel: string | null;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface DegreeProgram {
  id: string;
  name: string;
  level: string;
  departmentId: string;
}

interface Profile {
  id: string;
  departmentId: string | null;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  avatarUrl: string | null;
}

interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  role: string;
  departmentId: string;
  degreeLevel: string;
  degreeProgramId: string;
}

interface EditUserForm {
  name: string;
  email: string;
  password: string;
  degreeLevel: string;
  degreeProgramId: string;
}

interface DegreeChoice {
  degreeLevel: string;
  degreeProgramId: string;
}

const DEGREE_LEVELS = [
  { value: "bachelors", label: "Bachelor's" },
  { value: "masters", label: "Master's" },
  { value: "phd", label: "PhD" },
];
const degreeLevelLabel = (level: string) => DEGREE_LEVELS.find((item) => item.value === level.toLowerCase())?.label ?? level;

interface GraphQLResult<T> {
  data?: T;
  errors?: { message: string }[];
}

type AdminRole = "admin" | "super_admin";
type RoleGroup = "professors" | "students" | "others";
type StudentLevel = "bachelors" | "masters" | "phd" | "unset";

function getAdminRole(): AdminRole {
  return localStorage.getItem("userRole") === "super_admin"
    ? "super_admin"
    : "admin";
}

const GRAPHQL_ENDPOINT = "http://127.0.0.1:8000/graphql";

async function requestGraphQL<T>(
  query: typeof USERSQUERY,
  variables?: Record<string, unknown>,
): Promise<T> {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
    },
    body: JSON.stringify({ query: print(query), variables }),
  });
  const result = (await response.json()) as GraphQLResult<T>;

  if (!response.ok || result.errors?.length) {
    throw new Error(result.errors?.[0]?.message ?? "GraphQL request failed.");
  }

  if (!result.data) {
    throw new Error("GraphQL response did not contain data.");
  }

  return result.data;
}


// Load and present the administrator's user-management workspace.
function AdminDashboard() {
  const navigate = useNavigate();
  const role = getAdminRole();
  const canCreateUsers = role === "admin" || role === "super_admin";
  const canEditUsers = role === "admin";
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [degreePrograms, setDegreePrograms] = useState<DegreeProgram[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  // Department admins browse people by role, and students by degree level, as accounts or profiles.
  const [directoryView, setDirectoryView] = useState<"accounts" | "profiles">("accounts");
  const [roleGroup, setRoleGroup] = useState<RoleGroup>("students");
  const [studentLevel, setStudentLevel] = useState<StudentLevel>("bachelors");
  const [notice, setNotice] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"users" | "management" | "profile">(
    role === "super_admin" ? "management" : "users",
  );
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditPasswordVisible, setIsEditPasswordVisible] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [updateUserError, setUpdateUserError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm>({
    name: "",
    email: "",
    password: "",
    degreeLevel: "",
    degreeProgramId: "",
  });
  const [form, setForm] = useState<CreateUserForm>({
    name: "",
    email: "",
    password: "",
    role: "student",
    departmentId: "",
    degreeLevel: "bachelors",
    degreeProgramId: "",
  });

  const openDepartmentAdminForm = () => {
    setForm({ name: "", email: "", password: "", role: "admin", departmentId: "", degreeLevel: "bachelors", degreeProgramId: "" });
    setCreateUserError(null);
    setIsCreateUserOpen(true);
  };

  useEffect(() => {
    const loadUsers = async () => {
      const token = localStorage.getItem("accessToken");

      if (!token) {
        setError("Please log in as an administrator to view users.");
        return;
      }

      try {
        const [profileResult, usersResult, departmentsResult, degreeProgramsResult] = await Promise.all([
          requestGraphQL<{ currentUser: Profile }>(CURRENT_USER_QUERY),
          requestGraphQL<{ users: User[] }>(USERSQUERY),
          requestGraphQL<{ departments: Department[] }>(DEPARTMENTSQUERY),
          requestGraphQL<{ degreePrograms: DegreeProgram[] }>(DEGREE_PROGRAMS_QUERY),
        ]);
        setProfile(profileResult.currentUser);
        setUsers(usersResult.users);
        setDepartments(departmentsResult.departments);
        setDegreePrograms(degreeProgramsResult.degreePrograms);
        if (getAdminRole() === "admin") {
          const profilesResult = await requestGraphQL<{ profiles: AdminProfile[] }>(PROFILES_QUERY);
          setProfiles(profilesResult.profiles);
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load users.",
        );
      }
    };

    void loadUsers();
  }, []);

  const visibleUsers = users.filter(
    (user) =>
      role === "super_admin" ||
      !profile ||
      Boolean(profile?.departmentId) && user.departmentId === profile.departmentId,
  );

  const departmentNames = new Map(
    departments.map((department) => [department.id, department.name]),
  );
  const departmentName = (departmentId: string | null) =>
    departmentId ? departmentNames.get(departmentId) ?? "Unknown department" : "No department";

  const departmentGroups = departments
    .map((department) => ({
      department,
      users: visibleUsers.filter((user) => user.departmentId === department.id),
    }))
    .filter((group) => group.users.length > 0);

  const usersWithoutDepartment = visibleUsers.filter(
    (user) => !user.departmentId || !departmentNames.has(user.departmentId),
  );
  const roleOf = (user: User) => user.role.toLowerCase().replace(/^.*\./, "");
  const professorUsers = visibleUsers.filter((user) => roleOf(user) === "professor");
  const studentUsers = visibleUsers.filter((user) => roleOf(user) === "student");
  const otherUsers = visibleUsers.filter((user) => !["professor", "student"].includes(roleOf(user)));
  const studentsAtLevel = (level: StudentLevel) =>
    studentUsers.filter((user) => (level === "unset" ? !user.degreeLevel : user.degreeLevel === level));
  const roleTabs: { value: RoleGroup; label: string; count: number }[] = [
    { value: "professors", label: "Professors", count: professorUsers.length },
    { value: "students", label: "Students", count: studentUsers.length },
    ...(otherUsers.length > 0 ? [{ value: "others" as RoleGroup, label: "Other", count: otherUsers.length }] : []),
  ];
  const levelTabs: { value: StudentLevel; label: string; count: number }[] = [
    { value: "bachelors" as StudentLevel, label: "Bachelor's students", count: studentsAtLevel("bachelors").length },
    { value: "masters" as StudentLevel, label: "Master's students", count: studentsAtLevel("masters").length },
    { value: "phd" as StudentLevel, label: "PhD students", count: studentsAtLevel("phd").length },
    { value: "unset" as StudentLevel, label: "Level not set", count: studentsAtLevel("unset").length },
  ].filter((tab) => tab.value !== "unset" || tab.count > 0);
  const groupUsers =
    roleGroup === "professors" ? professorUsers : roleGroup === "others" ? otherUsers : studentsAtLevel(studentLevel);
  const programName = (user: User) =>
    degreePrograms.find((program) => program.id === user.degreeProgramId)?.name ??
    profiles.find((profile) => profile.userId === user.id)?.degreeProgramName ??
    "Not set";
  const studentCount = visibleUsers.filter(
    (user) => user.role.toLowerCase().replace(/^.*\./, "") === "student",
  ).length;

  const renderUserTable = (tableUsers: User[], grouped = false) => (
    <table className={`w-full border-collapse text-left text-sm ${grouped ? "min-w-[760px]" : "min-w-[1100px]"}`}>
      <thead>
        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          {!grouped && <th className="px-4 py-3">ID</th>}
          {!grouped && <th className="px-4 py-3">Department</th>}
          <th className="px-4 py-3">Name</th>
          <th className="px-4 py-3">Email</th>
          {!grouped && <th className="px-4 py-3">Password</th>}
          {grouped && roleGroup === "students" && <th className="px-4 py-3">Degree program</th>}
          {(!grouped || roleGroup === "others") && <th className="px-4 py-3">Role</th>}
          <th className="px-4 py-3">Created At</th>
          <th className="px-4 py-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {tableUsers.length === 0 && (
          <tr>
            <td colSpan={8} className="px-4 py-8 text-center text-slate-500">No users in this group yet.</td>
          </tr>
        )}
        {tableUsers.map((user) => (
          <tr className="border-b border-slate-100" key={user.id}>
            {!grouped && <td className="px-4 py-3 font-mono text-xs text-slate-500">{user.id}</td>}
            {!grouped && (
              <td className="px-4 py-3 text-slate-600">
                {departmentName(user.departmentId)}
              </td>
            )}
            <td className="px-4 py-3 font-medium text-slate-800">{user.name}</td>
            <td className="px-4 py-3 text-slate-600">{user.email}</td>
            {!grouped && <td className="px-4 py-3 font-mono text-xs text-slate-500">********</td>}
            {grouped && roleGroup === "students" && <td className="px-4 py-3 text-slate-600">{programName(user)}</td>}
            {(!grouped || roleGroup === "others") && <td className="px-4 py-3 capitalize text-slate-600">{user.role}</td>}
            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
              {new Date(user.createdAt).toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right">
              {canEditUsers && (
                <button
                  type="button"
                  aria-label={`Edit ${user.name}`}
                  title={`Edit ${user.name}`}
                  onClick={() => openEditUser(user)}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                >
                  <Pencil size={17} aria-hidden="true" />
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const handleUploadAvatar = async (file: File) => {
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const avatarUrl = await uploadAvatarImage(file);
      setProfile((current) => (current ? { ...current, avatarUrl } : current));
    } catch (uploadError) {
      setAvatarError(uploadError instanceof Error ? uploadError.message : "Unable to upload image.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Reloads both lists: a user's degree level (and so their group) can change when an account is saved.
  const reloadDirectory = async () => {
    try {
      const [usersResult, profilesResult] = await Promise.all([
        requestGraphQL<{ users: User[] }>(USERSQUERY),
        role === "admin" ? requestGraphQL<{ profiles: AdminProfile[] }>(PROFILES_QUERY) : Promise.resolve({ profiles: [] as AdminProfile[] }),
      ]);
      setUsers(usersResult.users);
      setProfiles(profilesResult.profiles);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to reload users.");
    }
  };

  const programsForLevel = (level: string) =>
    degreePrograms.filter((program) => program.level.toLowerCase() === level).sort((first, second) => first.name.localeCompare(second.name));

  const reloadDegreePrograms = async () => {
    try {
      const result = await requestGraphQL<{ degreePrograms: DegreeProgram[] }>(DEGREE_PROGRAMS_QUERY);
      setDegreePrograms(result.degreePrograms);
    } catch {
      // The list only feeds the degree dropdowns; the next page load refreshes it.
    }
  };

  // Changing the level picks that level's only program, so the common case needs no second click.
  const chooseLevel = (level: string): DegreeChoice => {
    const programs = programsForLevel(level);
    return { degreeLevel: level, degreeProgramId: programs.length === 1 ? programs[0].id : "" };
  };

  const renderDegreeFields = (choice: DegreeChoice, onChange: (choice: DegreeChoice) => void, required: boolean) => {
    const programs = choice.degreeLevel ? programsForLevel(choice.degreeLevel) : [];
    const subject = (profile?.departmentId ? departmentName(profile.departmentId) : "your department").replace(/^department of /i, "");
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Degree level
          <select
            required={required}
            value={choice.degreeLevel}
            onChange={(event) => onChange(chooseLevel(event.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {!required && <option value="">Not set</option>}
            {DEGREE_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>
        </label>
        {choice.degreeLevel && (
          programs.length > 0 ? (
            <label className="block text-sm font-medium text-slate-700">
              Degree program
              <select
                required={required}
                value={choice.degreeProgramId}
                onChange={(event) => onChange({ ...choice, degreeProgramId: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Select program</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="text-sm font-medium text-slate-700">
              Degree program
              <p className="mt-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 font-normal text-slate-600">
                {degreeLevelLabel(choice.degreeLevel)} in {subject}
                <span className="block text-xs text-slate-500">Your department has no {degreeLevelLabel(choice.degreeLevel)} program yet, so it will be created.</span>
              </p>
            </div>
          )
        )}
      </div>
    );
  };

  const updateForm = (field: keyof CreateUserForm, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const closeCreateUser = () => {
    setIsCreateUserOpen(false);
    setIsPasswordVisible(false);
    setCreateUserError(null);
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    const currentProgram = degreePrograms.find((program) => program.id === user.degreeProgramId);
    setEditForm({ name: user.name, email: user.email, password: "", degreeLevel: currentProgram?.level.toLowerCase() ?? "", degreeProgramId: user.degreeProgramId ?? "" });
    setIsEditPasswordVisible(false);
    setUpdateUserError(null);
  };

  const closeEditUser = () => {
    setEditingUser(null);
    setIsEditPasswordVisible(false);
    setUpdateUserError(null);
  };

  const updateEditForm = (field: keyof EditUserForm, value: string) => {
    setEditForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreatingUser(true);
    setCreateUserError(null);

    try {
      const result = await requestGraphQL<{ createUser: User }>(CREATE_USER, {
        adminInput: {
          name: form.name,
          email: form.email,
          password: form.password,
          // GraphQL userRole enum values are uppercase even though the form uses lowercase values.
          role: form.role.toUpperCase(),
          // Department admins don't pick a department (the backend derives it from their own
          // account), so send null rather than "" — the UUID scalar rejects an empty string.
          departmentId: form.departmentId || null,
          degreeProgramId: form.role === "student" ? form.degreeProgramId || null : null,
          // With no program chosen, the backend uses (or creates) the department's program at this level.
          degreeLevel: form.role === "student" ? form.degreeLevel || null : null,
        },
      });
      const createdLevel = form.role === "student" ? form.degreeLevel : null;
      setUsers((currentUsers) => [{ ...result.createUser, degreeLevel: createdLevel }, ...currentUsers]);
      // Show the group the new user landed in; otherwise a Master's or PhD student is created
      // behind the Bachelor's tab and it looks as if nothing happened.
      if (role === "admin") {
        setDirectoryView("accounts");
        if (form.role === "student") {
          setRoleGroup("students");
          setStudentLevel((createdLevel as StudentLevel) || "bachelors");
        } else {
          setRoleGroup(form.role === "professor" ? "professors" : "others");
        }
      }
      setNotice(
        `${result.createUser.name} was created${createdLevel ? ` as a ${degreeLevelLabel(createdLevel)} student` : form.role === "professor" ? " as a professor" : ""}.`,
      );
      setForm({ name: "", email: "", password: "", role: "student", departmentId: "", degreeLevel: "bachelors", degreeProgramId: "" });
      await reloadDegreePrograms();
      await reloadDirectory();
      closeCreateUser();
    } catch (requestError) {
      setCreateUserError(
        requestError instanceof Error ? requestError.message : "Unable to create user.",
      );
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleUpdateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser) return;

    setIsUpdatingUser(true);
    setUpdateUserError(null);

    try {
      const result = await requestGraphQL<{ updateUser: User }>(UPDATE_USER, {
        adminInput: {
          id: editingUser.id,
          name: editForm.name,
          email: editForm.email,
          password: editForm.password,
          degreeProgramId: editingUser.role === "student" ? editForm.degreeProgramId || null : null,
          degreeLevel: editingUser.role === "student" ? editForm.degreeLevel || null : null,
        },
      });
      await reloadDegreePrograms();
      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === result.updateUser.id ? { ...user, ...result.updateUser } : user,
        ),
      );
      await reloadDirectory();
      closeEditUser();
    } catch (requestError) {
      setUpdateUserError(
        requestError instanceof Error ? requestError.message : "Unable to update user.",
      );
    } finally {
      setIsUpdatingUser(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100">
      <NavigationBar
        open={isNavigationOpen}
        onClose={() => setIsNavigationOpen(false)}
        role={role}
        onProfile={() => setActiveView("profile")}
        onLogout={() => {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("userRole");
          navigate("/login");
        }}
        onUsers={() => setActiveView("users")}
        onDepartments={() => setActiveView("management")}
        activeView={activeView}
        avatarUrl={resolveAvatarUrl(profile?.avatarUrl)}
        userName={profile?.name}
        onUploadAvatar={(file) => void handleUploadAvatar(file)}
        isUploadingAvatar={isUploadingAvatar}
        avatarError={avatarError}
      />
      <div className="m-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50">
        <div className="flex min-h-20 items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={isNavigationOpen}
              onClick={() => setIsNavigationOpen(true)}
              className="flex size-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 md:hidden"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-600">ARMS dashboard</p>
            <h1 className="mt-1 font-serif text-2xl text-slate-900">Academic Research Management System</h1>
            </div>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-xs uppercase tracking-wide text-slate-400">Workspace</p>
            <p className="text-sm font-medium text-slate-700">
              {role === "super_admin" ? "Super administrator" : "Department administrator"}
            </p>
          </div>
        </div>
        <div className="min-h-0 w-full flex-1 overflow-auto rounded-b-2xl font-sans">
          {activeView === "profile" ? (
            <section className="p-6">
              <div className="max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-600">Account profile</p>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex size-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-200 text-xl font-semibold uppercase text-slate-600">
                    {profile?.avatarUrl ? (
                      <img src={resolveAvatarUrl(profile.avatarUrl) ?? undefined} alt="Profile" className="size-full object-cover" />
                    ) : (
                      (profile?.name.trim()?.[0] ?? "?")
                    )}
                  </div>
                  <h2 className="text-2xl font-semibold text-slate-900">{profile?.name ?? "Administrator"}</h2>
                </div>
                {profile ? (
                  <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div><dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt><dd className="mt-1 text-sm text-slate-700">{profile.email}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wide text-slate-400">Role</dt><dd className="mt-1 text-sm capitalize text-slate-700">{profile.role.replace(/_/g, " ")}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wide text-slate-400">Department</dt><dd className="mt-1 text-sm text-slate-700">{profile.departmentId ? departmentName(profile.departmentId) : "All departments"}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wide text-slate-400">Member since</dt><dd className="mt-1 text-sm text-slate-700">{new Date(profile.createdAt).toLocaleDateString()}</dd></div>
                  </dl>
                ) : <p className="mt-4 text-sm text-slate-500">Profile details are unavailable.</p>}
              </div>
            </section>
          ) : activeView === "management" ? (
            <AdminManagement role={role} />
          ) : <>
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-medium text-slate-800">Users</h2>
              <p className="text-sm text-slate-500">
                {role === "admin" ? "Manage the accounts and profiles of your department's professors and students" : "Manage registered users"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {role === "admin" && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Students</p>
                  <p className="text-xl font-semibold text-slate-900">{studentCount}</p>
                </div>
              )}
              {canCreateUsers && (
                <Button
                  label={role === "super_admin" ? "Create Department Admin" : "Create User"}
                  icon={Plus}
                  color="blue"
                  onClick={() => {
                    if (role === "super_admin") {
                      openDepartmentAdminForm();
                      return;
                    }
                    setCreateUserError(null);
                    setNotice(null);
                    setForm((currentForm) => ({ ...currentForm, ...chooseLevel(currentForm.degreeLevel || "bachelors") }));
                    setIsCreateUserOpen(true);
                  }}
                />
              )}
            </div>
          </div>
          <div className="overflow-x-auto p-6">
            {error ? (
              <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </p>
            ) : role === "admin" ? (
              <div className="space-y-4">
                {notice && (
                  <p className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                    {notice}
                    <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="text-emerald-700 hover:text-emerald-900">
                      <X size={16} aria-hidden="true" />
                    </button>
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="People">
                    {roleTabs.map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={roleGroup === tab.value}
                        onClick={() => setRoleGroup(tab.value)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium ${roleGroup === tab.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                      >
                        {tab.label} <span className="ml-1 text-xs text-slate-400">{tab.count}</span>
                      </button>
                    ))}
                  </div>
                  <div className="inline-flex gap-1 rounded-xl border border-slate-200 p-1" role="tablist" aria-label="Accounts or profiles">
                    {(["accounts", "profiles"] as const).map((view) => (
                      <button
                        key={view}
                        type="button"
                        role="tab"
                        aria-selected={directoryView === view}
                        onClick={() => setDirectoryView(view)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${directoryView === view ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                      >
                        {view}
                      </button>
                    ))}
                  </div>
                </div>
                {roleGroup === "students" && (
                  <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3" role="tablist" aria-label="Degree level">
                    {levelTabs.map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={studentLevel === tab.value}
                        onClick={() => setStudentLevel(tab.value)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium ${studentLevel === tab.value ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "text-slate-600 hover:bg-slate-100"}`}
                      >
                        {tab.label} <span className="ml-1 text-xs opacity-70">{tab.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                {directoryView === "accounts" ? (
                  <div className="overflow-x-auto">{renderUserTable(groupUsers, true)}</div>
                ) : roleGroup === "others" ? (
                  <p className="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">Only professors and students have profiles.</p>
                ) : (
                  <ProfileManagement
                    key={`${roleGroup}-${studentLevel}`}
                    profileType={roleGroup === "professors" ? "professor" : "student"}
                    users={groupUsers}
                    profiles={profiles}
                    degreePrograms={degreePrograms}
                    professors={professorUsers}
                    degreeLevel={roleGroup === "students" && studentLevel !== "unset" ? studentLevel : null}
                    onSaved={reloadDirectory}
                  />
                )}
              </div>
            ) : visibleUsers.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-8 text-center text-slate-500">No users found.</p>
            ) : (
              <div className="space-y-8">
                {departmentGroups.map((group) => (
                  <section key={group.department.id}>
                    <h3 className="mb-3 text-base font-semibold text-slate-800">
                      {group.department.name}
                    </h3>
                    <div className="overflow-x-auto">{renderUserTable(group.users)}</div>
                  </section>
                ))}
                {usersWithoutDepartment.length > 0 && (
                  <section>
                    <h3 className="mb-3 text-base font-semibold text-slate-800">Other users</h3>
                    <div className="overflow-x-auto">{renderUserTable(usersWithoutDepartment)}</div>
                  </section>
                )}
              </div>
            )}
          </div>
          </>}
        </div>
      </div>
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {role === "super_admin" ? "Create department admin" : "Create user"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {role === "super_admin"
                    ? "Assign an administrator to a department."
                    : "Add a user to the research workspace."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close create user dialog"
                onClick={closeCreateUser}
                className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={handleCreateUser}>
              <label className="block text-sm font-medium text-slate-700">
                Name
                <input
                  required
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Password
                <span className="relative mt-1 block">
                  <input
                    required
                    minLength={8}
                    type={isPasswordVisible ? "text" : "password"}
                    value={form.password}
                    onChange={(event) => updateForm("password", event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-11 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                    onClick={() => setIsPasswordVisible((visible) => !visible)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800"
                  >
                    {isPasswordVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </span>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Role
                  <select
                    required
                    value={form.role}
                    onChange={(event) => updateForm("role", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    {role === "admin" && <>
                      <option value="student">Student</option>
                      <option value="professor">Professor</option>
                      <option value="external">External</option>
                    </>}
                    {role === "super_admin" && <option value="admin">Department admin</option>}
                  </select>
                </label>
                {role === "super_admin" ? (
                  <label className="block text-sm font-medium text-slate-700">
                    Department
                    <select
                      required
                      value={form.departmentId}
                      onChange={(event) => updateForm("departmentId", event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">Select department</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="text-sm font-medium text-slate-700">
                    Department
                    <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-600">
                      {profile?.departmentId ? departmentName(profile.departmentId) : "Your department"}
                    </p>
                  </div>
                )}
              </div>
              {form.role === "student" && (
                <div>
                  {renderDegreeFields(form, (choice) => setForm((currentForm) => ({ ...currentForm, ...choice })), true)}
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    The student's profile is created automatically once they submit a proposal.
                  </span>
                </div>
              )}
              {createUserError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{createUserError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeCreateUser}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser || departments.length === 0}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingUser ? "Creating..." : "Create user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Edit user</h2>
                <p className="mt-1 text-sm text-slate-500">Update {editingUser.name}'s account details.</p>
              </div>
              <button
                type="button"
                aria-label="Close edit user dialog"
                onClick={closeEditUser}
                className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={handleUpdateUser}>
              <label className="block text-sm font-medium text-slate-700">
                Name
                <input
                  required
                  value={editForm.name}
                  onChange={(event) => updateEditForm("name", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(event) => updateEditForm("email", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                New password
                <span className="relative mt-1 block">
                  <input
                    required
                    minLength={8}
                    type={isEditPasswordVisible ? "text" : "password"}
                    value={editForm.password}
                    onChange={(event) => updateEditForm("password", event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-11 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    aria-label={isEditPasswordVisible ? "Hide new password" : "Show new password"}
                    onClick={() => setIsEditPasswordVisible((visible) => !visible)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800"
                  >
                    {isEditPasswordVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </span>
              </label>
              {editingUser?.role === "student" && renderDegreeFields(editForm, (choice) => setEditForm((currentForm) => ({ ...currentForm, ...choice })), false)}
              {updateUserError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{updateUserError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditUser}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingUser}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUpdatingUser ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;