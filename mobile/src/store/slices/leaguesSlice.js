import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService';

export const fetchLeagues = createAsyncThunk(
  'leagues/fetchLeagues',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.getLeagues();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch leagues');
    }
  }
);

export const fetchLeaderboard = createAsyncThunk(
  'leagues/fetchLeaderboard',
  async (leagueId, { rejectWithValue }) => {
    try {
      const response = await apiService.getLeaderboard(leagueId);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch leaderboard');
    }
  }
);

export const joinLeague = createAsyncThunk(
  'leagues/joinLeague',
  async (leagueId, { rejectWithValue }) => {
    try {
      const response = await apiService.joinLeague(leagueId);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to join league');
    }
  }
);

const leaguesSlice = createSlice({
  name: 'leagues',
  initialState: {
    leagues: [],
    leaderboard: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLeagues.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLeagues.fulfilled, (state, action) => {
        state.loading = false;
        state.leagues = action.payload;
      })
      .addCase(fetchLeagues.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchLeaderboard.fulfilled, (state, action) => {
        state.leaderboard = action.payload;
      })
      .addCase(joinLeague.fulfilled, (state, action) => {
        const index = state.leagues.findIndex(league => league.id === action.payload.id);
        if (index !== -1) {
          state.leagues[index] = action.payload;
        }
      });
  },
});

export const { clearError } = leaguesSlice.actions;
export default leaguesSlice.reducer;
