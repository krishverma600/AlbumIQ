import { HeartHandshake, Menu } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

import Button from "./Button";

function Navbar({ links = [], rightSlot, admin = false }) {
  return (
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl items-center justify-between rounded-[26px] border border-[rgba(117,82,65,0.12)] bg-[rgba(255,250,246,0.84)] px-4 py-3 shadow-[0_18px_45px_rgba(87,56,42,0.12)] backdrop-blur-xl sm:px-6">
        <Link className="reveal-up flex items-center gap-3" to={admin ? "/admin/dashboard" : "/"}>
          <div className="brand-mark flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--primary)] text-white shadow-[0_12px_25px_rgba(111,61,49,0.28)]">
            <HeartHandshake size={18} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              FindMyShaadi Pics
            </p>
            <p className="text-sm font-semibold text-[var(--text)]">Wedding memories, found with care</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              className={({ isActive }) =>
                `text-sm font-semibold transition duration-300 hover:-translate-y-0.5 ${
                  isActive ? "text-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--text)]"
                }`
              }
              to={link.to}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">{rightSlot}</div>

        <div className="lg:hidden">
          <Button aria-label="Open navigation" className="h-11 w-11 px-0" variant="secondary">
            <Menu size={18} />
          </Button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
