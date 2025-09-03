import React, { useState, useEffect } from 'react';
import axios from 'axios';

function HeadToHeadChallenge({ user }) {
  const [challenges, setChallenges] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChallenge, setNewChallenge] = useState({
    challengedId: '',
    wager: '',
    description: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [challengesResponse, usersResponse] = await Promise.all([
        axios.get('/api/challenges', { headers: { Authorization: `Bearer ${token}` }}),
        axios.get('/api/challenges/users', { headers: { Authorization: `Bearer ${token}` }})
      ]);

      setChallenges(challengesResponse.data);
      setUsers(usersResponse.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const createChallenge = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/challenges', newChallenge, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowCreateModal(false);
      setNewChallenge({
        challengedId: '',
        wager: '',
        description: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error creating challenge:', error);
    }
  };

  const acceptChallenge = async (challengeId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/challenges/${challengeId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (error) {
      console.error('Error accepting challenge:', error);
    }
  };

  const declineChallenge = async (challengeId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/challenges/${challengeId}/decline`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (error) {
      console.error('Error declining challenge:', error);
    }
  };

  const getChallengeIcon = (type) => {
    switch (type) {
      case 'task_completion': return '✅';
      case 'streak_battle': return '🔥';
      case 'token_race': return '🪙';
      case 'engagement_boost': return '⚡';
      default: return '⚔️';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading challenges...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-10">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Head-to-Head Challenges</h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              Challenge your colleagues and compete for tokens!
            </p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all font-medium"
          >
            🎯 Create Challenge
          </button>
        </div>

      {/* Challenge Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-full">
              <span className="text-2xl">⚔️</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Challenges</p>
              <p className="text-2xl font-bold text-gray-900">
                {challenges.filter(c => c.status === 'active').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-full">
              <span className="text-2xl">🏆</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Wins</p>
              <p className="text-2xl font-bold text-gray-900">
                {challenges.filter(c => c.status === 'completed' && c.winner_id === user.id).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-yellow-500">
          <div className="flex items-center">
            <div className="bg-yellow-100 p-3 rounded-full">
              <span className="text-2xl">⏳</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {challenges.filter(c => c.status === 'pending' && c.opponent_id === user.id).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-full">
              <span className="text-2xl">🪙</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Tokens at Stake</p>
              <p className="text-2xl font-bold text-gray-900">
                {challenges.filter(c => c.status === 'active').reduce((sum, c) => sum + c.wager, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Challenges List */}
      <div className="space-y-6">
        {challenges.map(challenge => (
          <div key={challenge.id} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <span className="text-3xl">{getChallengeIcon(challenge.challenge_type)}</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {challenge.challenger_name} vs {challenge.opponent_name}
                  </h3>
                  <p className="text-gray-600 capitalize">
                    {challenge.challenge_type.replace('_', ' ')} Challenge
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(challenge.status)}`}>
                {challenge.status}
              </span>
            </div>

            <p className="text-gray-700 mb-4">{challenge.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm text-gray-600">Duration</div>
                <div className="font-medium">{challenge.duration} days</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm text-gray-600">Wager</div>
                <div className="font-medium">{challenge.wager} BET tokens</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm text-gray-600">Ends</div>
                <div className="font-medium">
                  {challenge.end_date ? new Date(challenge.end_date).toLocaleDateString() : 'TBD'}
                </div>
              </div>
            </div>

            {challenge.status === 'active' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{challenge.challenger_name}</span>
                    <span className="text-2xl font-bold text-blue-600">{challenge.challenger_score}</span>
                  </div>
                  <div className="text-sm text-gray-600">Current Score</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{challenge.opponent_name}</span>
                    <span className="text-2xl font-bold text-red-600">{challenge.opponent_score}</span>
                  </div>
                  <div className="text-sm text-gray-600">Current Score</div>
                </div>
              </div>
            )}

            {challenge.status === 'completed' && challenge.winner_id && (
              <div className="bg-green-50 rounded-lg p-4 mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🏆</span>
                  <span className="font-medium text-green-800">
                    Winner: {challenge.winner_id === challenge.challenger_id ? challenge.challenger_name : challenge.opponent_name}
                  </span>
                </div>
                <div className="text-sm text-green-600 mt-1">
                  Final Score: {challenge.challenger_score} - {challenge.opponent_score}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {challenge.status === 'pending' && challenge.opponent_id === user.id && (
              <div className="flex space-x-3">
                <button
                  onClick={() => acceptChallenge(challenge.id)}
                  className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                >
                  ✅ Accept Challenge
                </button>
                <button
                  onClick={() => declineChallenge(challenge.id)}
                  className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                >
                  ❌ Decline
                </button>
              </div>
            )}

            {challenge.status === 'pending' && challenge.challenger_id === user.id && (
              <div className="text-center text-gray-500 py-2">
                Waiting for {challenge.opponent_name} to respond...
              </div>
            )}
          </div>
        ))}

        {challenges.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">⚔️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Challenges Yet</h3>
            <p className="text-gray-500 mb-6">Create your first challenge to compete with colleagues!</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-red-500 text-white px-6 py-3 rounded-xl hover:bg-red-600 transition-colors font-medium"
            >
              Create Challenge
            </button>
          </div>
        )}
      </div>

      {/* Create Challenge Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">⚔️ Create New Challenge</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Opponent</label>
                <select
                  value={newChallenge.challengedId}
                  onChange={(e) => setNewChallenge({ ...newChallenge, challengedId: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                >
                  <option value="">Select opponent...</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.department}) - {user.total_tokens} tokens
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Token Wager</label>
                <select
                  value={newChallenge.wager}
                  onChange={(e) => setNewChallenge({ ...newChallenge, wager: parseInt(e.target.value) })}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                >
                  <option value={25}>25 BET</option>
                  <option value={50}>50 BET</option>
                  <option value={100}>100 BET</option>
                  <option value={200}>200 BET</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={newChallenge.description}
                  onChange={(e) => setNewChallenge({ ...newChallenge, description: e.target.value })}
                  placeholder="Add a motivational message or challenge details..."
                  className="w-full p-3 border border-gray-300 rounded-lg h-24 resize-none"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createChallenge}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Send Challenge
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default HeadToHeadChallenge;
