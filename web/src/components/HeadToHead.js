import React, { useState, useEffect } from 'react';
import axios from 'axios';

function HeadToHead({ user }) {
  const [matches, setMatches] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newChallenge, setNewChallenge] = useState({
    opponent: '',
    stakeAmount: 5,
    duration: 7
  });

  useEffect(() => {
    fetchMatches();
    fetchUsers();
  }, []);

  const fetchMatches = async () => {
    try {
      const response = await axios.get('/h2h');
      setMatches(response.data);
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/users');
      setUsers(response.data.filter(u => u.id !== user.id));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/h2h/challenge', newChallenge);
      setNewChallenge({ opponent: '', stakeAmount: 5, duration: 7 });
      setShowCreateForm(false);
      fetchMatches();
    } catch (error) {
      console.error('Failed to create challenge:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Head-to-Head Challenges</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md font-medium"
        >
          Create Challenge
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Create New Challenge</h2>
          <form onSubmit={handleCreateChallenge} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opponent</label>
              <select
                value={newChallenge.opponent}
                onChange={(e) => setNewChallenge({ ...newChallenge, opponent: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select opponent...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.username})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stake Amount (BET)</label>
                <input
                  type="number"
                  min="5"
                  value={newChallenge.stakeAmount}
                  onChange={(e) => setNewChallenge({ ...newChallenge, stakeAmount: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={newChallenge.duration}
                  onChange={(e) => setNewChallenge({ ...newChallenge, duration: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Create Challenge
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Active Challenges</h2>
        </div>
        <div className="p-6">
          {matches.length > 0 ? (
            <div className="space-y-4">
              {matches.map((match) => (
                <div key={match.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {match.challenger_name} vs {match.opponent_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Stake: {match.stake_tokens} BET • Status: {match.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        Score: {match.challenger_score} - {match.opponent_score}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No active challenges</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default HeadToHead;
