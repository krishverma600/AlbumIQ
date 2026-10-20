import { BarChart3, CalendarPlus, LayoutDashboard, LogOut, Upload, UserCircle2 } from "lucide-react";
import { NavLink } from "react-router-dom";

import { adminLinks } from "../../routes/appRoutes";
import { initialsFromName } from "../../utils/formatters";

const iconMap = {
  Dashboard: LayoutDashboard,
  "Create Wedding": CalendarPlus,
  "Upload Photos": Upload,
  Analytics: BarChart3,
  "Studio Profile": UserCircle2
};

function AdminSidebar({ adminName, onLogout }) {
  return (
    <aside className="glass-panel flex min-w-0 flex-col gap-5 lg:sticky lg:top-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-lg font-bold text-white">
          {initialsFromName(adminName)}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Photographer</p>
          <p className="text-lg font-semibold text-[var(--text)]">{adminName}</p>
        </div>
      </div>

      <nav className="space-y-2">
        {adminLinks.map((link) => {
          const Icon = iconMap[link.label] || UserCircle2;

          return (
            <NavLink
              key={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-[20px] px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[var(--primary)] text-white shadow-[0_18px_35px_rgba(124,61,143,0.28)]"
                    : "text-[var(--muted)] hover:bg-white hover:text-[var(--text)]"
                }`
              }
              to={link.to}
            >
              <Icon size={18} />
              {link.label}
            </NavLink>
          );
        })}
      </nav>

      <button
        className="mt-auto flex items-center gap-3 rounded-[20px] border border-[rgba(124,61,143,0.12)] px-4 py-3 text-sm font-semibold text-[var(--muted)] transition hover:bg-white hover:text-[var(--text)]"
        onClick={onLogout}
        type="button"
      >
        <LogOut size={18} />
        Log out
      </button>
    </aside>
  );
}

export default AdminSidebar;
