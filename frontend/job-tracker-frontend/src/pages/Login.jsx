import { Link } from "react-router-dom";
import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { LOGIN } from "../graphql/mutation";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loginUser, { data, loading, error }] = useMutation(LOGIN);
  // console.log(loginUser)

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await loginUser({
        variables: {
          userInput: { email, password },
        },
      });

      console.log(response)
      const token = response?.data?.loginUser?.accessToken;
      console.log(token)

      if (token) {
        localStorage.setItem("token", token);
        window.location.href = '/posts'
      }
    } catch (submitError) {
      console.error("Login failed:", submitError);
    }
  };

  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/95 p-8 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">
              Welcome back
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">
              Login Page
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Sign in to continue to your dashboard.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                type="text"
                name="email"
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <button className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-700 cursor-pointer">
              Login
            </button>
            <p>
              Don't have an account ?{" "}
              <Link to="/register">
                <u>Register</u>
              </Link>
            </p>
          </form>
        </div>
      </div>
    </>
  );
}

export default Login;
