import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-10 w-full appearance-none rounded-md border border-slate-300 bg-white px-3 pr-9 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
});

Select.displayName = "Select";

export { Select };
