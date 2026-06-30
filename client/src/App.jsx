import { Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import TawkChat from './components/TawkChat.jsx'
import Home from './pages/Home.jsx'
import EventDetails from './pages/EventDetails.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import VerifyOtp from './pages/VerifyOtp.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Checkout from './pages/Checkout.jsx'
import Sports from './pages/Sports.jsx'
import SportsLeague from './pages/SportsLeague.jsx'
import Concerts from './pages/Concerts.jsx'
import Arts from './pages/Arts.jsx'
import Family from './pages/Family.jsx'
import Cities from './pages/Cities.jsx'
import CityPage from './pages/CityPage.jsx'
import Search from './pages/Search.jsx'
import MyTickets from './pages/MyTickets.jsx'
import Favorites from './pages/Favorites.jsx'
import AdminOverview from './pages/admin/Overview.jsx'
import AdminEvents from './pages/admin/AdminEvents.jsx'
import AdminUsers from './pages/admin/AdminUsers.jsx'
import AdminOrders from './pages/admin/AdminOrders.jsx'
import AdminPromotions from './pages/admin/AdminPromotions.jsx'

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />

          <Route path="/sports" element={<Sports />} />
          <Route path="/sports/:league" element={<SportsLeague />} />
          <Route path="/concerts" element={<Concerts />} />
          <Route path="/arts" element={<Arts />} />
          <Route path="/family" element={<Family />} />

          <Route path="/cities" element={<Cities />} />
          <Route path="/city/:name" element={<CityPage />} />
          <Route path="/search" element={<Search />} />

          <Route
            path="/event/:id"
            element={
              <ErrorBoundary>
                <EventDetails />
              </ErrorBoundary>
            }
          />

          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <Checkout />
                </ErrorBoundary>
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
            path="/favorites"
            element={
              <ProtectedRoute>
                <Favorites />
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
            <Route path="promotions" element={<AdminPromotions />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="orders" element={<AdminOrders />} />
          </Route>
        </Route>
      </Routes>

      {/* Tawk.to live chat — mounted once at the app root, outside the
          Routes so it persists across navigation without re-loading. */}
      <TawkChat />
    </>
  )
}
