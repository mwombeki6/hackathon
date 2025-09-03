import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function LeaderboardCard({ player, rank }) {
  const getRankColor = (rank) => {
    switch (rank) {
      case 1: return '#ffd700';
      case 2: return '#c0c0c0';
      case 3: return '#cd7f32';
      default: return '#6b7280';
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return 'trophy';
      case 2: return 'medal';
      case 3: return 'medal';
      default: return null;
    }
  };

  const getLevel = (tokens) => {
    if (tokens >= 1000) return { level: 'Expert', color: '#8b5cf6' };
    if (tokens >= 500) return { level: 'Advanced', color: '#6366f1' };
    if (tokens >= 200) return { level: 'Intermediate', color: '#10b981' };
    if (tokens >= 50) return { level: 'Beginner', color: '#f59e0b' };
    return { level: 'Rookie', color: '#ef4444' };
  };

  const levelInfo = getLevel(player.tokens);

  return (
    <View style={styles.container}>
      <View style={styles.rankSection}>
        {getRankIcon(rank) ? (
          <Ionicons name={getRankIcon(rank)} size={24} color={getRankColor(rank)} />
        ) : (
          <View style={styles.rankNumber}>
            <Text style={styles.rankText}>{rank}</Text>
          </View>
        )}
      </View>

      <View style={styles.playerInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.playerName}>{player.fullName}</Text>
          <View style={[styles.levelBadge, { backgroundColor: levelInfo.color }]}>
            <Text style={styles.levelText}>{levelInfo.level}</Text>
          </View>
        </View>
        <Text style={styles.username}>@{player.username}</Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{player.tokens}</Text>
          <Text style={styles.statLabel}>Tokens</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{player.currentStreak}</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{player.completedTasks}</Text>
          <Text style={styles.statLabel}>Tasks</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  rankSection: {
    width: 40,
    alignItems: 'center',
  },
  rankNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  username: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
});
