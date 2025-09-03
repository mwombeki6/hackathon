import React, { useState, useEffect } from 'react';
import axios from 'axios';

function GlobalLeaderboard({ user }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overall');

  useEffect(() => {
    fetchLeaderboard();
  }, [activeTab]);

  const fetchLeaderboard = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/users/leaderboard?type=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeaderboard(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLoading(false);
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getProgressColor = (rank) => {
    if (rank <= 3) return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
    if (rank <= 10) return 'bg-gradient-to-r from-blue-400 to-blue-600';
    return 'bg-gradient-to-r from-gray-400 to-gray-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="mb-10">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Global Leaderboard</h1>
            <p className="text-lg text-gray-600 leading-relaxed">See how you rank against your colleagues!</p>
          </div>
        </div>
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overall', label: 'Overall', icon: '🏆' },
                { id: 'tokens', label: 'Tokens', icon: '🪙' },
                { id: 'streaks', label: 'Streaks', icon: '🔥' },
                { id: 'tasks', label: 'Tasks', icon: '✅' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
        </div>

        {/* Leaderboard Content */}
        <div className="p-6">
          {leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
              <p className="text-gray-500">Start engaging to see rankings!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leaderboard.map((member, index) => {
                const rank = index + 1;
                const isCurrentUser = member.id === user?.id;
                
                return (
                  <div
                    key={member.id}
                    className={`flex items-center space-x-4 p-4 rounded-lg transition-all ${
                      isCurrentUser 
                        ? 'bg-blue-50 border-2 border-blue-200 shadow-md' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                      {rank <= 3 ? (
                        <span className="text-2xl">{getRankIcon(rank)}</span>
                      ) : (
                        <div className={`w-8 h-8 rounded-full ${getProgressColor(rank)} flex items-center justify-center text-white text-sm font-bold`}>
                          {rank}
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className={`text-sm font-medium truncate ${
                          isCurrentUser ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {member.full_name}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              You
                            </span>
                          )}
                        </h4>
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {member.department} • {member.role}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center space-x-6">
                      {activeTab === 'overall' && (
                        <>
                          <div className="text-center">
                            <div className="text-lg font-bold text-gray-900">{member.total_tokens}</div>
                            <div className="text-xs text-gray-500">Tokens</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-gray-900">{member.current_streak}</div>
                            <div className="text-xs text-gray-500">Streak</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-gray-900">{member.completed_tasks || 0}</div>
                            <div className="text-xs text-gray-500">Tasks</div>
                          </div>
                        </>
                      )}
                      
                      {activeTab === 'tokens' && (
                        <div className="text-center">
                          <div className="text-xl font-bold text-yellow-600">{member.total_tokens}</div>
                          <div className="text-xs text-gray-500">BET Tokens</div>
                        </div>
                      )}
                      
                      {activeTab === 'streaks' && (
                        <div className="text-center">
                          <div className="text-xl font-bold text-orange-600">{member.current_streak}</div>
                          <div className="text-xs text-gray-500">Day Streak</div>
                        </div>
                      )}
                      
                      {activeTab === 'tasks' && (
                        <div className="text-center">
                          <div className="text-xl font-bold text-green-600">{member.completed_tasks || 0}</div>
                          <div className="text-xs text-gray-500">Completed</div>
                        </div>
                      )}
                    </div>

                    {/* Trend Indicator */}
                    <div className="flex-shrink-0">
                      {rank <= 5 && (
                        <div className="text-green-500">
                          <span className="text-lg">📈</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Achievement Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center space-x-3 mb-4">
            <span className="text-2xl">🏅</span>
            <h3 className="text-lg font-medium text-gray-900">Top Performer</h3>
          </div>
          {leaderboard.length > 0 && (
            <div>
              <p className="text-2xl font-bold text-blue-600">{leaderboard[0]?.full_name}</p>
              <p className="text-sm text-gray-500">{leaderboard[0]?.total_tokens} tokens earned</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center space-x-3 mb-4">
            <span className="text-2xl">🔥</span>
            <h3 className="text-lg font-medium text-gray-900">Streak Master</h3>
          </div>
          {leaderboard.length > 0 && (
            <div>
              <p className="text-2xl font-bold text-orange-600">
                {Math.max(...leaderboard.map(m => m.current_streak))} days
              </p>
              <p className="text-sm text-gray-500">Longest current streak</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center space-x-3 mb-4">
            <span className="text-2xl">👥</span>
            <h3 className="text-lg font-medium text-gray-900">Active Users</h3>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{leaderboard.length}</p>
            <p className="text-sm text-gray-500">Engaged this month</p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default GlobalLeaderboard;
