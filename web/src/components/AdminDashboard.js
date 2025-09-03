import React, { useState, useEffect } from 'react';
import axios from 'axios';

function AdminDashboard({ user }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalTasks: 0,
    completedTasks: 0,
    totalTokensDistributed: 0,
    activeLeagues: 0,
    activePools: 0,
    pendingH2H: 0
  });
  const [users, setUsers] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [blockchainStats, setBlockchainStats] = useState({
    contractsDeployed: 6,
    totalTransactions: 0,
    networkStatus: 'Connected'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [usersResponse, tasksResponse, activitiesResponse] = await Promise.all([
        axios.get('/users'),
        axios.get('/tasks'),
        axios.get('/users/activities')
      ]);

      const allUsers = usersResponse.data;
      const allTasks = tasksResponse.data;
      const activities = activitiesResponse.data || [];

      setUsers(allUsers);
      setRecentActivities(activities.slice(0, 10));

      setStats({
        totalUsers: allUsers.length,
        activeUsers: allUsers.filter(u => u.last_activity_date).length,
        totalTasks: allTasks.length,
        completedTasks: allTasks.filter(t => t.status === 'completed').length,
        totalTokensDistributed: allUsers.reduce((sum, u) => sum + (u.total_tokens || 0), 0),
        activeLeagues: 0, // Will be fetched from leagues endpoint
        activePools: 0, // Will be fetched from voting endpoint
        pendingH2H: 0 // Will be fetched from h2h endpoint
      });

    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserRoleUpdate = async (userId, newRole) => {
    try {
      await axios.patch(`/users/${userId}/role`, { role: newRole });
      fetchAdminData();
    } catch (error) {
      console.error('Failed to update user role:', error);
    }
  };

  const handleUserStatusToggle = async (userId, isActive) => {
    try {
      await axios.patch(`/users/${userId}/status`, { isActive });
      fetchAdminData();
    } catch (error) {
      console.error('Failed to update user status:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading admin dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">System overview and management controls</p>
      </div>

      {/* System Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalTasks}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">BET Tokens</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalTokensDistributed}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completion Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Blockchain Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Blockchain Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
            <span className="text-sm text-gray-600">Network: {blockchainStats.networkStatus}</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
            <span className="text-sm text-gray-600">Contracts: {blockchainStats.contractsDeployed}</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
            <span className="text-sm text-gray-600">Transactions: {blockchainStats.totalTransactions}</span>
          </div>
        </div>
      </div>

      {/* User Management */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Streak</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {u.full_name?.charAt(0) || u.username?.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{u.full_name}</div>
                          <div className="text-sm text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={u.role}
                        onChange={(e) => handleUserRoleUpdate(u.id, e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="team_member">Team Member</option>
                        <option value="project_lead">Project Lead</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {u.total_tokens || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {u.current_streak || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleUserStatusToggle(u.id, !u.is_active)}
                        className={`${u.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent System Activities</h2>
        </div>
        <div className="p-6">
          {recentActivities.length > 0 ? (
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{activity.activity_type}</p>
                    <p className="text-sm text-gray-600">User: {activity.user_name}</p>
                    <p className="text-xs text-gray-500">{activity.created_at}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-green-600">
                      +{activity.points_earned} points
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No recent activities</p>
          )}
        </div>
      </div>

      {/* Blockchain Management */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Blockchain Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 border border-gray-300 rounded-lg">
            <div className="text-sm font-medium text-gray-900 mb-2">Smart Contracts</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>BlockEngageToken</span>
                <span className="text-green-600">✓ Deployed</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>TaskManager</span>
                <span className="text-green-600">✓ Deployed</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>LeagueManager</span>
                <span className="text-green-600">✓ Deployed</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>VotingManager</span>
                <span className="text-green-600">✓ Deployed</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>LotteryManager</span>
                <span className="text-green-600">✓ Deployed</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>HeadToHeadManager</span>
                <span className="text-green-600">✓ Deployed</span>
              </div>
            </div>
          </div>
          
          <div className="p-4 border border-gray-300 rounded-lg">
            <div className="text-sm font-medium text-gray-900 mb-2">Network Info</div>
            <div className="space-y-2 text-xs">
              <div>Network: AlphachainLive</div>
              <div>Chain ID: 1001</div>
              <div>Gas Price: ~2.5 Gwei</div>
              <div>Block Time: ~3s</div>
            </div>
          </div>

          <div className="p-4 border border-gray-300 rounded-lg">
            <div className="text-sm font-medium text-gray-900 mb-2">Token Economics</div>
            <div className="space-y-2 text-xs">
              <div>Total Supply: 1,000,000 BET</div>
              <div>Circulating: {stats.totalTokensDistributed} BET</div>
              <div>Rewards Pool: {1000000 - stats.totalTokensDistributed} BET</div>
              <div>Daily Emission: ~500 BET</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Admin Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left">
            <div className="text-sm font-medium text-gray-900">🔄 Deploy Contracts</div>
            <div className="text-xs text-gray-500">Update blockchain contracts</div>
          </button>
          <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left">
            <div className="text-sm font-medium text-gray-900">💾 Backup Database</div>
            <div className="text-xs text-gray-500">Create system backup</div>
          </button>
          <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left">
            <div className="text-sm font-medium text-gray-900">📊 Generate Reports</div>
            <div className="text-xs text-gray-500">Export engagement data</div>
          </button>
          <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left">
            <div className="text-sm font-medium text-gray-900">⚙️ System Settings</div>
            <div className="text-xs text-gray-500">Configure platform</div>
          </button>
          <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left">
            <div className="text-sm font-medium text-gray-900">🎲 Manage Lottery</div>
            <div className="text-xs text-gray-500">Control lottery rounds</div>
          </button>
          <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left">
            <div className="text-sm font-medium text-gray-900">🗳️ Manage Polls</div>
            <div className="text-xs text-gray-500">Create and manage voting</div>
          </button>
          <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left">
            <div className="text-sm font-medium text-gray-900">🏆 League Control</div>
            <div className="text-xs text-gray-500">Manage league seasons</div>
          </button>
          <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left">
            <div className="text-sm font-medium text-gray-900">💰 Token Management</div>
            <div className="text-xs text-gray-500">Mint/burn tokens</div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
