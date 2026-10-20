import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AdminLayout from "./layouts/AdminLayout";
import GuestLayout from "./layouts/GuestLayout";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminForgotPasswordPage from "./pages/admin/AdminForgotPasswordPage";
import AdminRegisterPage from "./pages/admin/AdminRegisterPage";
import AdminProfilePage from "./pages/admin/AdminProfilePage";
import AnalyticsPage from "./pages/admin/AnalyticsPage";
import CreateEventPage from "./pages/admin/CreateEventPage";
import DashboardPage from "./pages/admin/DashboardPage";
import UploadPhotosPage from "./pages/admin/UploadPhotosPage";
import EventAccessPage from "./pages/guest/EventAccessPage";
import GalleryPage from "./pages/guest/GalleryPage";
import HomePage from "./pages/guest/HomePage";
import SelfieUploadPage from "./pages/guest/SelfieUploadPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GuestLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/event" element={<EventAccessPage />} />
          <Route path="/event/:eventCode" element={<EventAccessPage />} />
          <Route path="/upload-selfie/:eventCode" element={<SelfieUploadPage />} />
          <Route path="/gallery/:eventCode" element={<GalleryPage />} />
        </Route>

        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/register" element={<AdminRegisterPage />} />
        <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="create-event" element={<CreateEventPage />} />
          <Route path="upload-photos" element={<UploadPhotosPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="profile" element={<AdminProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
