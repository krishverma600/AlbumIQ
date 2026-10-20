import toast from "react-hot-toast";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

import AdminHeader from "../components/admin/AdminHeader";
import AdminSidebar from "../components/admin/AdminSidebar";
import { useAppState } from "../store/AppStateContext";

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { adminSession, logoutAdmin } = useAppState();

  if (!adminSession.isLoggedIn && location.pathname !== "/admin/login") {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="site-atmosphere admin-shell page-shell">
      <div className="mx-auto grid max-w-7xl gap-6 items-start lg:grid-cols-[240px_minmax(0,1fr)]">
        <AdminSidebar
          adminName={adminSession.name}
          onLogout={() => {
            logoutAdmin();
            toast.success("You have signed out");
            navigate("/admin/login");
          }}
        />

        <div className="min-w-0 space-y-6">
          <AdminHeader />
          <div className="route-transition" key={location.pathname}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;
