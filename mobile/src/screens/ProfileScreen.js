import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { logout, fetchProfile } from '../store/slices/authSlice';
import { fetchDashboard } from '../store/slices/userSlice';
import BadgeCollection from '../components/BadgeCollection';
import H2HChallenges from '../components/H2HChallenges';

export default function ProfileScreen() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { dashboard } = useSelector((state) => state.user);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      await Promise.all([
        dispatch(fetchProfile()).unwrap(),
        dispatch(fetchDashboard()).unwrap(),
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile data');
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

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => dispatch(logout())
        },
      ]
    );
  };

  const stats = [
    { label: 'Total Tasks', value: dashboard?.totalTasks || 0, icon: 'clipboard' },
    { label: 'Tokens Earned', value: dashboard?.totalTokensEarned || 0, icon: 'wallet' },
    { label: 'Current Streak', value: dashboard?.currentStreak || 0, icon: 'flame' },
    { label: 'Leagues Joined', value: dashboard?.activeLeagues || 0, icon: 'trophy' },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Profile Header */}
      <LinearGradient
        colors={['#6366f1', '#8b5cf6']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.fullName}>{user?.fullName || 'User'}</Text>
          <Text style={styles.username}>@{user?.username || 'username'}</Text>
          <Text style={styles.department}>{user?.department || 'General'}</Text>
        </View>
      </LinearGradient>

      {/* Stats Grid */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Your Stats</Text>
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <View key={index} style={styles.statCard}>
              <Ionicons name={stat.icon} size={24} color="#6366f1" />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Badge Collection */}
      <BadgeCollection badges={dashboard?.badges || []} />

      {/* H2H Challenges */}
      <H2HChallenges challenges={dashboard?.activeChallenges || []} />

      {/* Wallet Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wallet Information</Text>
        <View style={styles.walletInfo}>
          <View style={styles.walletItem}>
            <Ionicons name="wallet" size={20} color="#6366f1" />
            <View style={styles.walletDetails}>
              <Text style={styles.walletLabel}>Wallet Address</Text>
              <Text style={styles.walletAddress}>
                {user?.walletAddress 
                  ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
                  : 'Not connected'
                }
              </Text>
            </View>
          </View>
          <View style={styles.walletItem}>
            <Ionicons name="shield-checkmark" size={20} color="#10b981" />
            <View style={styles.walletDetails}>
              <Text style={styles.walletLabel}>Status</Text>
              <Text style={styles.walletStatus}>Verified</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="notifications" size={20} color="#6b7280" />
          <Text style={styles.settingText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={16} color="#6b7280" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="lock-closed" size={20} color="#6b7280" />
          <Text style={styles.settingText}>Privacy</Text>
          <Ionicons name="chevron-forward" size={16} color="#6b7280" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="help-circle" size={20} color="#6b7280" />
          <Text style={styles.settingText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={16} color="#6b7280" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.settingItem, styles.logoutItem]} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#ef4444" />
          <Text style={[styles.settingText, styles.logoutText]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  fullName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  department: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statsSection: {
    margin: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    margin: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  walletInfo: {
    gap: 16,
  },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletDetails: {
    marginLeft: 12,
    flex: 1,
  },
  walletLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  walletAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 2,
  },
  walletStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    marginTop: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingText: {
    fontSize: 16,
    color: '#1f2937',
    marginLeft: 12,
    flex: 1,
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  logoutText: {
    color: '#ef4444',
  },
});
