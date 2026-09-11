import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
  leftIcon?: React.ReactNode;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, containerClassName, leftIcon, disabled, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <div className={cn("relative flex items-center w-full", containerClassName)}>
        {leftIcon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-muted-foreground">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          type={showPassword ? "text" : "password"}
          disabled={disabled}
          className={cn(
            "w-full py-2.5 bg-muted/50 border border-border rounded-xl text-sm transition-all",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
            leftIcon ? "pl-11" : "pl-4",
            "pr-10",
            disabled && "opacity-60 cursor-not-allowed",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          disabled={disabled}
          tabIndex={-1}
          aria-label={showPassword ? "Hide password" : "Show password"}
          title={showPassword ? "Hide password" : "Show password"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30"
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4 text-primary" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
