import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const VARIANTS = {
  primary:
    "bg-blue-600 hover:bg-blue-700 text-white border-blue-500",
  secondary:
    "bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600",
  danger:
    "bg-red-600 hover:bg-red-700 text-white border-red-500",
  ghost:
    "bg-transparent hover:bg-gray-800 text-gray-300 border-transparent",
};

const SIZES = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 rounded border font-medium
        transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANTS[variant]} ${SIZES[size]} ${className}
      `}
      {...rest}
    >
      {children}
    </button>
  );
}
