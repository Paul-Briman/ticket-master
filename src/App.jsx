import { Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.jsx'
import Home from './pages/Home.jsx'
import EventDetails from './pages/EventDetails.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Checkout from './pages/Checkout.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import Sports from './pages/Sports.jsx'
import Concerts from './pages/Concerts.jsx'
import Arts from './pages/Arts.jsx'
import Family from './pages/Family.jsx'
import Cities from './pages/Cities.jsx'
import CityPage from './pages/CityPage.jsx'

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
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>
    </Routes>
  )
}
