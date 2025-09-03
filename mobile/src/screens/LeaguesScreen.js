import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';

import { fetchLeagues, fetchLeaderboard, joinLeague } from '../store/slices/leaguesSlice';
import LeagueCard from '../components/LeagueCard';
import LeaderboardCard from '../components/LeaderboardCard';

export default function LeaguesScreen() {
  const dispatch = useDispatch();
  const { leagues, leaderboard, loading } = useSelector((state) => state.leagues);
  const [activeTab, setActiveTab] = useState('leagues');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      await dispatch(fetchLeagues()).unwrap();
      if (activeTab === 'leaderboard') {
        await dispatch(fetchLeaderboard()).unwrap();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load leagues data');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleJoinLeague = async (leagueId) => {
    try {
      await dispatch(joinLeague(leagueId)).unwrap();
      Alert.alert('Success', 'Joined league successfully!');
    } catch (error) {
      Alert.alert('Error', error);
    }
  };

  const tabs = [
    { key: 'leagues', label: 'Available Leagues', icon: 'trophy' },
    { key: 'leaderboard', label: 'Leaderboard', icon: 'podium' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leagues</Text>
      </View>

      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.activeTab,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons 
              name={tab.icon} 
              size={16} 
              color={activeTab === tab.key ? 'white' : '#6b7280'} 
            />
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'leagues' ? (
          leagues.length > 0 ? (
            leagues.map((league) => (
              <LeagueCard
                key={league.id}
                league={league}
                onJoin={() => handleJoinLeague(league.id)}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No leagues available</Text>
              <Text style={styles.emptySubtitle}>Check back later for new leagues</Text>
            </View>
          )
        ) : (
          leaderboard.length > 0 ? (
            leaderboard.map((player, index) => (
              <LeaderboardCard
                key={player.id}
                player={player}
                rank={index + 1}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="podium-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No leaderboard data</Text>
              <Text style={styles.emptySubtitle}>Join a league to see rankings</Text>
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: '#f8fafc',
  },
  activeTab: {
    backgroundColor: '#6366f1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginLeft: 6,
  },
  activeTabText: {
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#9ca3af',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
});
