import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { fetchDashboard } from '../store/slices/userSlice';
import TokenBalance from '../components/TokenBalance';
import StreakCard from '../components/StreakCard';
import QuickStats from '../components/QuickStats';
import LotteryWidget from '../components/LotteryWidget';

export default function DashboardScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { dashboard, loading } = useSelector((state) => state.user);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      await dispatch(fetchDashboard()).unwrap();
    } catch (error) {
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={['#6366f1', '#8b5cf6']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{user?.fullName || 'User'}</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Dashboard Content */}
      <View style={styles.content}>
        <TokenBalance 
          balance={dashboard?.tokenBalance || 0}
          totalEarned={dashboard?.totalTokensEarned || 0}
        />

        <StreakCard 
          currentStreak={dashboard?.currentStreak || 0}
          longestStreak={dashboard?.longestStreak || 0}
        />

        <QuickStats 
          completedTasks={dashboard?.completedTasks || 0}
          activeTasks={dashboard?.activeTasks || 0}
          overdueTasks={dashboard?.overdueTasks || 0}
          activeLeagues={dashboard?.activeLeagues || 0}
        />

        <LotteryWidget 
          userTickets={dashboard?.lotteryTickets || 0}
          totalParticipants={dashboard?.lotteryParticipants || 0}
          prizePool={dashboard?.lotteryPrizePool || 0}
          onViewDetails={() => navigation.navigate('Lottery')}
        />

        {/* Active Challenges */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Challenges</Text>
            <TouchableOpacity onPress={() => navigation.navigate('H2H')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {dashboard?.activeChallenges?.length > 0 ? (
            dashboard.activeChallenges.slice(0, 3).map((challenge) => (
              <View key={challenge.id} style={styles.challengeCard}>
                <View style={styles.challengeInfo}>
                  <Text style={styles.challengeTitle}>{challenge.description}</Text>
                  <Text style={styles.challengeOpponent}>vs {challenge.opponentName}</Text>
                </View>
                <View style={styles.challengeScore}>
                  <Text style={styles.scoreText}>
                    {challenge.userScore} - {challenge.opponentScore}
                  </Text>
                  <Text style={styles.stakeText}>{challenge.tokenStake} BET</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={32} color="#d1d5db" />
              <Text style={styles.emptyText}>No active challenges</Text>
            </View>
          )}
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {dashboard?.recentActivity?.length > 0 ? (
            dashboard.recentActivity.slice(0, 5).map((activity, index) => (
              <View key={index} style={styles.activityItem}>
                <Ionicons 
                  name={getActivityIcon(activity.type)} 
                  size={20} 
                  color="#6366f1" 
                />
                <View style={styles.activityContent}>
                  <Text style={styles.activityText}>{activity.description}</Text>
                  <Text style={styles.activityTime}>
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                {activity.tokenReward > 0 && (
                  <Text style={styles.rewardText}>+{activity.tokenReward} BET</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No recent activity</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const getActivityIcon = (type) => {
  switch (type) {
    case 'task_completed': return 'checkmark-circle';
    case 'streak_milestone': return 'flame';
    case 'league_joined': return 'trophy';
    case 'challenge_won': return 'medal';
    case 'lottery_won': return 'gift';
    default: return 'information-circle';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 4,
  },
  notificationButton: {
    padding: 8,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  viewAllText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  challengeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 8,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  challengeOpponent: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  challengeScore: {
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  stakeText: {
    fontSize: 12,
    color: '#6366f1',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  activityContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityText: {
    fontSize: 14,
    color: '#1f2937',
  },
  activityTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#10b981',
  },
});
