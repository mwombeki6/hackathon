import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Voting({ user }) {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPolls();
  }, []);

  const fetchPolls = async () => {
    try {
      const response = await axios.get('/voting/polls');
      setPolls(response.data);
    } catch (error) {
      console.error('Failed to fetch polls:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (pollId, nominee) => {
    try {
      await axios.post(`/voting/polls/${pollId}/vote`, { nominee });
      fetchPolls();
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading polls...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Voting & Polls</h1>
      
      <div className="grid grid-cols-1 gap-6">
        {polls.map((poll) => (
          <div key={poll.id} className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-2">{poll.title}</h2>
            <p className="text-gray-600 mb-4">{poll.description}</p>
            
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">
                Ends: {new Date(poll.end_date).toLocaleDateString()}
              </span>
              <span className="text-sm text-gray-500">
                Cost: {poll.token_cost} BET tokens
              </span>
            </div>

            {poll.is_active && !poll.has_voted ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Vote for:</p>
                {JSON.parse(poll.nominees || '[]').map((nominee, index) => (
                  <button
                    key={index}
                    onClick={() => handleVote(poll.id, nominee)}
                    className="w-full text-left p-3 border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300"
                  >
                    {nominee}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">
                  {poll.has_voted ? 'You have already voted' : 'Poll has ended'}
                </p>
              </div>
            )}
          </div>
        ))}
        
        {polls.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">No active polls</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Voting;
