import { Outlet, useLocation } from "react-router-dom";

import Footer from "../components/common/Footer";
import Navbar from "../components/common/Navbar";
import { guestFlow } from "../routes/appRoutes";

function GuestLayout() {
  const location = useLocation();

  return (
    <div className="site-atmosphere min-h-screen">
      <Navbar links={guestFlow} />
      <main className="route-transition" key={location.pathname}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default GuestLayout;
