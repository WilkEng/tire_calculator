import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function Card({
  title,
  children,
  className = "",
  actions,
}: CardProps) {
  return (
    <div
      className={`bg-gray-900/80 border border-gray-700/60 rounded-xl overflow-hidden shadow-lg shadow-black/10 ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/40">
          {title && (
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              {title}
            </h3>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}
