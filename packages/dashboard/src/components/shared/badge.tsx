import type { ReactNode } from 'react';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-green-500/15 text-green-400 border-green-500/25',
  error: 'bg-red-500/15 text-red-400 border-red-500/25',
  warning: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  neutral: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
};

export function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

/* HTTP Method badge */
interface MethodBadgeProps {
  method: string;
}

const methodVariants: Record<string, BadgeVariant> = {
  GET: 'success',
  POST: 'info',
  PUT: 'warning',
  PATCH: 'warning',
  DELETE: 'error',
  OPTIONS: 'neutral',
  HEAD: 'neutral',
};

export function MethodBadge({ method }: MethodBadgeProps) {
  const upper = method.toUpperCase();
  const variant = methodVariants[upper] ?? 'neutral';
  return <Badge variant={variant}>{upper}</Badge>;
}

/* HTTP Status Code badge */
interface StatusBadgeProps {
  status: number;
}

function statusVariant(status: number): BadgeVariant {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'info';
  if (status >= 400 && status < 500) return 'warning';
  if (status >= 500) return 'error';
  return 'neutral';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <Badge variant={statusVariant(status)}>{String(status)}</Badge>;
}
