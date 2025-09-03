import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function LotteryWidget({ userTickets, totalParticipants, prizePool, onViewDetails }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="gift" size={20} color="#f59e0b" />
          <Text style={styles.title}>Weekly Lottery</Text>
        </View>
        <TouchableOpacity onPress={onViewDetails}>
          <Text style={styles.viewDetailsText}>View Details</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.prizeSection}>
          <Text style={styles.prizePool}>{prizePool} BET</Text>
          <Text style={styles.prizeLabel}>Prize Pool</Text>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{userTickets}</Text>
            <Text style={styles.statLabel}>Your Tickets</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalParticipants}</Text>
            <Text style={styles.statLabel}>Participants</Text>
          </View>
        </View>

        <View style={styles.countdown}>
          <Ionicons name="time" size={16} color="#6b7280" />
          <Text style={styles.countdownText}>Draw in 3 days</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginLeft: 8,
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  content: {
    alignItems: 'center',
  },
  prizeSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  prizePool: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  prizeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 4,
  },
});
