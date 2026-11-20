import type { ComponentChildren } from 'preact';

/** A small sticky note holding one number: a streak, a record, an average. */
export function StatCard({ label, value, sub }: { label: string; value: ComponentChildren; sub?: ComponentChildren }) {
  return (
    <div class="stat-card">
      <p class="stat-label">{label}</p>
      <p class="stat-value">{value}</p>
      {sub && <p class="stat-sub">{sub}</p>}
    </div>
  );
}

export function StatGrid({ children, label }: { children: ComponentChildren; label: string }) {
  return (
    <div class="stat-grid" role="group" aria-label={label}>
      {children}
    </div>
  );
}
