import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import axios from 'axios';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import TaskManager from './components/TaskManager';
import LeagueSystem from './components/LeagueSystem';
import HeadToHeadChallenge from './components/HeadToHeadChallenge';
import VotingPolls from './components/VotingPolls';
import Navbar from './components/Navbar';
import AdminDashboard from './components/AdminDashboard';
import GlobalLeaderboard from './components/GlobalLeaderboard';

// Set base URL for axios
axios.defaults.baseURL = 'http://localhost:3000';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Set default authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Verify token and get user info
      axios.get('/api/auth/profile')
        .then(response => {
          setUser(response.data);
          setLoading(false);
        })
        .catch(error => {
          console.error('Token verification failed:', error);
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-xl text-gray-600">Loading BlockEngage...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {user ? (
          <>
            <Navbar user={user} onLogout={handleLogout} />
            <Routes>
              <Route path="/" element={<Dashboard user={user} />} />
              <Route path="/tasks" element={<TaskManager user={user} />} />
              <Route path="/leagues" element={<LeagueSystem user={user} />} />
              <Route path="/challenges" element={<HeadToHeadChallenge user={user} />} />
              <Route path="/voting" element={<VotingPolls user={user} />} />
              <Route path="/leaderboard" element={<GlobalLeaderboard user={user} />} />
              {user.role === 'admin' && (
                <Route path="/admin" element={<AdminDashboard user={user} />} />
              )}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </>
        ) : (
          <Routes>
            <Route path="*" element={<Login onLogin={handleLogin} />} />
          </Routes>
        )}
      </div>
    </Router>
  );
}

export default App;
