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
      className={`bg-gray-900 border border-gray-700 rounded-lg overflow-hidden ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          {title && (
            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
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
