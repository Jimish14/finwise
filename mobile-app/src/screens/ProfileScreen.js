import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, TextInput, RefreshControl } from 'react-native';
import Slider from '@react-native-community/slider';
import { AuthContext } from '../context/AuthContext';
import { fetchFinancialProfile, updateFinancialProfile } from '../api/exports';

const ProfileScreen = () => {
  const { user, logout } = useContext(AuthContext);
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Advanced Form Data
  const [formData, setFormData] = useState({
    monthly_income: '',
    income_type: 'fixed',
    fixed_expenses: '',
    emergency_fund_balance: '',
    total_savings: '',
    investment_balance: '',
    financial_dependents: '0',
    risk_profile: 'medium',
    saving_preference_ratio: 20
  });

  const incomeTypes = ['fixed', 'variable', 'freelance'];
  const riskProfiles = ['low', 'medium', 'high'];

  const loadProfile = async () => {
    try {
      const res = await fetchFinancialProfile();
      const data = res.data?.data || res.data || {};
      setProfile(data);
    } catch (error) {
      console.log("No existing profile found or error:", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); loadProfile(); }, []);

  const openEditModal = () => {
    setFormData({
      monthly_income: String(profile?.monthly_income || ''),
      income_type: profile?.income_type || 'fixed',
      fixed_expenses: String(profile?.fixed_expenses || ''),
      emergency_fund_balance: String(profile?.emergency_fund_balance || ''),
      total_savings: String(profile?.total_savings || ''),
      investment_balance: String(profile?.investment_balance || ''),
      financial_dependents: String(profile?.financial_dependents || '0'),
      risk_profile: profile?.risk_profile || 'medium',
      saving_preference_ratio: profile?.saving_preference_ratio || 20
    });
    setModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!formData.monthly_income) {
      return Alert.alert("Error", "Monthly income is required to calculate AI plans.");
    }

    setSubmitting(true);
    try {
      const payload = {
        monthly_income: Number(formData.monthly_income),
        income_type: formData.income_type,
        fixed_expenses: Number(formData.fixed_expenses || 0),
        emergency_fund_balance: Number(formData.emergency_fund_balance || 0),
        total_savings: Number(formData.total_savings || 0),
        investment_balance: Number(formData.investment_balance || 0),
        financial_dependents: Number(formData.financial_dependents || 0),
        risk_profile: formData.risk_profile,
        saving_preference_ratio: Number(formData.saving_preference_ratio)
      };

      await updateFinancialProfile(payload);
      setModalVisible(false);
      Alert.alert("Success", "Financial profile updated successfully!");
      loadProfile(); // Refresh UI instantly
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to update profile.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !refreshing) return <View style={styles.center}><ActivityIndicator size="large" color="#1d4ed8" /></View>;

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1d4ed8"]} />}
      >
        <Text style={styles.headerTitle}>Profile & Settings</Text>
        
        {/* User Identity Card */}
        <View style={styles.identityCard}>
          <View style={styles.avatarCircle}>
             <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.name || 'FinWise User'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'No email provided'}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={openEditModal}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Financial Details Card (Read-Only) */}
        <View style={styles.sectionHeader}>
           <Text style={styles.sectionTitle}>Financial Summary</Text>
        </View>
        
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>Monthly Income</Text>
            <Text style={styles.rowValue}>₹{Number(profile?.monthly_income || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.divider} />
          
          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>Fixed Expenses</Text>
            <Text style={[styles.rowValue, { color: '#ef4444' }]}>₹{Number(profile?.fixed_expenses || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>Total Savings</Text>
            <Text style={[styles.rowValue, { color: '#10b981' }]}>₹{Number(profile?.total_savings || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>Emergency Fund</Text>
            <Text style={styles.rowValue}>₹{Number(profile?.emergency_fund_balance || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>Investments</Text>
            <Text style={styles.rowValue}>₹{Number(profile?.investment_balance || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>Risk Profile</Text>
            <Text style={styles.rowValueText}>{profile?.risk_profile || 'Not Set'}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>Target Savings Rate</Text>
            <Text style={[styles.rowValueText, { color: '#1d4ed8' }]}>{profile?.saving_preference_ratio || 20}%</Text>
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Your Financial Profile gives the AI the context it needs to calculate your Goal Feasibility and recommend spending cuts accurately.
          </Text>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
           <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* --- EDIT PROFILE MODAL --- */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Financial Profile</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              
              <View style={styles.inputRow}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Monthly Income (₹)</Text>
                  <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={formData.monthly_income} onChangeText={(t) => setFormData({...formData, monthly_income: t})} />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Fixed Expenses (₹)</Text>
                  <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={formData.fixed_expenses} onChangeText={(t) => setFormData({...formData, fixed_expenses: t})} />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Total Savings (₹)</Text>
                  <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={formData.total_savings} onChangeText={(t) => setFormData({...formData, total_savings: t})} />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Emergency Fund (₹)</Text>
                  <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={formData.emergency_fund_balance} onChangeText={(t) => setFormData({...formData, emergency_fund_balance: t})} />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Investments (₹)</Text>
                  <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={formData.investment_balance} onChangeText={(t) => setFormData({...formData, investment_balance: t})} />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Dependents</Text>
                  <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={formData.financial_dependents} onChangeText={(t) => setFormData({...formData, financial_dependents: t})} />
                </View>
              </View>
              
              <Text style={styles.inputLabel}>Income Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 16}}>
                {incomeTypes.map(type => (
                  <TouchableOpacity key={type} style={[styles.chip, formData.income_type === type && styles.chipActive]} onPress={() => setFormData({...formData, income_type: type})}>
                    <Text style={[styles.chipText, formData.income_type === type && styles.chipTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Risk Profile</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 24}}>
                {riskProfiles.map(rp => (
                  <TouchableOpacity key={rp} style={[styles.chip, formData.risk_profile === rp && styles.chipActive]} onPress={() => setFormData({...formData, risk_profile: rp})}>
                    <Text style={[styles.chipText, formData.risk_profile === rp && styles.chipTextActive]}>{rp}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Slider for Target Savings Rate */}
              <Text style={styles.inputLabel}>Target Savings Rate: <Text style={{color: '#1d4ed8'}}>{formData.saving_preference_ratio}%</Text></Text>
              <Slider
                style={{ width: '100%', height: 40, marginTop: 4, marginBottom: 20 }}
                minimumValue={5}
                maximumValue={50}
                step={1}
                value={formData.saving_preference_ratio}
                onValueChange={(val) => setFormData({...formData, saving_preference_ratio: val})}
                minimumTrackTintColor="#1d4ed8" 
                maximumTrackTintColor="#d1d5db" 
                thumbTintColor="#1d4ed8" 
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={submitting}>
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
  container: { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 20, paddingTop: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 20 },
  
  identityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 20, borderRadius: 16, elevation: 2, marginBottom: 24 },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { fontSize: 24, fontWeight: 'bold', color: '#1d4ed8' },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  userEmail: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  editBtn: { backgroundColor: '#eff6ff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe' },
  editBtnText: { color: '#1d4ed8', fontWeight: 'bold' },

  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', textTransform: 'uppercase' },
  
  card: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, elevation: 2, marginBottom: 24 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rowLabel: { fontSize: 15, color: '#4b5563', fontWeight: '500' },
  rowValue: { fontSize: 16, color: '#111827', fontWeight: 'bold' },
  rowValueText: { fontSize: 15, color: '#111827', fontWeight: 'bold', textTransform: 'capitalize' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 12 },

  infoBox: { backgroundColor: '#eff6ff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', marginBottom: 32 },
  infoText: { color: '#1e3a8a', fontSize: 14, lineHeight: 20 },

  logoutBtn: { backgroundColor: '#fee2e2', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' },
  logoutText: { color: '#b91c1c', fontWeight: 'bold', fontSize: 16 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#111827' },
  
  inputRow: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { flex: 1, marginHorizontal: 4 },
  
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 16, color: '#111827' },
  
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

export default ProfileScreen;