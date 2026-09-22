import {
  Building2,
  CalendarRange,
  Eye,
  EyeOff,
  Gavel,
  LayoutDashboard,
  NotebookPen,
  Pencil,
  Plus,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import AppShell, { type NavItem } from "../components/AppShell";
import {
  EmptyState,
  ProfileCard,
  SectionHeader,
  SegmentedControl,
} from "../components/ui";
import { useSection } from "../hooks/useSection";
import { useToast } from "../hooks/useToast";
import { primaryButtonClass } from "../utils/format";
import { CREATE_USER, UPDATE_USER } from "../mutations/mutations";
import {
  CURRENT_USER_QUERY,
  DEGREE_PROGRAMS_QUERY,
  DEPARTMENTSQUERY,
  PROFILES_QUERY,
  USERSQUERY,
} from "../queries/queries";
import ProfileManagement, {
  type AdminProfile,
} from "../components/ProfileManagement";
import { print } from "graphql";
import AdminManagement, {
  type AdminBadges,
  type AdminView,
  type DegreeLevel,
} from "./AdminManagement";
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
const degreeLevelLabel = (level: string) =>
  DEGREE_LEVELS.find((item) => item.value === level.toLowerCase())?.label ??
  level;

interface GraphQLResult<T> {
  data?: T;
  errors?: { message: string }[];
}

type AdminRole = "admin" | "super_admin";

// Department admins run the research pipeline; super admins run departments and batches.
const ADMIN_SECTIONS = [
  "overview",
  "people",
  "timeline",
  "proposals",
  "defenses",
  "setup",
  "profile",
] as const;
const SUPER_ADMIN_SECTIONS = ["users", "departments", "profile"] as const;
type Section =
  | (typeof ADMIN_SECTIONS)[number]
  | (typeof SUPER_ADMIN_SECTIONS)[number];
const SECTION_TITLES: Record<Section, string> = {
  overview: "Overview",
  people: "People",
  timeline: "Research timeline",
  proposals: "Proposals",
  defenses: "Defenses",
  setup: "Programs & clusters",
  users: "Users",
  departments: "Departments",
  profile: "My profile",
};
// Sections drawn by AdminManagement, and which of them work on one degree level.
const MANAGEMENT_VIEWS: Record<string, AdminView> = {
  overview: "overview",
  timeline: "timeline",
  proposals: "proposals",
  defenses: "defenses",
  setup: "setup",
  departments: "departments",
};
const LEVEL_SECTIONS = new Set(["timeline", "proposals", "defenses"]);
const LEVEL_STORAGE_KEY = "arms.adminLevel";
function storedLevel(): DegreeLevel {
  try {
    const value = localStorage.getItem(LEVEL_STORAGE_KEY);
    if (value === "bachelors" || value === "masters" || value === "phd") return value;
  } catch {
    // Storage can be unavailable (private mode); the default level is fine.
  }
  return "bachelors";
}
type RoleGroup = "professors" | "students" | "others";
type StudentLevel = "bachelors" | "masters" | "phd" | "unset";

function getAdminRole(): AdminRole {
  return localStorage.getItem("userRole") === "super_admin"
    ? "super_admin"
    : "admin";
}

const GRAPHQL_ENDPOINT = import.meta.env.VITE_API_URL

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
  const toast = useToast();
  const role = getAdminRole();
  const [section, goTo] = useSection<Section>(
    role === "super_admin" ? SUPER_ADMIN_SECTIONS : ADMIN_SECTIONS,
    role === "super_admin" ? "users" : "overview",
  );
  const [level, setLevelState] = useState<DegreeLevel>(storedLevel);
  const setLevel = (next: DegreeLevel) => {
    setLevelState(next);
    try {
      localStorage.setItem(LEVEL_STORAGE_KEY, next);
    } catch {
      // Remembering the level is only a convenience.
    }
  };
  const [badges, setBadges] = useState<AdminBadges | null>(null);
  // Bumped after people change, so the research pages reload who can supervise and sit on panels.
  const [refreshKey, setRefreshKey] = useState(0);
  const canEditUsers = role === "admin";
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [degreePrograms, setDegreePrograms] = useState<DegreeProgram[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  // Department admins browse people by role, and students by degree level.
  const [roleGroup, setRoleGroup] = useState<RoleGroup>("students");
  const [studentLevel, setStudentLevel] = useState<StudentLevel>("bachelors");
  const [profile, setProfile] = useState<Profile | null>(null);
  // Only a failed load stays on screen; results of actions are toasts.
  const [error, setError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
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
    setForm({
      name: "",
      email: "",
      password: "",
      role: "admin",
      departmentId: "",
      degreeLevel: "bachelors",
      degreeProgramId: "",
    });
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
        const [
          profileResult,
          usersResult,
          departmentsResult,
          degreeProgramsResult,
        ] = await Promise.all([
          requestGraphQL<{ currentUser: Profile }>(CURRENT_USER_QUERY),
          requestGraphQL<{ users: User[] }>(USERSQUERY),
          requestGraphQL<{ departments: Department[] }>(DEPARTMENTSQUERY),
          requestGraphQL<{ degreePrograms: DegreeProgram[] }>(
            DEGREE_PROGRAMS_QUERY,
          ),
        ]);
        setProfile(profileResult.currentUser);
        setUsers(usersResult.users);
        setDepartments(departmentsResult.departments);
        setDegreePrograms(degreeProgramsResult.degreePrograms);
        if (getAdminRole() === "admin") {
          const profilesResult = await requestGraphQL<{
            profiles: AdminProfile[];
          }>(PROFILES_QUERY);
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
      (Boolean(profile?.departmentId) &&
        user.departmentId === profile.departmentId),
  );

  const departmentNames = new Map(
    departments.map((department) => [department.id, department.name]),
  );
  const departmentName = (departmentId: string | null) =>
    departmentId
      ? (departmentNames.get(departmentId) ?? "Unknown department")
      : "No department";

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
  const professorUsers = visibleUsers.filter(
    (user) => roleOf(user) === "professor",
  );
  const studentUsers = visibleUsers.filter(
    (user) => roleOf(user) === "student",
  );
  const otherUsers = visibleUsers.filter(
    (user) => !["professor", "student"].includes(roleOf(user)),
  );
  const studentsAtLevel = (level: StudentLevel) =>
    studentUsers.filter((user) =>
      level === "unset" ? !user.degreeLevel : user.degreeLevel === level,
    );
  const roleTabs: { value: RoleGroup; label: string; count: number }[] = [
    { value: "professors", label: "Professors", count: professorUsers.length },
    { value: "students", label: "Students", count: studentUsers.length },
    ...(otherUsers.length > 0
      ? [
          {
            value: "others" as RoleGroup,
            label: "Other",
            count: otherUsers.length,
          },
        ]
      : []),
  ];
  const levelTabs: { value: StudentLevel; label: string; count: number }[] = [
    {
      value: "bachelors" as StudentLevel,
      label: "Bachelor's students",
      count: studentsAtLevel("bachelors").length,
    },
    {
      value: "masters" as StudentLevel,
      label: "Master's students",
      count: studentsAtLevel("masters").length,
    },
    {
      value: "phd" as StudentLevel,
      label: "PhD students",
      count: studentsAtLevel("phd").length,
    },
    {
      value: "unset" as StudentLevel,
      label: "Level not set",
      count: studentsAtLevel("unset").length,
    },
  ].filter((tab) => tab.value !== "unset" || tab.count > 0);
  const groupUsers =
    roleGroup === "professors"
      ? professorUsers
      : roleGroup === "others"
        ? otherUsers
        : studentsAtLevel(studentLevel);

  const renderUserList = (listUsers: User[], showDepartment = false) =>
    listUsers.length === 0 ? (
      <EmptyState title="No users in this group yet" />
    ) : (
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {listUsers.map((user) => (
          <li
            key={user.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium text-slate-800">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
              <p className="mt-0.5 text-xs capitalize text-slate-600">
                {[
                  user.role.toLowerCase().replace(/^.*\./, "").replace(/_/g, " "),
                  showDepartment ? departmentName(user.departmentId) : null,
                  `added ${new Date(user.createdAt).toLocaleDateString()}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {canEditUsers && (
              <button
                type="button"
                onClick={() => openEditUser(user)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={14} aria-hidden="true" /> Account
              </button>
            )}
          </li>
        ))}
      </ul>
    );

  const handleUploadAvatar = async (file: File) => {
    setIsUploadingAvatar(true);
    try {
      const avatarUrl = await uploadAvatarImage(file);
      setProfile((current) => (current ? { ...current, avatarUrl } : current));
      toast.success("Profile photo updated.");
    } catch (uploadError) {
      toast.error(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload image.",
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Reloads both lists: a user's degree level (and so their group) can change when an account is saved.
  const reloadDirectory = async () => {
    try {
      const [usersResult, profilesResult] = await Promise.all([
        requestGraphQL<{ users: User[] }>(USERSQUERY),
        role === "admin"
          ? requestGraphQL<{ profiles: AdminProfile[] }>(PROFILES_QUERY)
          : Promise.resolve({ profiles: [] as AdminProfile[] }),
      ]);
      setUsers(usersResult.users);
      setProfiles(profilesResult.profiles);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Unable to reload users.",
      );
    }
  };

  const programsForLevel = (level: string) =>
    degreePrograms
      .filter((program) => program.level.toLowerCase() === level)
      .sort((first, second) => first.name.localeCompare(second.name));

  const reloadDegreePrograms = async () => {
    try {
      const result = await requestGraphQL<{ degreePrograms: DegreeProgram[] }>(
        DEGREE_PROGRAMS_QUERY,
      );
      setDegreePrograms(result.degreePrograms);
    } catch {
      // The list only feeds the degree dropdowns; the next page load refreshes it.
    }
  };

  // Changing the level picks that level's only program, so the common case needs no second click.
  const chooseLevel = (level: string): DegreeChoice => {
    const programs = programsForLevel(level);
    return {
      degreeLevel: level,
      degreeProgramId: programs.length === 1 ? programs[0].id : "",
    };
  };

  const renderDegreeFields = (
    choice: DegreeChoice,
    onChange: (choice: DegreeChoice) => void,
    required: boolean,
  ) => {
    const programs = choice.degreeLevel
      ? programsForLevel(choice.degreeLevel)
      : [];
    const subject = (
      profile?.departmentId
        ? departmentName(profile.departmentId)
        : "your department"
    ).replace(/^department of /i, "");
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
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </label>
        {choice.degreeLevel &&
          (programs.length > 0 ? (
            <label className="block text-sm font-medium text-slate-700">
              Degree program
              <select
                required={required}
                value={choice.degreeProgramId}
                onChange={(event) =>
                  onChange({ ...choice, degreeProgramId: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Select program</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="text-sm font-medium text-slate-700">
              Degree program
              <p className="mt-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 font-normal text-slate-600">
                {degreeLevelLabel(choice.degreeLevel)} in {subject}
                <span className="block text-xs text-slate-500">
                  Your department has no {degreeLevelLabel(choice.degreeLevel)}{" "}
                  program yet, so it will be created.
                </span>
              </p>
            </div>
          ))}
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
    const currentProgram = degreePrograms.find(
      (program) => program.id === user.degreeProgramId,
    );
    setEditForm({
      name: user.name,
      email: user.email,
      password: "",
      degreeLevel: currentProgram?.level.toLowerCase() ?? "",
      degreeProgramId: user.degreeProgramId ?? "",
    });
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
          degreeProgramId:
            form.role === "student" ? form.degreeProgramId || null : null,
          // With no program chosen, the backend uses (or creates) the department's program at this level.
          degreeLevel:
            form.role === "student" ? form.degreeLevel || null : null,
        },
      });
      const createdLevel = form.role === "student" ? form.degreeLevel : null;
      setUsers((currentUsers) => [
        { ...result.createUser, degreeLevel: createdLevel },
        ...currentUsers,
      ]);
      // Show the group the new user landed in; otherwise a Master's or PhD student is created
      // behind the Bachelor's tab and it looks as if nothing happened.
      if (role === "admin") {
        if (form.role === "student") {
          setRoleGroup("students");
          setStudentLevel((createdLevel as StudentLevel) || "bachelors");
        } else {
          setRoleGroup(form.role === "professor" ? "professors" : "others");
        }
      }
      toast.success(
        `${result.createUser.name} was created${createdLevel ? ` as a ${degreeLevelLabel(createdLevel)} student` : form.role === "professor" ? " as a professor" : ""}.`,
      );
      setForm({
        name: "",
        email: "",
        password: "",
        role: "student",
        departmentId: "",
        degreeLevel: "bachelors",
        degreeProgramId: "",
      });
      await reloadDegreePrograms();
      await reloadDirectory();
      closeCreateUser();
    } catch (requestError) {
      setCreateUserError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create user.",
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
          degreeProgramId:
            editingUser.role === "student"
              ? editForm.degreeProgramId || null
              : null,
          degreeLevel:
            editingUser.role === "student"
              ? editForm.degreeLevel || null
              : null,
        },
      });
      await reloadDegreePrograms();
      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === result.updateUser.id
            ? { ...user, ...result.updateUser }
            : user,
        ),
      );
      await reloadDirectory();
      toast.success(`${editForm.name}'s account was updated.`);
      closeEditUser();
    } catch (requestError) {
      setUpdateUserError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update user.",
      );
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const openCreateUser = () => {
    if (role === "super_admin") {
      openDepartmentAdminForm();
      return;
    }
    setCreateUserError(null);
    setForm((currentForm) => ({
      ...currentForm,
      // A new student defaults to the level being browsed.
      ...chooseLevel(
        roleGroup === "students" && studentLevel !== "unset"
          ? studentLevel
          : currentForm.degreeLevel || "bachelors",
      ),
      role:
        roleGroup === "professors"
          ? "professor"
          : roleGroup === "others"
            ? "external"
            : "student",
    }));
    setIsCreateUserOpen(true);
  };
  const openEditUserById = (userId: string) => {
    const user = users.find((item) => item.id === userId);
    if (user) openEditUser(user);
  };

  const nav: NavItem[] =
    role === "super_admin"
      ? [
          { key: "users", label: "Users", icon: Users },
          { key: "departments", label: "Departments", icon: Building2 },
        ]
      : [
          { key: "overview", label: "Overview", icon: LayoutDashboard },
          { key: "people", label: "People", icon: Users },
          { key: "timeline", label: "Research timeline", icon: CalendarRange },
          {
            key: "proposals",
            label: "Proposals",
            icon: NotebookPen,
            badge: badges?.proposals,
          },
          {
            key: "defenses",
            label: "Defenses",
            icon: Gavel,
            badge: badges?.defenses,
          },
          { key: "setup", label: "Programs & clusters", icon: Settings2 },
        ];
  const managementView = MANAGEMENT_VIEWS[section];
  const levelPicker =
    role === "admin" && LEVEL_SECTIONS.has(section) ? (
      <SegmentedControl
        label="Degree level"
        options={DEGREE_LEVELS.map((item) => ({
          value: item.value as DegreeLevel,
          label: item.label,
          // The count for the page being viewed: proposals to assign, or reports to schedule.
          count:
            (section === "proposals"
              ? badges?.proposalsByLevel[item.value as DegreeLevel]
              : section === "defenses"
                ? badges?.defensesByLevel[item.value as DegreeLevel]
                : undefined) || undefined,
        }))}
        value={level}
        onChange={setLevel}
      />
    ) : undefined;
  const departmentLabel = profile?.departmentId
    ? departmentName(profile.departmentId)
    : null;

  return (
    <>
      <AppShell
        roleLabel={role === "super_admin" ? "Super administrator" : "Department admin"}
        nav={nav}
        active={section}
        title={SECTION_TITLES[section]}
        headerActions={levelPicker}
        user={{
          name: profile?.name,
          email: profile?.email,
          avatarUrl: resolveAvatarUrl(profile?.avatarUrl),
        }}
        onUploadAvatar={(file) => void handleUploadAvatar(file)}
        isUploadingAvatar={isUploadingAvatar}
      >
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>
        )}

        {/* Stays mounted while other sections are shown, so its data and the
            sidebar counts don't reload on every click. */}
        <div hidden={!managementView}>
          <AdminManagement
            role={role}
            view={managementView ?? (role === "super_admin" ? "departments" : "overview")}
            level={level}
            onNavigate={(target, targetLevel) => {
              if (targetLevel) setLevel(targetLevel);
              goTo(target);
            }}
            onBadgesChange={setBadges}
            refreshKey={refreshKey}
            departmentLabel={departmentLabel}
          />
        </div>

        {section === "profile" && (
          <ProfileCard
            name={profile?.name ?? "Administrator"}
            avatarUrl={resolveAvatarUrl(profile?.avatarUrl)}
            fields={[
              { label: "Email", value: profile?.email ?? "—" },
              {
                label: "Role",
                value: (
                  <span className="capitalize">
                    {profile?.role.replace(/_/g, " ") ?? "—"}
                  </span>
                ),
              },
              {
                label: "Department",
                value: profile?.departmentId
                  ? departmentName(profile.departmentId)
                  : "All departments",
              },
              {
                label: "Member since",
                value: profile
                  ? new Date(profile.createdAt).toLocaleDateString()
                  : "—",
              },
            ]}
          />
        )}

        {section === "people" && role === "admin" && (
          <div className="space-y-4">
            <SectionHeader
              title="Professors and students"
              description="Each person has an account (name, email, password) and a profile (roll number, program and supervisor for students; rank and capacity for professors). Professors need a profile to sit on defense panels."
              action={
                <button type="button" onClick={openCreateUser} className={primaryButtonClass}>
                  <Plus size={16} aria-hidden="true" /> Add person
                </button>
              }
            />
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                label="People"
                options={roleTabs}
                value={roleGroup}
                onChange={setRoleGroup}
              />
              {roleGroup === "students" && (
                <SegmentedControl
                  label="Degree level"
                  options={levelTabs.map((tab) => ({
                    ...tab,
                    label: tab.label.replace(" students", ""),
                  }))}
                  value={studentLevel}
                  onChange={setStudentLevel}
                />
              )}
            </div>
            {roleGroup === "others" ? (
              renderUserList(groupUsers)
            ) : (
              <ProfileManagement
                key={`${roleGroup}-${studentLevel}`}
                profileType={roleGroup === "professors" ? "professor" : "student"}
                users={groupUsers}
                profiles={profiles}
                degreePrograms={degreePrograms}
                professors={professorUsers}
                degreeLevel={
                  roleGroup === "students" && studentLevel !== "unset"
                    ? studentLevel
                    : null
                }
                onSaved={reloadDirectory}
                onEditAccount={openEditUserById}
              />
            )}
          </div>
        )}

        {section === "users" && role === "super_admin" && (
          <div className="space-y-6">
            <SectionHeader
              title="Everyone, by department"
              description="You add each department's administrator; they add that department's professors and students."
              action={
                <button type="button" onClick={openCreateUser} className={primaryButtonClass}>
                  <Plus size={16} aria-hidden="true" /> Add department admin
                </button>
              }
            />
            {visibleUsers.length === 0 ? (
              <EmptyState title="No users yet" />
            ) : (
              <>
                {departmentGroups.map((group) => (
                  <section key={group.department.id}>
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">
                      {group.department.name}
                      <span className="ml-2 font-normal text-slate-400">
                        {group.users.length}
                      </span>
                    </h3>
                    {renderUserList(group.users)}
                  </section>
                ))}
                {usersWithoutDepartment.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">
                      Without a department
                    </h3>
                    {renderUserList(usersWithoutDepartment)}
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </AppShell>
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {role === "super_admin"
                    ? "Create department admin"
                    : "Create user"}
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
                    onChange={(event) =>
                      updateForm("password", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-11 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    aria-label={
                      isPasswordVisible ? "Hide password" : "Show password"
                    }
                    onClick={() => setIsPasswordVisible((visible) => !visible)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800"
                  >
                    {isPasswordVisible ? (
                      <EyeOff size={18} aria-hidden="true" />
                    ) : (
                      <Eye size={18} aria-hidden="true" />
                    )}
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
                    {role === "admin" && (
                      <>
                        <option value="student">Student</option>
                        <option value="professor">Professor</option>
                        <option value="external">External</option>
                      </>
                    )}
                    {role === "super_admin" && (
                      <option value="admin">Department admin</option>
                    )}
                  </select>
                </label>
                {role === "super_admin" ? (
                  <label className="block text-sm font-medium text-slate-700">
                    Department
                    <select
                      required
                      value={form.departmentId}
                      onChange={(event) =>
                        updateForm("departmentId", event.target.value)
                      }
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
                      {profile?.departmentId
                        ? departmentName(profile.departmentId)
                        : "Your department"}
                    </p>
                  </div>
                )}
              </div>
              {form.role === "student" && (
                <div>
                  {renderDegreeFields(
                    form,
                    (choice) =>
                      setForm((currentForm) => ({ ...currentForm, ...choice })),
                    true,
                  )}
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    The student's profile is created automatically once they
                    submit a proposal.
                  </span>
                </div>
              )}
              {createUserError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {createUserError}
                </p>
              )}
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
                <h2 className="text-xl font-semibold text-slate-900">
                  Edit user
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Update {editingUser.name}'s account details.
                </p>
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
                  onChange={(event) =>
                    updateEditForm("name", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(event) =>
                    updateEditForm("email", event.target.value)
                  }
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
                    onChange={(event) =>
                      updateEditForm("password", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-11 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    aria-label={
                      isEditPasswordVisible
                        ? "Hide new password"
                        : "Show new password"
                    }
                    onClick={() =>
                      setIsEditPasswordVisible((visible) => !visible)
                    }
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800"
                  >
                    {isEditPasswordVisible ? (
                      <EyeOff size={18} aria-hidden="true" />
                    ) : (
                      <Eye size={18} aria-hidden="true" />
                    )}
                  </button>
                </span>
              </label>
              {editingUser?.role === "student" &&
                renderDegreeFields(
                  editForm,
                  (choice) =>
                    setEditForm((currentForm) => ({
                      ...currentForm,
                      ...choice,
                    })),
                  false,
                )}
              {updateUserError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {updateUserError}
                </p>
              )}
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
    </>
  );
}

export default AdminDashboard;
