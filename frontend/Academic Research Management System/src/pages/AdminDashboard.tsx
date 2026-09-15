import NavigationBar from "../components/NavigationBar";
import Button from "../components/Button";
import { Eye, EyeOff, Menu, Pencil, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CREATE_USER, UPDATE_USER } from "../mutations/mutations";
import { CURRENT_USER_QUERY, DEPARTMENTSQUERY, USERSQUERY } from "../queries/queries";
import { print } from "graphql";
import AdminManagement from "./AdminManagement";

interface User {
  id: string;
  departmentId: string | null;
  name: string;
  email: string;
  password: string;
  role: string;
  createdAt: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Profile {
  id: string;
  departmentId: string | null;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  role: string;
  departmentId: string;
}

interface EditUserForm {
  name: string;
  email: string;
  password: string;
}

interface GraphQLResult<T> {
  data?: T;
  errors?: { message: string }[];
}

type AdminRole = "admin" | "super_admin";

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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
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
  });
  const [form, setForm] = useState<CreateUserForm>({
    name: "",
    email: "",
    password: "",
    role: "student",
    departmentId: "",
  });

  const openDepartmentAdminForm = () => {
    setForm({ name: "", email: "", password: "", role: "admin", departmentId: "" });
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
        const [profileResult, usersResult, departmentsResult] = await Promise.all([
          requestGraphQL<{ currentUser: Profile }>(CURRENT_USER_QUERY),
          requestGraphQL<{ users: User[] }>(USERSQUERY),
          requestGraphQL<{ departments: Department[] }>(DEPARTMENTSQUERY),
        ]);
        setProfile(profileResult.currentUser);
        setUsers(usersResult.users);
        setDepartments(departmentsResult.departments);
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
  const studentCount = visibleUsers.filter(
    (user) => user.role.toLowerCase().replace(/^.*\./, "") === "student",
  ).length;

  const renderUserTable = (groupUsers: User[]) => (
    <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <th className="px-4 py-3">ID</th>
          <th className="px-4 py-3">Department</th>
          <th className="px-4 py-3">Name</th>
          <th className="px-4 py-3">Email</th>
          <th className="px-4 py-3">Password</th>
          <th className="px-4 py-3">Role</th>
          <th className="px-4 py-3">Created At</th>
          <th className="px-4 py-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {groupUsers.map((user) => (
          <tr className="border-b border-slate-100" key={user.id}>
            <td className="px-4 py-3 font-mono text-xs text-slate-500">{user.id}</td>
            <td className="px-4 py-3 text-slate-600">
              {departmentName(user.departmentId)}
            </td>
            <td className="px-4 py-3 font-medium text-slate-800">{user.name}</td>
            <td className="px-4 py-3 text-slate-600">{user.email}</td>
            <td className="px-4 py-3 font-mono text-xs text-slate-500">********</td>
            <td className="px-4 py-3 capitalize text-slate-600">{user.role}</td>
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
    setEditForm({ name: user.name, email: user.email, password: "" });
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
          departmentId: form.departmentId,
        },
      });
      setUsers((currentUsers) => [result.createUser, ...currentUsers]);
      setForm({ name: "", email: "", password: "", role: "student", departmentId: "" });
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
        },
      });
      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === result.updateUser.id ? result.updateUser : user,
        ),
      );
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
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{profile?.name ?? "Administrator"}</h2>
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
              <p className="text-sm text-slate-500">Manage registered users</p>
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