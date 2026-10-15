import type { ReactNode } from 'react';

/** Shared workspace boundary so panels can be rearranged without duplicating the shell. */
export function StudioWorkspace({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`workspace-grid ${className}`.trim()}>{children}</main>;
}
