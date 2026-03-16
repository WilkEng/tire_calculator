import { useState, useEffect, useCallback, useRef, type InputHTMLAttributes, type ReactNode } from "react";

interface NumericInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
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
  // Keep a local string mirror so the user can type freely (e.g. "2." or "")
  // without the controlled value snapping back.
  const [localText, setLocalText] = useState(() =>
    value != null ? String(value) : ""
  );
  const isFocused = useRef(false);

  // Sync external value → local text only when the input is NOT focused
  useEffect(() => {
    if (!isFocused.current) {
      setLocalText(value != null ? String(value) : "");
    }
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(",", ".");
      setLocalText(raw);

      if (raw === "" || raw === "-") {
        onChange(undefined);
      } else {
        const parsed = parseFloat(raw);
        if (!isNaN(parsed)) {
          onChange(parsed);
        }
      }
    },
    [onChange]
  );

  const handleFocus = useCallback(() => {
    isFocused.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    isFocused.current = false;
    // Normalise display on blur
    setLocalText(value != null ? String(value) : "");
  }, [value]);

  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
        {label}
        {unit && <span className="text-gray-500 ml-1">({unit})</span>}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={localText}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="
          bg-gray-800/80 border border-gray-600/60 rounded-lg px-3 py-2
          text-sm text-white tabular-nums
          focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/50 focus:border-[#00d4aa]/40
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
