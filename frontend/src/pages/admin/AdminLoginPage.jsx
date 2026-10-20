import { ArrowLeft, LockKeyhole, MoveRight } from "lucide-react";
import toast from "react-hot-toast";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Button from "../../components/common/Button";
import { login } from "../../services/authService";
import { useAppState } from "../../store/AppStateContext";

function AdminLoginPage() {
  const navigate = useNavigate();
  const { loginAdmin } = useAppState();
  const [form, setForm] = useState({
    email: "",
    password: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      const session = await login(form);
      loginAdmin(session);
      toast.success("Welcome back");
      navigate("/admin/dashboard");
    } catch (error) {
      const detail =
        error?.response?.data?.non_field_errors?.[0] ||
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "Unable to log in right now.";
      toast.error(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-shell flex min-h-screen items-center justify-center">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="glass-panel hidden lg:block">
          <p className="pill">Your photographer workspace</p>
          <h1 className="hero-heading mt-8">Photographer operations, event setup, and uploads in one clean workspace.</h1>
          <p className="subtle-copy mt-6 max-w-xl">
            Sign in to manage your events, upload photos, and share beautiful memories with your guests.
          </p>

          <div className="mt-10 space-y-4">
            {[
              "Create and launch wedding events with unique event codes",
              "Add event albums from your device or Google Drive",
              "Keep track of your events and photo uploads"
            ].map((item) => (
              <div key={item} className="rounded-[24px] border border-white/50 bg-white/75 px-5 py-4 text-sm font-semibold text-[var(--text)]">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel">
          <div className="mx-auto max-w-md">
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]" to="/">
              <ArrowLeft size={16} />
              Back to Home
            </Link>

            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white">
              <LockKeyhole size={24} />
            </div>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">
              Photographer sign in
            </p>
            <h2 className="mt-4 text-4xl font-semibold text-[var(--text)]">Welcome back to your studio dashboard.</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Sign in with your photographer account to manage your events.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="field-label" htmlFor="admin-email">
                  Email
                </label>
                <input
                  className="field-input mt-2"
                  id="admin-email"
                  required
                  autoComplete="email"
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  type="email"
                  value={form.email}
                />
              </div>

              <div>
                <label className="field-label" htmlFor="admin-password">
                  Password
                </label>
                <input
                  className="field-input mt-2"
                  id="admin-password"
                  required
                  autoComplete="current-password"
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  type="password"
                  value={form.password}
                />
              </div>

              <div className="flex justify-end">
                <Link className="text-sm font-semibold text-[var(--primary)]" to="/admin/forgot-password">
                  Forgot password?
                </Link>
              </div>

              <Button className="w-full" disabled={isSubmitting} type="submit">
                {isSubmitting ? "Signing in..." : "Enter dashboard"}
                <MoveRight className="ml-2" size={18} />
              </Button>
            </form>

            <p className="mt-5 text-sm text-[var(--muted)]">
              New photographer?{" "}
              <Link className="font-semibold text-[var(--primary)]" to="/admin/register">
                Create your account
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AdminLoginPage;
