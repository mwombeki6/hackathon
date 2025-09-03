import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function QuickStats({ completedTasks, activeTasks, overdueTasks, activeLeagues }) {
  const stats = [
    {
      label: 'Completed',
      value: completedTasks,
      icon: 'checkmark-circle',
      color: '#10b981',
    },
    {
      label: 'Active',
      value: activeTasks,
      icon: 'time',
      color: '#f59e0b',
    },
    {
      label: 'Overdue',
      value: overdueTasks,
      icon: 'alert-circle',
      color: '#ef4444',
    },
    {
      label: 'Leagues',
      value: activeLeagues,
      icon: 'trophy',
      color: '#6366f1',
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Stats</Text>
      <View style={styles.statsGrid}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.statCard}>
            <Ionicons name={stat.icon} size={24} color={stat.color} />
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
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
});
