import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Modal, TextInput, ScrollView, Alert, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { fetchInvestments, addInvestment, updateInvestment, deleteInvestment } from '../api/exports';

const InvestmentsScreen = ({ navigation }) => {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    investment_type: 'Mutual Funds',
    amount_invested: '',
    current_value: '',
    expected_return_rate: '',
    investment_start_date: new Date().toISOString().split('T')[0]
  });

  const investmentTypes = ["SIP", "Stocks", "FD", "Mutual Funds", "Crypto", "PPF", "Other"];

  const loadInvestments = async () => {
    try {
      const response = await fetchInvestments();
      const dataList = response.data?.data || response.data || [];
      if (Array.isArray(dataList)) setInvestments(dataList);
    } catch (error) {
      console.error("Error loading investments:", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadInvestments(); }, []));
  const onRefresh = useCallback(() => { setRefreshing(true); loadInvestments(); }, []);

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFormData({ ...formData, investment_start_date: selectedDate.toISOString().split('T')[0] });
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setSelectedId(null);
    setFormData({
      name: '', amount_invested: '', current_value: '', expected_return_rate: '',
      investment_type: 'Mutual Funds', investment_start_date: new Date().toISOString().split('T')[0]
    });
    setModalVisible(true);
  };

  const openEditModal = (inv) => {
    setIsEditing(true);
    setSelectedId(inv._id);
    setFormData({
      name: inv.name || '',
      investment_type: inv.investment_type || 'Mutual Funds',
      amount_invested: String(inv.amount_invested || ''),
      current_value: String(inv.current_value || inv.amount_invested || ''),
      expected_return_rate: String(inv.expected_return_rate || ''),
      investment_start_date: inv.investment_start_date ? new Date(inv.investment_start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.amount_invested) {
      return Alert.alert("Error", "Name and Amount Invested are required.");
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        amount_invested: Number(formData.amount_invested),
        current_value: Number(formData.current_value || formData.amount_invested),
        expected_return_rate: Number(formData.expected_return_rate || 0),
        investment_start_date: new Date(formData.investment_start_date).toISOString()
      };

      if (isEditing) {
        await updateInvestment(selectedId, payload);
        Alert.alert("Success", "Investment updated!");
      } else {
        await addInvestment(payload);
        Alert.alert("Success", "Investment added!");
      }
      
      setModalVisible(false);
      loadInvestments();
    } catch (error) {
      Alert.alert("Error", error.message || "Could not save investment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete Investment", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await deleteInvestment(selectedId);
            setModalVisible(false);
            loadInvestments();
          } catch (e) { Alert.alert("Error", "Could not delete."); }
      }}
    ]);
  };

  // 🚨 AUTO-CALCULATING PROJECTED RETURNS IN THIS FUNCTION 🚨
  const renderInvestment = ({ item }) => {
    const invested = Number(item.amount_invested || 0);
    let current = Number(item.current_value || invested);
    const expectedRate = Number(item.expected_return_rate || 0);

    // Auto-calculate projected returns if user hasn't manually overridden current value
    if (expectedRate > 0 && current === invested && item.investment_start_date) {
      const startDate = new Date(item.investment_start_date);
      const today = new Date();
      
      // Calculate how many days have passed
      const diffTime = Math.max(0, today - startDate); 
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      const yearsElapsed = diffDays / 365.25;

      // Compound interest formula: A = P(1 + r)^t
      const rateDecimal = expectedRate / 100;
      current = invested * Math.pow((1 + rateDecimal), yearsElapsed);
    }

    const profit = current - invested;
    const profitPercent = invested > 0 ? (profit / invested) * 100 : 0;
    const isPositive = profit >= 0;

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => openEditModal(item)}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.typeText}>{item.investment_type}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isPositive ? '#d1fae5' : '#fee2e2' }]}>
            <Text style={[styles.badgeText, { color: isPositive ? '#059669' : '#dc2626' }]}>
              {isPositive ? '+' : ''}{profitPercent.toFixed(2)}%
            </Text>
          </View>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.footerRow}>
          <View>
             <Text style={styles.label}>Invested</Text>
             <Text style={styles.amountText}>₹{invested.toLocaleString()}</Text>
          </View>
          <View style={{alignItems: 'flex-end'}}>
             <Text style={styles.label}>Current Value</Text>
             {/* Using maximumFractionDigits: 0 prevents messy decimals like ₹10,118.45 */}
             <Text style={[styles.amountText, { color: isPositive ? '#10b981' : '#ef4444' }]}>
               ₹{current.toLocaleString(undefined, {maximumFractionDigits: 0})}
             </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) return <View style={styles.center}><ActivityIndicator size="large" color="#1d4ed8" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
         <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Text style={styles.backBtnText}>← Back</Text></TouchableOpacity>
         <Text style={styles.headerTitle}>Portfolio</Text>
         <View style={{width: 60}} />
      </View>
      
      <FlatList
        data={investments}
        keyExtractor={(item) => item._id}
        renderItem={renderInvestment}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1d4ed8"]} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No investments yet. Tap + to add one!</Text>}
      />

      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* --- ADD/EDIT MODAL --- */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
               <Text style={styles.modalTitle}>{isEditing ? 'Edit Investment' : 'Add Investment'}</Text>
               {isEditing && (
                 <TouchableOpacity onPress={handleDelete} style={styles.deleteIconBtn}>
                    <Text style={styles.deleteIconText}>🗑️ Delete</Text>
                 </TouchableOpacity>
               )}
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              
              <Text style={styles.inputLabel}>Asset Name</Text>
              <TextInput style={styles.input} placeholder="e.g., HDFC Nifty 50" value={formData.name} onChangeText={(t) => setFormData({...formData, name: t})} />
              
              <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                 <View style={{flex: 1, marginRight: 8}}>
                    <Text style={styles.inputLabel}>Amount Invested (₹)</Text>
                    <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={formData.amount_invested} onChangeText={(t) => setFormData({...formData, amount_invested: t})} />
                 </View>
                 <View style={{flex: 1, marginLeft: 8}}>
                    <Text style={styles.inputLabel}>Current Value (₹)</Text>
                    <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={formData.current_value} onChangeText={(t) => setFormData({...formData, current_value: t})} />
                 </View>
              </View>

              <Text style={styles.inputLabel}>Expected Return Rate (%)</Text>
              <TextInput style={styles.input} placeholder="e.g., 12" keyboardType="numeric" value={formData.expected_return_rate} onChangeText={(t) => setFormData({...formData, expected_return_rate: t})} />
              
              <Text style={styles.inputLabel}>Start Date</Text>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.datePickerText}>{formData.investment_start_date}</Text>
                <Text style={styles.datePickerIcon}>📅</Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker value={new Date(formData.investment_start_date)} mode="date" display="default" onChange={handleDateChange} />
              )}

              <Text style={styles.inputLabel}>Investment Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 24}}>
                {investmentTypes.map(type => (
                  <TouchableOpacity key={type} style={[styles.chip, formData.investment_type === type && styles.chipActive]} onPress={() => setFormData({...formData, investment_type: type})}>
                    <Text style={[styles.chipText, formData.investment_type === type && styles.chipTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#fff"/> : <Text style={styles.saveText}>Save</Text>}
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
  container: { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 16, paddingTop: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  screenHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { padding: 8, backgroundColor: '#e5e7eb', borderRadius: 8 },
  backBtnText: { fontWeight: 'bold', color: '#374151' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  
  card: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginBottom: 12, elevation: 2, borderWidth: 1, borderColor: '#f3f4f6' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#111827', textTransform: 'capitalize', marginBottom: 4 },
  typeText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 14, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 12 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  amountText: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 40 },

  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#1d4ed8', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabText: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginTop: -2 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  deleteIconBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  deleteIconText: { color: '#dc2626', fontWeight: 'bold', fontSize: 13 },
  
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 15, color: '#111827' },
  
  datePickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 14, marginBottom: 16 },
  datePickerText: { fontSize: 15, color: '#111827' },
  datePickerIcon: { fontSize: 18 },

  chip: { backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  chipText: { color: '#4b5563', fontWeight: '500' },
  chipTextActive: { color: '#ffffff', fontWeight: 'bold' },
  
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { flex: 1, padding: 14, alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 8, marginRight: 8 },
  cancelText: { color: '#4b5563', fontWeight: 'bold', fontSize: 16 },
  saveBtn: { flex: 1, padding: 14, alignItems: 'center', backgroundColor: '#1d4ed8', borderRadius: 8, marginLeft: 8 },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default InvestmentsScreen;