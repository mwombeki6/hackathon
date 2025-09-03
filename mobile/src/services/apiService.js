import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Get API URL from environment or use localhost for development
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000/api';

class ApiService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(async (config) => {
      const token = await SecureStore.getItemAsync('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Clear invalid token
          await SecureStore.deleteItemAsync('authToken');
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  login(email, password) {
    return this.api.post('/auth/login', { email, password });
  }

  register(userData) {
    return this.api.post('/auth/register', userData);
  }

  getProfile() {
    return this.api.get('/auth/profile');
  }

  // User endpoints
  getDashboard() {
    return this.api.get('/users/dashboard');
  }

  getLeaderboard() {
    return this.api.get('/users/leaderboard');
  }

  getUsers() {
    return this.api.get('/users');
  }

  // Task endpoints
  getTasks(filters = {}) {
    return this.api.get('/tasks', { params: filters });
  }

  createTask(taskData) {
    return this.api.post('/tasks', taskData);
  }

  updateTaskStatus(taskId, status) {
    return this.api.put(`/tasks/${taskId}/status`, { status });
  }

  deleteTask(taskId) {
    return this.api.delete(`/tasks/${taskId}`);
  }

  // League endpoints
  getLeagues() {
    return this.api.get('/leagues');
  }

  joinLeague(leagueId) {
    return this.api.post(`/leagues/${leagueId}/join`);
  }

  leaveLeague(leagueId) {
    return this.api.post(`/leagues/${leagueId}/leave`);
  }

  getLeagueStandings(leagueId) {
    return this.api.get(`/leagues/${leagueId}/standings`);
  }

  // H2H endpoints
  getH2HChallenges() {
    return this.api.get('/h2h');
  }

  createH2HChallenge(challengeData) {
    return this.api.post('/h2h', challengeData);
  }

  acceptH2HChallenge(challengeId) {
    return this.api.post(`/h2h/${challengeId}/accept`);
  }

  // Lottery endpoints
  getCurrentLottery() {
    return this.api.get('/lottery/current');
  }

  buyLotteryTicket() {
    return this.api.post('/lottery/buy-ticket');
  }

  getLotteryHistory() {
    return this.api.get('/lottery/history');
  }

  // Voting endpoints
  getPolls() {
    return this.api.get('/voting/polls');
  }

  createPoll(pollData) {
    return this.api.post('/voting/polls', pollData);
  }

  vote(pollId, optionIndex, tokenStake) {
    return this.api.post(`/voting/polls/${pollId}/vote`, { optionIndex, tokenStake });
  }
}

export default new ApiService();
