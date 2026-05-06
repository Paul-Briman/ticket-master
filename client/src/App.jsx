import { Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Home from './pages/Home.jsx'
import EventDetails from './pages/EventDetails.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import VerifyOtp from './pages/VerifyOtp.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Checkout from './pages/Checkout.jsx'
import Sports from './pages/Sports.jsx'
import Concerts from './pages/Concerts.jsx'
import Arts from './pages/Arts.jsx'
import Family from './pages/Family.jsx'
import Cities from './pages/Cities.jsx'
import CityPage from './pages/CityPage.jsx'
import MyTickets from './pages/MyTickets.jsx'
import AdminOverview from './pages/admin/Overview.jsx'
import AdminEvents from './pages/admin/AdminEvents.jsx'
import AdminUsers from './pages/admin/AdminUsers.jsx'
import AdminOrders from './pages/admin/AdminOrders.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />

        <Route path="/sports" element={<Sports />} />
        <Route path="/concerts" element={<Concerts />} />
        <Route path="/arts" element={<Arts />} />
        <Route path="/family" element={<Family />} />

        <Route path="/cities" element={<Cities />} />
        <Route path="/city/:name" element={<CityPage />} />

        <Route path="/event/:id" element={<EventDetails />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-tickets"
          element={
            <ProtectedRoute>
              <MyTickets />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute requireRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="orders" element={<AdminOrders />} />
        </Route>
      </Route>
    </Routes>
  )
}
