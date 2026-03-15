"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────────

export interface ComboBoxOption {
  /** Display label */
  label: string;
  /** Optional secondary text (e.g. coordinates) */
  description?: string;
  /** Arbitrary metadata carried with the option */
  meta?: Record<string, unknown>;
}

interface ComboBoxProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Called when a specific option from the dropdown is picked */
  onSelect?: (option: ComboBoxOption) => void;
  /** Static list of suggestions (e.g. from history) */
  options?: ComboBoxOption[];
  placeholder?: string;
  className?: string;
  /** Extra action button (e.g. GPS detect) */
  actionButton?: React.ReactNode;
}

// ─── Component ─────────────────────────────────────────────────────

export function ComboBox({
  label,
  value,
  onChange,
  onSelect,
  options = [],
  placeholder,
  className = "",
  actionButton,
}: ComboBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<ComboBoxOption[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on input
  useEffect(() => {
    if (!value.trim()) {
      setFilteredOptions(options);
    } else {
      const q = value.toLowerCase();
      setFilteredOptions(
        options.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            o.description?.toLowerCase().includes(q)
        )
      );
    }
  }, [value, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      setIsOpen(true);
    },
    [onChange]
  );

  const handleSelectOption = useCallback(
    (option: ComboBoxOption) => {
      onChange(option.label);
      onSelect?.(option);
      setIsOpen(false);
    },
    [onChange, onSelect]
  );

  const handleFocus = useCallback(() => {
    if (filteredOptions.length > 0) {
      setIsOpen(true);
    }
  }, [filteredOptions.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    },
    []
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          {label}
        </span>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/50 focus:border-transparent placeholder-gray-500"
          />
          {actionButton}
        </div>
      </label>

      {/* Dropdown */}
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-gray-800 border border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.map((opt, i) => (
            <button
              key={`${opt.label}-${i}`}
              className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
              onClick={() => handleSelectOption(opt)}
            >
              {opt.label}
              {opt.description && (
                <span className="text-xs text-gray-500 ml-2">
                  {opt.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
