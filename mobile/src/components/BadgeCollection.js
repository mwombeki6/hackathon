import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function BadgeCollection({ badges }) {
  const defaultBadges = [
    { id: 'task_master', name: 'Task Master', icon: 'clipboard', color: '#6366f1', requirement: '100 tokens' },
    { id: 'streak_warrior', name: 'Streak Warrior', icon: 'flame', color: '#ef4444', requirement: '7 day streak' },
    { id: 'team_player', name: 'Team Player', icon: 'people', color: '#10b981', requirement: '50 recognitions' },
    { id: 'league_champion', name: 'League Champion', icon: 'trophy', color: '#fbbf24', requirement: 'Win a league' },
    { id: 'challenger', name: 'Challenger', icon: 'fitness', color: '#8b5cf6', requirement: 'Win 5 H2H matches' },
    { id: 'lucky_winner', name: 'Lucky Winner', icon: 'gift', color: '#f59e0b', requirement: 'Win lottery' },
  ];

  const isEarned = (badgeId) => {
    return badges.some(badge => badge.id === badgeId || badge === badgeId);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Badge Collection</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.badgeGrid}>
          {defaultBadges.map((badge) => {
            const earned = isEarned(badge.id);
            return (
              <View key={badge.id} style={[styles.badgeCard, !earned && styles.lockedBadge]}>
                <Ionicons
                  name={badge.icon}
                  size={32}
                  color={earned ? badge.color : '#d1d5db'}
                />
                <Text style={[styles.badgeName, !earned && styles.lockedText]}>
                  {badge.name}
                </Text>
                <Text style={[styles.badgeRequirement, !earned && styles.lockedText]}>
                  {badge.requirement}
                </Text>
                {earned && (
                  <View style={styles.earnedIndicator}>
                    <Ionicons name="checkmark" size={12} color="white" />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  badgeGrid: {
    flexDirection: 'row',
  },
  badgeCard: {
    width: 100,
    alignItems: 'center',
    padding: 12,
    marginRight: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    position: 'relative',
  },
  lockedBadge: {
    opacity: 0.5,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginTop: 8,
  },
  badgeRequirement: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  lockedText: {
    color: '#9ca3af',
  },
  earnedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#10b981',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
