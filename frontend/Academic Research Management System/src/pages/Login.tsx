import AuthField from "../components/AuthField";
import AuthLayout from "../components/AuthLayout";
import { LOGIN } from "../mutations/mutations";
import { useMutation } from "@apollo/client/react";
import { useState } from "react";

// Present the sign-in form; submission behavior can be connected to the backend later.
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [login, { loading, error }] = useMutation(LOGIN);

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to your workspace"
      description="Enter your details to continue managing your academic research environment."
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          login({ variables: { userInput: { email, password } } });
        }}
      >
        <AuthField
          id="login-email"
          name="email"
          type="email"
          label="Email address"
          placeholder="you@example.com"
          autoComplete="email"
          required
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
        <AuthField
          id="login-password"
          name="password"
          type="password"
          label="Password"
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
        <div className="flex items-center justify-between gap-4 text-sm">
          <label
            className="flex items-center gap-2 text-slate-500"
            htmlFor="remember-me"
          >
            <input
              id="remember-me"
              name="rememberMe"
              type="checkbox"
              className="size-4 accent-blue-600"
            />
            Remember me
          </label>
          <button
            type="button"
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Forgot password?
          </button>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </p>
      )}
      <p className="mt-8 text-center text-sm text-slate-500">
        Account access is managed by your administrator.
      </p>
    </AuthLayout>
  );
}

export default Login;
