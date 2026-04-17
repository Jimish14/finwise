import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Modal, TextInput, ScrollView, Alert, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker'; // 🚨 CALENDAR IMPORT 🚨
import { fetchGoals, addGoal } from '../api/exports';

const GoalsScreen = ({ navigation }) => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false); // Controls calendar popup
  
  const [newGoal, setNewGoal] = useState({
    goal_name: '',
    current_price: '',
    expected_inflation_rate: '6', // Default 6% inflation
    goal_category: 'vehicle',
    priority_level: 'medium',
    goal_target_date: new Date().toISOString().split('T')[0] // Defaults to today
  });

  const categories = ['vehicle', 'gadget', 'travel', 'investment', 'education', 'other'];
  const priorities = ['low', 'medium', 'high'];

  const loadGoals = async () => {
    try {
      const response = await fetchGoals();
      const goalsList = response.data?.data || response.data || [];
      if (Array.isArray(goalsList)) setGoals(goalsList);
    } catch (error) {
      console.error("Error loading goals:", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadGoals(); }, []));
  const onRefresh = useCallback(() => { setRefreshing(true); loadGoals(); }, []);

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios'); // iOS keeps it open, Android auto-closes
    if (selectedDate) {
      setNewGoal({ ...newGoal, goal_target_date: selectedDate.toISOString().split('T')[0] });
    }
  };

  const handleAddGoal = async () => {
    if (!newGoal.goal_name || !newGoal.current_price || !newGoal.goal_target_date) {
      return Alert.alert("Error", "Please fill out the Name, Price, and Target Date.");
    }

    setSubmitting(true);
    try {
      // Format data to match your Mongoose Schema exactly
      const payload = {
        ...newGoal,
        current_price: Number(newGoal.current_price),
        expected_inflation_rate: Number(newGoal.expected_inflation_rate),
        goal_start_date: new Date().toISOString(), 
        goal_target_date: new Date(newGoal.goal_target_date).toISOString(), 
        current_amount: 0 
      };

      await addGoal(payload);
      setModalVisible(false);
      // Reset form
      setNewGoal({ 
        goal_name: '', current_price: '', expected_inflation_rate: '6', 
        goal_category: 'vehicle', priority_level: 'medium', 
        goal_target_date: new Date().toISOString().split('T')[0] 
      });
      loadGoals(); // Refresh list
    } catch (error) {
      Alert.alert("Error", error.message || "Could not add goal.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderGoal = ({ item }) => {
    const goalName = item.goal_name || item.name || 'Financial Goal';
    const target = Number(item.current_price || item.target_amount || 1); 
    const current = Number(item.current_amount || item.saved_amount || 0);
    const progressPercent = Math.min(Math.max((current / target) * 100, 0), 100);

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => navigation.navigate('GoalDetails', { goal: item })}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>{goalName}</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>{progressPercent.toFixed(0)}%</Text></View>
        </View>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.amountText}>Saved: ₹{current.toLocaleString()}</Text>
          <Text style={styles.targetText}>Target: ₹{target.toLocaleString()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) return <View style={styles.center}><ActivityIndicator size="large" color="#1d4ed8" /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Financial Goals</Text>
      <Text style={styles.subTitle}>Tap on any goal to view detailed insights.</Text>
      
      <FlatList
        data={goals}
        keyExtractor={(item) => item._id || item.id || Math.random().toString()}
        renderItem={renderGoal}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1d4ed8"]} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No goals set yet. Tap the + button to create one!</Text>}
      />

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* --- ADD GOAL MODAL --- */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Goal</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              
              <Text style={styles.inputLabel}>Goal Name</Text>
              <TextInput style={styles.input} placeholder="e.g., Buy a Bike" value={newGoal.goal_name} onChangeText={(t) => setNewGoal({...newGoal, goal_name: t})} />
              
              <Text style={styles.inputLabel}>Target Amount (₹)</Text>
              <TextInput style={styles.input} placeholder="165000" keyboardType="numeric" value={newGoal.current_price} onChangeText={(t) => setNewGoal({...newGoal, current_price: t})} />
              
              <Text style={styles.inputLabel}>Expected Inflation Rate (%)</Text>
              <TextInput style={styles.input} placeholder="e.g., 6" keyboardType="numeric" value={newGoal.expected_inflation_rate} onChangeText={(t) => setNewGoal({...newGoal, expected_inflation_rate: t})} />
              
              <Text style={styles.inputLabel}>Target Date</Text>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.datePickerText}>{newGoal.goal_target_date}</Text>
                <Text style={styles.datePickerIcon}>📅</Text>
              </TouchableOpacity>

              {/* NATIVE CALENDAR POPUP */}
              {showDatePicker && (
                <DateTimePicker
                  value={new Date(newGoal.goal_target_date)}
                  mode="date"
                  display="default"
                  minimumDate={new Date()} // Prevents picking dates in the past
                  onChange={handleDateChange}
                />
              )}

              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 16}}>
                {categories.map(cat => (
                  <TouchableOpacity key={cat} style={[styles.chip, newGoal.goal_category === cat && styles.chipActive]} onPress={() => setNewGoal({...newGoal, goal_category: cat})}>
                    <Text style={[styles.chipText, newGoal.goal_category === cat && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Priority Level</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 24}}>
                {priorities.map(pri => (
                  <TouchableOpacity key={pri} style={[styles.chip, newGoal.priority_level === pri && styles.chipActive]} onPress={() => setNewGoal({...newGoal, priority_level: pri})}>
                    <Text style={[styles.chipText, newGoal.priority_level === pri && styles.chipTextActive]}>{pri}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleAddGoal} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#fff"/> : <Text style={styles.saveText}>Create Goal</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 20, paddingTop: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  subTitle: { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  card: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, marginBottom: 16, elevation: 3 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#111827', flex: 1, marginRight: 10, textTransform: 'capitalize' },
  badge: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 14, fontWeight: 'bold', color: '#1d4ed8' },
  progressContainer: { height: 10, backgroundColor: '#f3f4f6', borderRadius: 5, overflow: 'hidden', marginBottom: 16 },
  progressBar: { height: '100%', backgroundColor: '#1d4ed8', borderRadius: 5 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  amountText: { fontSize: 14, color: '#10b981', fontWeight: '600' },
  targetText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 40 },

  // FAB & Modal
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#1d4ed8', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabText: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#111827' },
  
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 16, color: '#111827' },
  
  datePickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 14, marginBottom: 16 },
  datePickerText: { fontSize: 16, color: '#111827' },
  datePickerIcon: { fontSize: 18 },

  chip: { backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  chipText: { color: '#4b5563', fontWeight: '500', textTransform: 'capitalize' },
  chipTextActive: { color: '#ffffff', fontWeight: 'bold' },
  
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { flex: 1, padding: 16, alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 8, marginRight: 8 },
  cancelText: { color: '#4b5563', fontWeight: 'bold', fontSize: 16 },
  saveBtn: { flex: 1, padding: 16, alignItems: 'center', backgroundColor: '#1d4ed8', borderRadius: 8, marginLeft: 8 },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default GoalsScreen;