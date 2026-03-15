import type { SelectHTMLAttributes } from "react";

interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function Select({
  label,
  value,
  onChange,
  options,
  className = "",
  ...rest
}: SelectProps) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          bg-gray-800 border border-gray-600 rounded px-3 py-2
          text-sm text-white
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        "
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
