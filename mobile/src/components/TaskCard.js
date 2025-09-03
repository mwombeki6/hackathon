import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';

import { updateTaskStatus } from '../store/slices/tasksSlice';

export default function TaskCard({ task }) {
  const dispatch = useDispatch();

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in_progress': return '#f59e0b';
      case 'pending': return '#6b7280';
      case 'overdue': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getNextStatus = (currentStatus) => {
    switch (currentStatus) {
      case 'pending': return 'in_progress';
      case 'in_progress': return 'completed';
      default: return null;
    }
  };

  const getStatusAction = (status) => {
    switch (status) {
      case 'pending': return 'Start Task';
      case 'in_progress': return 'Complete Task';
      default: return null;
    }
  };

  const handleStatusUpdate = async () => {
    const nextStatus = getNextStatus(task.status);
    if (!nextStatus) return;

    try {
      await dispatch(updateTaskStatus({ 
        taskId: task.id, 
        status: nextStatus 
      })).unwrap();
    } catch (error) {
      Alert.alert('Error', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const isOverdue = () => {
    return new Date(task.dueDate) < new Date() && task.status !== 'completed';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.badges}>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) }]}>
            <Text style={styles.badgeText}>{task.priority.toUpperCase()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) }]}>
            <Text style={styles.badgeText}>{task.status.replace('_', ' ').toUpperCase()}</Text>
          </View>
          {isOverdue() && (
            <View style={[styles.statusBadge, { backgroundColor: '#ef4444' }]}>
              <Text style={styles.badgeText}>OVERDUE</Text>
            </View>
          )}
        </View>
        <Text style={styles.tokenReward}>+{task.tokenReward} BET</Text>
      </View>

      <Text style={styles.title}>{task.title}</Text>
      <Text style={styles.description}>{task.description}</Text>

      <View style={styles.details}>
        {task.assigneeName && (
          <View style={styles.detailItem}>
            <Ionicons name="person" size={16} color="#6b7280" />
            <Text style={styles.detailText}>Assigned to {task.assigneeName}</Text>
          </View>
        )}
        <View style={styles.detailItem}>
          <Ionicons name="calendar" size={16} color="#6b7280" />
          <Text style={styles.detailText}>Due {formatDate(task.dueDate)}</Text>
        </View>
      </View>

      {getStatusAction(task.status) && (
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: getStatusColor(getNextStatus(task.status)) }]}
          onPress={handleStatusUpdate}
        >
          <Text style={styles.actionButtonText}>{getStatusAction(task.status)}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
    marginBottom: 12,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  tokenReward: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  details: {
    gap: 8,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
  },
  actionButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
