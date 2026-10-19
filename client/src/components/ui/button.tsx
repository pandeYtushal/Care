import * as React from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "secondary" | "destructive" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";
const variantClasses: Record<ButtonVariant, string> = {
  default: "border-brand bg-brand text-white hover:border-brand-hover hover:bg-brand-hover",
  secondary: "border-border-strong bg-surface text-ink hover:bg-surface-sub",
  destructive: "border-danger bg-danger text-white hover:opacity-90",
  ghost: "border-transparent bg-transparent text-ink hover:bg-surface-sub",
  link: "border-transparent bg-transparent text-brand underline-offset-4 hover:underline",
};
const sizeClasses: Record<ButtonSize, string> = {
  default: "min-h-10 px-4 py-2",
  sm: "min-h-9 px-3 py-1.5 text-xs",
  lg: "min-h-11 px-5 py-2.5",
  icon: "size-10 p-0",
};
const buttonVariants = ({ variant = "default", size = "default", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) =>
  cn("inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] border text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-55", variantClasses[variant], sizeClasses[size], className);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
