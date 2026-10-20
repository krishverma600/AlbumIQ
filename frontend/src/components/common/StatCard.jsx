export default function StatCard({ label, value, change }) {
  return <article className="min-w-0 rounded-[24px] border bg-white/85 p-5 shadow-sm">
    <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
    <h3 className="mt-3 break-words text-2xl font-extrabold leading-tight text-[var(--text)]">{value}</h3>
    {change ? <p className="mt-2 break-words text-xs leading-5 text-[var(--muted)]">{change}</p> : null}
  </article>;
}
