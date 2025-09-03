import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService';

export const fetchDashboard = createAsyncThunk(
  'user/fetchDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.getDashboard();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard');
    }
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState: {
    dashboard: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updateTokenBalance: (state, action) => {
      if (state.dashboard) {
        state.dashboard.tokenBalance = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.dashboard = action.payload;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, updateTokenBalance } = userSlice.actions;
export default userSlice.reducer;
