import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: React.ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, icon, children, ...props }, ref) => {
    return (
      <div className="relative inline-block w-full">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none flex items-center justify-center">
            {icon}
          </div>
        )}
        <select
          ref={ref}
          className={cn(
            "win11-card rounded-xl text-xs text-foreground transition-all shadow-2xs cursor-pointer",
            "bg-card border border-border",
            "focus:outline-none focus:border-b-2 focus:border-b-primary focus:ring-0",
            icon ? "pl-9 pr-8 py-2" : "px-3 py-2",
            className
          )}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  }
);

Select.displayName = 'Select';
