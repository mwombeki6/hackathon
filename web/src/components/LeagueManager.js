import React, { useState, useEffect } from 'react';
import axios from 'axios';

function LeagueManager({ user }) {
  const [leagues, setLeagues] = useState([]);
  const [userLeagues, setUserLeagues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeagues();
  }, []);

  const fetchLeagues = async () => {
    try {
      const [leaguesResponse, userLeaguesResponse] = await Promise.all([
        axios.get('/leagues'),
        axios.get('/leagues/user')
      ]);
      setLeagues(leaguesResponse.data);
      setUserLeagues(userLeaguesResponse.data);
    } catch (error) {
      console.error('Failed to fetch leagues:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading leagues...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">League Management</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Available Leagues</h2>
          <div className="space-y-3">
            {leagues.map((league) => (
              <div key={league.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900">{league.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{league.description}</p>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm text-gray-500">Tier {league.tier}</span>
                  <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">
                    Join League
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">My Leagues</h2>
          <div className="space-y-3">
            {userLeagues.map((league) => (
              <div key={league.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900">{league.name}</h3>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm text-gray-500">Points: {league.total_points}</span>
                  <span className="text-sm text-gray-500">Rank: #{league.rank}</span>
                </div>
              </div>
            ))}
            {userLeagues.length === 0 && (
              <p className="text-gray-500 text-center py-4">You haven't joined any leagues yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeagueManager;
