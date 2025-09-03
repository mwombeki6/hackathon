import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Dashboard({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    totalTokens: 0,
    currentStreak: 0
  });
  const [streakData, setStreakData] = useState({
    activity: '',
    description: '',
    file: null
  });
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kanban'); // kanban, list
  const [showStreakModal, setShowStreakModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [statsResponse, tasksResponse] = await Promise.all([
        axios.get('/api/users/stats', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/api/tasks', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setStats(statsResponse.data);
      setTasks(tasksResponse.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/tasks/${taskId}`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      fetchDashboardData(); // Refresh data
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const submitStreak = async () => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('activity', streakData.activity);
      formData.append('description', streakData.description);
      if (streakData.file) {
        formData.append('file', streakData.file);
      }

      await axios.post('/api/users/streak', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setShowStreakModal(false);
      setStreakData({ activity: '', description: '', file: null });
      alert('Daily streak submitted successfully! +10 BET tokens earned!');
      // Refresh user data to show updated streak and tokens
      fetchDashboardData();
    } catch (error) {
      console.error('Error submitting streak:', error);
      alert(error.response?.data?.error || 'Failed to submit streak');
    }
  };

  const getTasksByStatus = (status) => {
    return tasks.filter(task => task.status === status);
  };

  const KanbanColumn = ({ title, status, tasks, bgColor }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 min-h-96">
      <div className={`${bgColor} text-white px-3 py-2 rounded-lg mb-4 text-center font-medium`}>
        {title} ({tasks.length})
      </div>
      <div className="space-y-3">
        {tasks.map(task => (
          <div key={task.id} className="bg-gray-50 rounded-lg p-3 border-l-4 border-blue-400 hover:shadow-md transition-shadow cursor-pointer">
            <h4 className="font-medium text-gray-900 text-sm">{task.title}</h4>
            <p className="text-xs text-gray-600 mt-1">{task.description}</p>
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                +{task.reward_tokens} BET
              </span>
              <select 
                value={task.status}
                onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
              <p className="text-lg text-gray-600 leading-relaxed">
                Welcome back, {user.fullName}! Here's your productivity overview.
              </p>
            </div>
          </div>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-full">
              <span className="text-2xl">📋</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTasks}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-full">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completedTasks}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-yellow-500">
          <div className="flex items-center">
            <div className="bg-yellow-100 p-3 rounded-full">
              <span className="text-2xl">🪙</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">BET Tokens</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTokens}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-full">
              <span className="text-2xl">🔥</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Current Streak</p>
              <p className="text-2xl font-bold text-gray-900">{stats.currentStreak} days</p>
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Task Management</h2>
        <div className="bg-white rounded-lg p-1 shadow-sm">
          <button 
            onClick={() => setView('kanban')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'kanban' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 Kanban View
          </button>
          <button 
            onClick={() => setView('list')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'list' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📝 List View
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <KanbanColumn 
            title="To Do" 
            status="pending" 
            tasks={getTasksByStatus('pending')}
            bgColor="bg-gray-500"
          />
          <KanbanColumn 
            title="In Progress" 
            status="in_progress" 
            tasks={getTasksByStatus('in_progress')}
            bgColor="bg-blue-500"
          />
          <KanbanColumn 
            title="Completed" 
            status="completed" 
            tasks={getTasksByStatus('completed')}
            bgColor="bg-green-500"
          />
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">All Tasks</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {tasks.map(task => (
              <div key={task.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                      +{task.reward_tokens} BET
                    </span>
                    <select 
                      value={task.status}
                      onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                      className="text-sm border border-gray-300 rounded-md px-3 py-1"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Streak Button */}
      <div className="flex justify-center mb-8">
        <button
          onClick={() => setShowStreakModal(true)}
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center space-x-3"
        >
          <span className="text-2xl">🔥</span>
          <span>Log Daily Activity (+10 BET)</span>
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="text-center">
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📝</span>
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Create Task</h4>
            <p className="text-sm text-gray-500 mb-4">Add new tasks to boost engagement</p>
            <button 
              onClick={() => navigate('/tasks')}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              New Task
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="text-center">
            <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🏆</span>
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Leaderboard</h4>
            <p className="text-sm text-gray-500 mb-4">See your ranking among peers</p>
            <button 
              onClick={() => navigate('/leaderboard')}
              className="w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
            >
              View Rankings
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="text-center">
            <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚔️</span>
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Competitions</h4>
            <p className="text-sm text-gray-500 mb-4">Join leagues and head-to-head</p>
            <button 
              onClick={() => navigate('/leagues')}
              className="w-full bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
            >
              Compete Now
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="text-center">
            <div className="bg-pink-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🗳️</span>
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Vote & Polls</h4>
            <p className="text-sm text-gray-500 mb-4">Participate in company voting</p>
            <button 
              onClick={() => navigate('/voting')}
              className="w-full bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors"
            >
              Vote Now
            </button>
          </div>
        </div>
      </div>

      {/* Daily Streak Modal */}
      {showStreakModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">🔥 Log Your Daily Activity</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Activity Type</label>
                <select
                  value={streakData.activity}
                  onChange={(e) => setStreakData({...streakData, activity: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select activity type...</option>
                  <option value="task_completion">Task Completion</option>
                  <option value="learning">Learning & Development</option>
                  <option value="collaboration">Team Collaboration</option>
                  <option value="innovation">Innovation & Ideas</option>
                  <option value="wellness">Wellness Activity</option>
                  <option value="mentoring">Mentoring & Support</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={streakData.description}
                  onChange={(e) => setStreakData({...streakData, description: e.target.value})}
                  placeholder="Describe your activity in detail..."
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none h-24"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload Evidence (Optional)</label>
                <input
                  type="file"
                  onChange={(e) => setStreakData({...streakData, file: e.target.files[0]})}
                  accept="image/*,.pdf,.doc,.docx"
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Upload screenshots, documents, or photos as evidence</p>
              </div>
            </div>
            <div className="flex space-x-3 mt-4">
              <button
                onClick={() => setShowStreakModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitStreak}
                className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
              >
                Submit Activity
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default Dashboard;
