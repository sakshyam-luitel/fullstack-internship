import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

// Render a consistent form field and add visibility controls when the field is a password.
function AuthField({ label, id, type = "text", ...inputProps }: AuthFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <div className="relative">
        <input
          id={id}
          type={isPassword && isVisible ? "text" : type}
          className={`w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ${isPassword ? "pr-12" : ""}`}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setIsVisible((visible) => !visible)}
            aria-label={isVisible ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          >
            {isVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  );
}

export default AuthField;
