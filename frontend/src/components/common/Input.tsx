import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, type = 'text', ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none flex items-center justify-center">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            "w-full win11-card rounded-xl text-xs text-foreground placeholder:text-muted-foreground transition-all shadow-2xs",
            "bg-card border border-border",
            "focus:outline-none focus:border-b-2 focus:border-b-primary focus:ring-0",
            icon ? "pl-9 pr-3 py-2" : "px-3 py-2",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
