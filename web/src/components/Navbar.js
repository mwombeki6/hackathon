import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navbar({ user, onLogout }) {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🚀</span>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  BlockEngage
                </h1>
              </div>
            </div>
            <div className="hidden sm:ml-12 sm:flex sm:space-x-8">
              <Link
                to="/"
                className={`${
                  isActive('/') ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                } inline-flex items-center space-x-2 px-4 py-2 border-b-2 text-sm font-medium rounded-t-lg transition-all`}
              >
                <span>🏠</span>
                <span>Dashboard</span>
              </Link>
              <Link
                to="/tasks"
                className={`${
                  isActive('/tasks') ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                } inline-flex items-center space-x-2 px-4 py-2 border-b-2 text-sm font-medium rounded-t-lg transition-all`}
              >
                <span>📋</span>
                <span>Tasks</span>
              </Link>
              <Link
                to="/leagues"
                className={`${
                  isActive('/leagues') ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                } inline-flex items-center space-x-2 px-4 py-2 border-b-2 text-sm font-medium rounded-t-lg transition-all`}
              >
                <span>🏆</span>
                <span>Leagues</span>
              </Link>
              <Link
                to="/challenges"
                className={`${
                  isActive('/challenges') ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                } inline-flex items-center space-x-2 px-4 py-2 border-b-2 text-sm font-medium rounded-t-lg transition-all`}
              >
                <span>⚔️</span>
                <span>Challenges</span>
              </Link>
              <Link
                to="/voting"
                className={`${
                  isActive('/voting') ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                } inline-flex items-center space-x-2 px-4 py-2 border-b-2 text-sm font-medium rounded-t-lg transition-all`}
              >
                <span>🗳️</span>
                <span>Voting</span>
              </Link>
              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  className={`${
                    isActive('/admin') ? 'border-purple-500 text-purple-600 bg-purple-50' : 'border-transparent text-gray-600 hover:text-purple-700 hover:bg-purple-50'
                  } inline-flex items-center space-x-2 px-4 py-2 border-b-2 text-sm font-medium rounded-t-lg transition-all`}
                >
                  <span>⚙️</span>
                  <span>Admin</span>
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <Link to="/voting" className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors px-3 py-2 rounded-lg hover:bg-blue-50">
              <span className="text-lg">🗳️</span>
              <span className="font-medium">Voting</span>
            </Link>
            <Link to="/leaderboard" className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors px-3 py-2 rounded-lg hover:bg-blue-50">
              <span className="text-lg">🏆</span>
              <span className="font-medium">Leaderboard</span>
            </Link>
            <div className="flex items-center space-x-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-full px-5 py-2 border border-gray-200">
              <span className="text-sm text-gray-700 font-medium">👋 {user.fullName}</span>
              <span className="text-xs bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-3 py-1 rounded-full font-bold shadow-sm">
                {user.totalTokens || 0} BET
              </span>
            </div>
            <button
              onClick={onLogout}
              className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-lg"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
