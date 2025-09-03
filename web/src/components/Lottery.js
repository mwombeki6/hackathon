import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Lottery({ user }) {
  const [currentRound, setCurrentRound] = useState(null);
  const [userTickets, setUserTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLotteryData();
  }, []);

  const fetchLotteryData = async () => {
    try {
      const [roundResponse, ticketsResponse] = await Promise.all([
        axios.get('/lottery/current'),
        axios.get('/lottery/tickets')
      ]);
      setCurrentRound(roundResponse.data);
      setUserTickets(ticketsResponse.data);
    } catch (error) {
      console.error('Failed to fetch lottery data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading lottery...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Lottery System</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Current Round</h2>
          {currentRound ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Round:</span>
                <span className="font-medium">{currentRound.round_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">End Date:</span>
                <span className="font-medium">
                  {new Date(currentRound.end_date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Perk:</span>
                <span className="font-medium">{currentRound.perk_description}</span>
              </div>
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  🎫 Earn tickets by completing tasks and participating in activities!
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No active lottery round</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">My Tickets</h2>
          <div className="space-y-2">
            {userTickets.length > 0 ? (
              userTickets.map((ticket) => (
                <div key={ticket.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-mono text-sm">#{ticket.ticket_number}</span>
                  <span className="text-xs text-gray-500">{ticket.earned_from}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No tickets yet</p>
            )}
          </div>
          <div className="mt-4 text-center">
            <span className="text-2xl font-bold text-blue-600">{userTickets.length}</span>
            <p className="text-sm text-gray-600">Total Tickets</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Lottery;
