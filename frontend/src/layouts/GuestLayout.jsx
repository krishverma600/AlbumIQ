import { Outlet, useLocation } from "react-router-dom";

import Footer from "../components/common/Footer";
import Navbar from "../components/common/Navbar";
import { guestFlow as guestLinks } from "../routes/appRoutes";

import { useAppState } from "../store/AppStateContext";

function GuestLayout() {
  const location = useLocation();
  const { guestFlow } = useAppState();
  const links = guestLinks.filter((link) => link.label !== "Guest Gallery" || guestFlow.eventCode).map((link) => link.label === "Guest Gallery" && guestFlow.eventCode ? { ...link, to: `/gallery/${guestFlow.eventCode}` } : link);

  return (
    <div className="site-atmosphere min-h-screen">
      <Navbar links={links} />
      <main className="route-transition" key={location.pathname}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default GuestLayout;
