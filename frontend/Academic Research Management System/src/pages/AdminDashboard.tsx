import NavigationBar from "../components/NavigationBar";
import Button from "../components/Button";
import { Menu, Plus } from "lucide-react";
import { useEffect, useState } from "react";

interface User {
  id: string;
  departmentId: string;
  name: string;
  email: string;
  password: string;
  role: string;
  createdAt: string;
}

const usersQuery = `
  query Users {
    users {
      id
      departmentId
      name
      email
      password
      role
      createdAt
    }
  }
`;

// Load and present the administrator's user-management workspace.
function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  // Fetch the protected user list once when the dashboard becomes available.
  useEffect(() => {
    const loadUsers = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setError("Please log in as an administrator to view users.");
        return;
      }

      try {
        const response = await fetch("http://127.0.0.1:8000/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ query: usersQuery }),
        });
        const result = await response.json();

        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        setUsers(result.data.users);
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

  return (
    // Keep the navigation fixed while the dashboard content manages its own overflow.
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100">
      <NavigationBar
        open={isNavigationOpen}
        onClose={() => setIsNavigationOpen(false)}
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
            <p className="text-sm font-medium text-slate-700">Administration</p>
          </div>
        </div>
        <div className="min-h-0 w-full flex-1 overflow-auto rounded-b-2xl font-sans">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-medium text-slate-800">Users</h2>
              <p className="text-sm text-slate-500">Manage registered users</p>
            </div>
            <Button label="Create User" icon={Plus} color="blue" />
          </div>
          <div className="overflow-x-auto p-6">
            {error ? (
              <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </p>
            ) : (
              <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Department ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Password</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr className="border-b border-slate-100" key={user.id}>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{user.id}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{user.departmentId}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{user.name}</td>
                        <td className="px-4 py-3 text-slate-600">{user.email}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{user.password}</td>
                        <td className="px-4 py-3 capitalize text-slate-600">{user.role}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                          {new Date(user.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;