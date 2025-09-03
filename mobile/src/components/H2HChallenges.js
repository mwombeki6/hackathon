import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function H2HChallenges({ challenges }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#f59e0b';
      case 'completed': return '#10b981';
      case 'pending': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return 'play';
      case 'completed': return 'checkmark-circle';
      case 'pending': return 'time';
      default: return 'help-circle';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Head-to-Head Challenges</Text>
        <TouchableOpacity>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {challenges.length > 0 ? (
        challenges.slice(0, 3).map((challenge) => (
          <View key={challenge.id} style={styles.challengeCard}>
            <View style={styles.challengeHeader}>
              <View style={styles.challengeInfo}>
                <Text style={styles.challengeTitle}>{challenge.description}</Text>
                <Text style={styles.opponentName}>vs {challenge.opponentName}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(challenge.status) }]}>
                <Ionicons name={getStatusIcon(challenge.status)} size={12} color="white" />
                <Text style={styles.statusText}>{challenge.status.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.scoreSection}>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>You</Text>
                <Text style={styles.scoreValue}>{challenge.userScore}</Text>
              </View>
              <Text style={styles.scoreDivider}>-</Text>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Opponent</Text>
                <Text style={styles.scoreValue}>{challenge.opponentScore}</Text>
              </View>
            </View>

            <View style={styles.challengeFooter}>
              <View style={styles.stakeInfo}>
                <Ionicons name="wallet" size={14} color="#6366f1" />
                <Text style={styles.stakeText}>{challenge.tokenStake} BET at stake</Text>
              </View>
              <Text style={styles.endDate}>
                Ends {new Date(challenge.endDate).toLocaleDateString()}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="fitness-outline" size={32} color="#d1d5db" />
          <Text style={styles.emptyText}>No active challenges</Text>
          <Text style={styles.emptySubtext}>Create a challenge to compete with colleagues</Text>
        </View>
      )}
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
  header: {
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
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  opponentName: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 4,
  },
  scoreSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreItem: {
    alignItems: 'center',
    flex: 1,
  },
  scoreLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 4,
  },
  scoreDivider: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6b7280',
    marginHorizontal: 20,
  },
  challengeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stakeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stakeText: {
    fontSize: 12,
    color: '#6366f1',
    marginLeft: 4,
    fontWeight: '600',
  },
  endDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
});
