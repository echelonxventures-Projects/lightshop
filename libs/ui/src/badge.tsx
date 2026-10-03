import type { ReactNode } from 'react';

export function Badge({ children }: { children: ReactNode }) {
  return <span className="ls-badge">{children}</span>;
}
