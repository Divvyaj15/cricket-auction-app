import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import TournamentDetail from './pages/TournamentDetail';
import AuctionRoom from './pages/AuctionRoom';
import AuctionSummary from './pages/AuctionSummary';
import TeamSquad from './pages/TeamSquad';
import AuctionHistory from './pages/AuctionHistory';
import PrivateRoute from './components/PrivateRoute';

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                    <Route path="/tournament/:id" element={<PrivateRoute><TournamentDetail /></PrivateRoute>} />
                    <Route path="/auction/:tournamentId" element={<PrivateRoute><AuctionRoom /></PrivateRoute>} />
                    <Route path="/team/:teamId/squad" element={<PrivateRoute><TeamSquad /></PrivateRoute>} />
                    <Route path="/tournament/:tournamentId/history" element={<PrivateRoute><AuctionHistory /></PrivateRoute>} />
                    <Route path="/tournament/:tournamentId/summary" element={<PrivateRoute><AuctionSummary /></PrivateRoute>} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
