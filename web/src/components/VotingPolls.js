import React, { useState, useEffect } from 'react';
import axios from 'axios';

function VotingPolls({ user }) {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [newPoll, setNewPoll] = useState({
    title: '',
    description: '',
    type: 'employee_of_month',
    options: ['']
  });

  useEffect(() => {
    fetchPolls();
  }, []);

  const fetchPolls = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/voting/polls', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPolls(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching polls:', error);
      setLoading(false);
    }
  };

  const createPoll = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/voting/polls', newPoll, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowCreatePoll(false);
      setNewPoll({ title: '', description: '', type: 'employee_of_month', options: [''] });
      fetchPolls();
    } catch (error) {
      console.error('Error creating poll:', error);
    }
  };

  const vote = async (pollId, optionId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/voting/polls/${pollId}/vote`, 
        { optionId },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      fetchPolls(); // Refresh to show updated votes
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const addOption = () => {
    setNewPoll({
      ...newPoll,
      options: [...newPoll.options, '']
    });
  };

  const updateOption = (index, value) => {
    const updatedOptions = [...newPoll.options];
    updatedOptions[index] = value;
    setNewPoll({ ...newPoll, options: updatedOptions });
  };

  const removeOption = (index) => {
    if (newPoll.options.length > 1) {
      const updatedOptions = newPoll.options.filter((_, i) => i !== index);
      setNewPoll({ ...newPoll, options: updatedOptions });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading polls...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🗳️ Voting & Polls</h1>
            <p className="text-gray-600 mt-1">Participate in company-wide voting and recognition</p>
          </div>
          {(user.role === 'admin' || user.role === 'project_lead') && (
            <button 
              onClick={() => setShowCreatePoll(true)}
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all font-medium"
            >
              ➕ Create Poll
            </button>
          )}
        </div>
      </div>

      {/* Active Polls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {polls.map(poll => (
          <div key={poll.id} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  poll.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                }`}></div>
                <span className={`text-sm font-medium ${
                  poll.type === 'employee_of_month' ? 'text-yellow-600' : 'text-blue-600'
                }`}>
                  {poll.type === 'employee_of_month' ? '🏆 Employee of the Month' : '📊 General Poll'}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                Ends: {new Date(poll.end_date).toLocaleDateString()}
              </span>
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-2">{poll.title}</h3>
            <p className="text-gray-600 mb-4">{poll.description}</p>

            <div className="space-y-3">
              {poll.options.map(option => {
                const percentage = poll.total_votes > 0 ? (option.votes / poll.total_votes * 100) : 0;
                const hasVoted = option.user_voted;
                
                return (
                  <div key={option.id} className="relative">
                    <button
                      onClick={() => !hasVoted && poll.status === 'active' && vote(poll.id, option.id)}
                      disabled={hasVoted || poll.status !== 'active'}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        hasVoted 
                          ? 'border-green-500 bg-green-50' 
                          : poll.status === 'active'
                            ? 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                            : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">{option.option_text}</span>
                        <div className="flex items-center space-x-2">
                          {hasVoted && <span className="text-green-600 text-sm">✓ Voted</span>}
                          <span className="text-sm text-gray-600">{option.votes} votes</span>
                        </div>
                      </div>
                      {poll.total_votes > 0 && (
                        <div className="mt-2">
                          <div className="bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}%</span>
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Total votes: {poll.total_votes}</span>
                <span>Created by: {poll.creator_name}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {polls.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="text-6xl mb-4">🗳️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Polls</h3>
          <p className="text-gray-500">Check back later for new voting opportunities!</p>
        </div>
      )}

      {/* Create Poll Modal */}
      {showCreatePoll && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Create New Poll</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Poll Type</label>
                <select
                  value={newPoll.type}
                  onChange={(e) => setNewPoll({ ...newPoll, type: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                >
                  <option value="employee_of_month">🏆 Employee of the Month</option>
                  <option value="general">📊 General Poll</option>
                  <option value="feedback">💬 Feedback Poll</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={newPoll.title}
                  onChange={(e) => setNewPoll({ ...newPoll, title: e.target.value })}
                  placeholder="e.g., Employee of the Month - December 2024"
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={newPoll.description}
                  onChange={(e) => setNewPoll({ ...newPoll, description: e.target.value })}
                  placeholder="Describe what this poll is about..."
                  className="w-full p-3 border border-gray-300 rounded-lg h-24 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                {newPoll.options.map((option, index) => (
                  <div key={index} className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 p-3 border border-gray-300 rounded-lg"
                    />
                    {newPoll.options.length > 1 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addOption}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + Add Option
                </button>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowCreatePoll(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createPoll}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Create Poll
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VotingPolls;
