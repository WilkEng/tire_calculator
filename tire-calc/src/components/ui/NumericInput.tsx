import type { InputHTMLAttributes, ReactNode } from "react";

interface NumericInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: ReactNode;
  unit?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

export function NumericInput({
  label,
  unit,
  value,
  onChange,
  className = "",
  ...rest
}: NumericInputProps) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
        {label}
        {unit && <span className="text-gray-500 ml-1">({unit})</span>}
      </span>
      <input
        type="number"
        step="any"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? undefined : parseFloat(raw));
        }}
        className="
          bg-gray-800 border border-gray-600 rounded px-3 py-2
          text-sm text-white tabular-nums
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          placeholder-gray-500
          [appearance:textfield]
          [&::-webkit-outer-spin-button]:appearance-none
          [&::-webkit-inner-spin-button]:appearance-none
        "
        {...rest}
      />
    </label>
  );
}
