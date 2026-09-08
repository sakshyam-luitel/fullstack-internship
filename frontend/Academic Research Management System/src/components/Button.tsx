import type { ButtonHTMLAttributes } from "react";
import { Users, type LucideIcon } from "lucide-react";

type ButtonColor = "slate" | "blue" | "amber" | "emerald" | "red";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    label: string;
    icon?: LucideIcon;
    color?: ButtonColor;
}

const colorClasses: Record<ButtonColor, string> = {
    slate: "border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50",
    blue: "border-blue-300 text-blue-700 hover:border-blue-400 hover:bg-blue-50",
    amber: "border-amber-300 text-amber-700 hover:border-amber-400 hover:bg-amber-50",
    emerald: "border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50",
    red: "border-red-300 text-red-700 hover:border-red-400 hover:bg-red-50",
};

// Provide one reusable button API for labels, Lucide icons, colors, and native button behavior.
function Button({
    label,
    icon: Icon = Users,
    color = "slate",
    className = "",
    type = "button",
    ...buttonProps
}: ButtonProps) {
    return (
        <button
            type={type}
            className={`mt-2 flex items-center gap-2 rounded-lg border px-4 py-2 font-sans text-sm font-thin transition hover:cursor-pointer ${colorClasses[color]} ${className}`}
            {...buttonProps}
        >
            <Icon size={18} aria-hidden="true" />
            {label}
        </button>
    );
}

export default Button;