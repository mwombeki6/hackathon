import React, { useState, useEffect } from 'react';
import axios from 'axios';

function LeagueSystem({ user }) {
  const [activeTab, setActiveTab] = useState('leagues');
  const [leagues, setLeagues] = useState([]);
  const [userLeague, setUserLeague] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState(null);

  useEffect(() => {
    fetchLeagueData();
  }, []);

  const fetchLeagueData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [leaguesResponse, userLeagueResponse, leaderboardResponse] = await Promise.all([
        axios.get('/api/leagues', { headers: { Authorization: `Bearer ${token}` }}),
        axios.get('/api/leagues/my-league', { headers: { Authorization: `Bearer ${token}` }}),
        axios.get('/api/leagues/leaderboard', { headers: { Authorization: `Bearer ${token}` }})
      ]);

      setLeagues(leaguesResponse.data);
      setUserLeague(userLeagueResponse.data);
      setLeaderboard(leaderboardResponse.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching league data:', error);
      setLoading(false);
    }
  };

  const joinLeague = async (leagueId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`/api/leagues/${leagueId}/join`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Successfully joined league!');
      fetchLeagues();
    } catch (error) {
      console.error('Error joining league:', error);
      alert(error.response?.data?.error || 'Failed to join league');
    }
  };

  const createLeague = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/leagues', {
        name: `${user.fullName}'s League`,
        description: 'A competitive engagement league',
        type: 'department'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchLeagueData();
    } catch (error) {
      console.error('Error creating league:', error);
    }
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getLeagueIcon = (type) => {
    switch (type) {
      case 'company': return '🏢';
      case 'department': return '👥';
      case 'team': return '⚡';
      default: return '🏆';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading leagues...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🏆 League System</h1>
            <p className="text-gray-600 mt-1">Compete in fantasy-style engagement leagues</p>
          </div>
          <div className="flex space-x-3">
            {!userLeague && (
              <button 
                onClick={() => setShowJoinModal(true)}
                className="bg-blue-500 text-white px-6 py-3 rounded-xl hover:bg-blue-600 transition-colors font-medium"
              >
                🎯 Join League
              </button>
            )}
            {(user.role === 'admin' || user.role === 'project_lead') && (
              <button 
                onClick={createLeague}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all font-medium"
              >
                ➕ Create League
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('leagues')}
            className={`px-6 py-4 text-sm font-medium ${
              activeTab === 'leagues' 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🏆 Available Leagues
          </button>
          <button
            onClick={() => setActiveTab('my-league')}
            className={`px-6 py-4 text-sm font-medium ${
              activeTab === 'my-league' 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            👥 My League
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-6 py-4 text-sm font-medium ${
              activeTab === 'leaderboard' 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 Global Leaderboard
          </button>
        </div>
      </div>

      {/* Available Leagues Tab */}
      {activeTab === 'leagues' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leagues.map(league => (
            <div key={league.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getLeagueIcon(league.type)}</span>
                  <div>
                    <h3 className="font-bold text-gray-900">{league.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{league.type} League</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  league.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {league.status}
                </span>
              </div>
              
              <p className="text-gray-600 text-sm mb-4">{league.description}</p>
              
              <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                <span>👥 {league.member_count} members</span>
                <span>🏆 Season {league.current_season}</span>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span>Prize Pool:</span>
                  <span className="font-medium text-yellow-600">{league.prize_pool} BET</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Entry Fee:</span>
                  <span className="font-medium">{league.entry_fee} BET</span>
                </div>
              </div>
              
              <button
                onClick={() => {
                  setSelectedLeague(league);
                  setShowJoinModal(true);
                }}
                disabled={userLeague}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                  userLeague 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {userLeague ? 'Already in League' : 'Join League'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* My League Tab */}
      {activeTab === 'my-league' && (
        <div>
          {userLeague ? (
            <div className="space-y-6">
              {/* League Info */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <span className="text-3xl">{getLeagueIcon(userLeague.type)}</span>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{userLeague.name}</h2>
                      <p className="text-gray-600">Season {userLeague.current_season} • {userLeague.member_count} members</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">#{userLeague.user_rank}</div>
                    <div className="text-sm text-gray-500">Your Rank</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{userLeague.user_points}</div>
                    <div className="text-sm text-gray-600">Your Points</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{userLeague.tasks_completed}</div>
                    <div className="text-sm text-gray-600">Tasks Completed</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{userLeague.streak_days}</div>
                    <div className="text-sm text-gray-600">Streak Days</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">{userLeague.tokens_earned}</div>
                    <div className="text-sm text-gray-600">Tokens Earned</div>
                  </div>
                </div>
              </div>

              {/* League Members */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">League Standings</h3>
                <div className="space-y-3">
                  {userLeague.members && userLeague.members.map((member, index) => (
                    <div key={member.id} className={`flex items-center justify-between p-3 rounded-lg ${
                      member.id === user.id ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{getRankBadge(index + 1)}</span>
                        <div>
                          <div className="font-medium text-gray-900">
                            {member.full_name} {member.id === user.id && '(You)'}
                          </div>
                          <div className="text-sm text-gray-500">{member.department}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">{member.points} pts</div>
                        <div className="text-sm text-gray-500">{member.tasks_completed} tasks</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="text-6xl mb-4">🏆</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Not in a League</h3>
              <p className="text-gray-500 mb-6">Join a league to compete with your colleagues!</p>
              <button
                onClick={() => setShowJoinModal(true)}
                className="bg-blue-500 text-white px-6 py-3 rounded-xl hover:bg-blue-600 transition-colors font-medium"
              >
                Browse Leagues
              </button>
            </div>
          )}
        </div>
      )}

      {/* Global Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">🌟 Global Leaderboard</h3>
          <div className="space-y-3">
            {leaderboard.map((user, index) => (
              <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <span className="text-xl font-bold">{getRankBadge(index + 1)}</span>
                  <div>
                    <div className="font-medium text-gray-900">{user.full_name}</div>
                    <div className="text-sm text-gray-500">{user.department} • {user.league_name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{user.total_points} pts</div>
                  <div className="text-sm text-gray-500">{user.total_tokens} BET</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Join League Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            {selectedLeague ? (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Join {selectedLeague.name}</h3>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span>Entry Fee:</span>
                    <span className="font-medium">{selectedLeague.entry_fee} BET</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Prize Pool:</span>
                    <span className="font-medium text-yellow-600">{selectedLeague.prize_pool} BET</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Members:</span>
                    <span>{selectedLeague.member_count}</span>
                  </div>
                </div>
                <p className="text-gray-600 text-sm mb-6">{selectedLeague.description}</p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowJoinModal(false);
                      setSelectedLeague(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => joinLeague(selectedLeague.id)}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Join League
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Choose a League</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {leagues.map(league => (
                    <button
                      key={league.id}
                      onClick={() => setSelectedLeague(league)}
                      className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-xl">{getLeagueIcon(league.type)}</span>
                        <div>
                          <div className="font-medium text-gray-900">{league.name}</div>
                          <div className="text-sm text-gray-500">{league.member_count} members • {league.entry_fee} BET</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LeagueSystem;
