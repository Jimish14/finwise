import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getGoalPlan, updateGoal, deleteGoal, addTransaction } from '../api/exports'; 

const GoalDetailsScreen = ({ route, navigation }) => {
  // 🚨 PROPER LOCAL STATE 🚨
  const [currentGoal, setCurrentGoal] = useState(route.params.goal);
  
  const [aiPlan, setAiPlan] = useState({});
  const [loadingAi, setLoadingAi] = useState(true);
  const [aiError, setAiError] = useState(null);

  // --- EDIT MODAL STATE ---
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [editData, setEditData] = useState({
    goal_name: currentGoal.goal_name || currentGoal.name || '',
    current_price: String(currentGoal.current_price || currentGoal.target_amount || ''),
    expected_inflation_rate: String(currentGoal.expected_inflation_rate || 0),
    goal_target_date: currentGoal.goal_target_date ? new Date(currentGoal.goal_target_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    goal_category: currentGoal.goal_category || 'vehicle',
    priority_level: currentGoal.priority_level || 'medium'
  });

  const categories = ['vehicle', 'gadget', 'travel', 'investment', 'education', 'other'];
  const priorities = ['low', 'medium', 'high'];

  // --- MANAGE FUNDS STATE ---
  const [fundsModalVisible, setFundsModalVisible] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [fundAction, setFundAction] = useState('add');
  const [processingFunds, setProcessingFunds] = useState(false);

  // 🚨 DYNAMIC AI RE-FETCHER 🚨
  const loadGoalData = useCallback(async () => {
    try {
      setAiError(null);
      setLoadingAi(true);
      
      // Add a tiny delay to ensure database has fully saved the new funds before asking Python to calculate
      await new Promise(resolve => setTimeout(resolve, 500)); 
      
      const res = await getGoalPlan(currentGoal._id); 
      
      let rawData = res.data;
      let actualPlan = {};
      
      if (rawData) {
        if (rawData.user_type && rawData.gap_analysis) {
          actualPlan = rawData; 
        } else if (rawData.data && rawData.data.user_type) {
          actualPlan = rawData.data; 
        } else if (rawData.plan && rawData.plan.user_type) {
          actualPlan = rawData.plan; 
        } else if (rawData.result && rawData.result.user_type) {
          actualPlan = rawData.result;
        }
      }
      
      setAiPlan(actualPlan);
    } catch (error) {
      console.error("AI Plan Error:", error.message);
      setAiError(error.message || "Failed to fetch AI Plan.");
    } finally {
      setLoadingAi(false);
    }
  }, [currentGoal._id]);

  // Initial Load
  useEffect(() => {
    loadGoalData();
  }, [loadGoalData]);

  // --- ACTIONS ---
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEditData({ ...editData, goal_target_date: selectedDate.toISOString().split('T')[0] });
    }
  };

  const handleEditGoal = async () => {
    if (!editData.goal_name || !editData.current_price) {
      return Alert.alert("Error", "Please fill out the Goal Name and Price.");
    }
    
    setUpdating(true); // Locks the UI
    try {
      const updatedFields = {
        ...editData,
        current_price: Number(editData.current_price),
        expected_inflation_rate: Number(editData.expected_inflation_rate),
        goal_target_date: new Date(editData.goal_target_date).toISOString()
      };

      await updateGoal(currentGoal._id, updatedFields);
      
      // Update local state instantly
      setCurrentGoal(prev => ({ ...prev, ...updatedFields }));
      
      // 🚨 FORCE APP TO WAIT FOR NEW AI PLAN BEFORE CLOSING MODAL 🚨
      await loadGoalData(); 

      setEditModalVisible(false);
      Alert.alert("Success", "Goal updated & AI Plan recalculated!");
    } catch (error) { 
      Alert.alert("Update Failed", error.message); 
    } finally { 
      setUpdating(false); 
    }
  };

  const handleManageFunds = async () => {
    if (!fundAmount || isNaN(fundAmount) || Number(fundAmount) <= 0) {
      return Alert.alert("Error", "Enter a valid amount.");
    }
    
    const amountNum = Number(fundAmount);
    const currentSaved = Number(currentGoal.current_amount || 0);
    const targetAmount = Number(currentGoal.current_price || currentGoal.target_amount || 0);

    // 🚨 PERFECTED WITHDRAWAL LOGIC 🚨
    if (fundAction === 'withdraw' && amountNum > currentSaved) {
      return Alert.alert("Invalid", `You only have ₹${currentSaved.toLocaleString()} saved. You cannot withdraw ₹${amountNum.toLocaleString()}.`);
    }

    // 🚨 PERFECTED OVER-FUNDING LOGIC 🚨
    if (fundAction === 'add' && (currentSaved + amountNum) > targetAmount) {
      const remaining = targetAmount - currentSaved;
      return Alert.alert("Limit Exceeded", `You only need ₹${remaining.toLocaleString()} more to complete this goal!`);
    }

    setProcessingFunds(true); // Locks the UI
    const newTotal = fundAction === 'add' ? currentSaved + amountNum : currentSaved - amountNum;

    try {
      // 1. Save to Database
      await updateGoal(currentGoal._id, { current_amount: newTotal });
      
      // 2. Add Transaction Record
      try {
        await addTransaction({
          title: fundAction === 'add' ? `Saved for ${editData.goal_name}` : `Withdrew from ${editData.goal_name}`,
          amount: amountNum,
          type: fundAction === 'add' ? 'expense' : 'income',
          category: 'Investment', 
          date: new Date().toISOString()
        });
      } catch (err) { console.log("Transaction log skipped:", err.message); }

      // 3. Update UI instantly
      setCurrentGoal(prev => ({ ...prev, current_amount: newTotal }));

      // 4. 🚨 FORCE APP TO WAIT FOR NEW AI PLAN BEFORE CLOSING MODAL 🚨
      await loadGoalData();

      setFundsModalVisible(false);
      setFundAmount('');
      Alert.alert("Success", `Funds updated! AI has adjusted your milestones and gap.`);
      
    } catch (error) { 
      Alert.alert("Error", "Could not process funds."); 
    } finally { 
      setProcessingFunds(false); 
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete Goal", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try { await deleteGoal(currentGoal._id); navigation.goBack(); } 
          catch (e) { Alert.alert("Error", e.message); }
      }}
    ]);
  };

  // 🚨 1-TO-1 PERFECT MAPPING FROM TERMINAL JSON 🚨
  const plan = aiPlan || {}; 
  const goalName = plan.goal_name || currentGoal.goal_name || 'Financial Goal';
  const summaryText = plan.summary || '';
  const score = Number(plan.feasibility_score || 0);
  const statusText = plan.feasibility_label || (score >= 50 ? 'Feasible' : 'Not Feasible');

  const currentPrice = Number(plan.future_value?.current_price || currentGoal.current_price || 0);
  const inflationAdjusted = Number(plan.future_value?.future_value || currentPrice);
  const requiredMonthly = Number(plan.gap_analysis?.required_monthly_saving || 0);
  const userSavingCapacity = Number(plan.gap_analysis?.potential_monthly_saving || 0);
  
  // Directly tied to local state so it flashes instantly!
  const currentlySaved = Number(currentGoal.current_amount || 0);

  const profileType = plan.user_type || 'Unknown';
  const mlPrediction = Number(plan.ml_predicted_saving || 0);
  const riskPenalty = plan.risk_penalty_percent ? `-${plan.risk_penalty_percent}%` : '0%';
  const riskFlags = Array.isArray(plan.risk_flags) ? plan.risk_flags : [];

  const feasibleNow = plan.gap_analysis?.is_feasible_now === true;
  const gap = Number(plan.gap_analysis?.gap_from_current || 0);
  const feasibleWithCuts = plan.gap_analysis?.is_feasible_with_cuts === true;
  const targetDate = plan.target_date || 'Unknown Date';
  const monthsAway = Number(plan.months_remaining || 0);

  const spendingCuts = Array.isArray(plan.optimization_suggestions) ? plan.optimization_suggestions : [];
  const alternativePlans = Array.isArray(plan.alternative_plans) ? plan.alternative_plans : [];
  const quarterlyMilestones = Array.isArray(plan.milestones) ? plan.milestones : [];

  const getImpactColor = (impact) => {
    const s = String(impact).toLowerCase();
    if (s === 'high') return '#ef4444';
    if (s === 'medium') return '#f59e0b';
    return '#10b981';
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{goalName}</Text>
          <TouchableOpacity style={styles.editBtnTop} onPress={() => setEditModalVisible(true)}><Text style={styles.editText}>Edit</Text></TouchableOpacity>
        </View>

        {aiError && (
          <View style={{backgroundColor: '#fef2f2', padding: 16, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#fecaca'}}>
            <Text style={{color: '#b91c1c', fontWeight: 'bold', marginBottom: 4}}>Backend Connection Error</Text>
            <Text style={{color: '#ef4444'}}>{aiError}</Text>
          </View>
        )}

        {loadingAi && (
          <View style={styles.aiLoadingBar}>
            <ActivityIndicator size="small" color="#1d4ed8" />
            <Text style={styles.aiLoadingText}>AI is calculating new plan...</Text>
          </View>
        )}

        {summaryText ? <View style={styles.summaryBanner}><Text style={styles.summaryText}>{summaryText}</Text></View> : null}

        {/* SCORE CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitleCenter}>Feasibility Score</Text>
          <View style={styles.scoreCircleContainer}>
            <View style={[styles.scoreCircle, { borderColor: score >= 50 ? '#10b981' : '#ef4444' }]}>
              <Text style={styles.scoreText}>{score.toFixed(1)}</Text>
              <Text style={styles.scoreMax}>/ 100</Text>
            </View>
          </View>
          <Text style={[styles.statusText, { color: score >= 50 ? '#10b981' : '#ef4444', marginBottom: 20 }]}>{statusText}</Text>
          
          <View style={styles.divider} />
          
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10}}>
             <View>
                <Text style={styles.gridLabel}>Currently Saved</Text>
                <Text style={{fontSize: 24, fontWeight: 'bold', color: '#10b981'}}>₹{currentlySaved.toLocaleString()}</Text>
             </View>
             <TouchableOpacity style={styles.manageFundsBtn} onPress={() => setFundsModalVisible(true)}>
                <Text style={styles.manageFundsText}>Manage Funds</Text>
             </TouchableOpacity>
          </View>
        </View>

        {/* METRICS GRID */}
        <View style={styles.card}>
          <View style={styles.gridContainer}>
            <View style={styles.gridBox}><Text style={styles.gridLabel}>Current Price</Text><Text style={styles.gridValue}>₹{currentPrice.toLocaleString()}</Text></View>
            <View style={styles.gridBox}><Text style={styles.gridLabel}>Inflation-adjusted</Text><Text style={styles.gridValue}>₹{inflationAdjusted.toLocaleString(undefined, {maximumFractionDigits: 0})}</Text></View>
            <View style={styles.gridBox}><Text style={styles.gridLabel}>Required/Month</Text><Text style={[styles.gridValue, {color: '#ef4444'}]}>₹{requiredMonthly.toLocaleString(undefined, {maximumFractionDigits: 0})}</Text></View>
            <View style={styles.gridBox}><Text style={styles.gridLabel}>You Can Save/Mo</Text><Text style={[styles.gridValue, {color: '#10b981'}]}>₹{userSavingCapacity.toLocaleString(undefined, {maximumFractionDigits: 0})}</Text></View>
          </View>
        </View>

        {Object.keys(aiPlan).length > 0 && !loadingAi && (
          <>
            {/* USER PROFILE */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>User Profile</Text>
              <View style={styles.rowBetween}><Text style={styles.rowLabel}>Profile</Text><Text style={styles.rowValue}>{profileType}</Text></View>
              <View style={styles.rowBetween}><Text style={styles.rowLabel}>ML Saving Prediction</Text><Text style={styles.rowValue}>₹{mlPrediction.toLocaleString()}/mo</Text></View>
              <View style={styles.rowBetween}><Text style={styles.rowLabel}>Risk Penalty</Text><Text style={[styles.rowValue, {color: '#ef4444'}]}>{riskPenalty}</Text></View>
              {riskFlags.length > 0 && (
                <View style={styles.flagsContainer}>
                  {riskFlags.map((flag, idx) => (<Text key={idx} style={styles.riskFlag}>{String(flag).replace(/_/g, ' ')}</Text>))}
                </View>
              )}
            </View>

            {/* GAP ANALYSIS */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Gap Analysis</Text>
              <View style={styles.rowBetween}><Text style={styles.rowLabel}>Feasible Now?</Text><Text style={[styles.rowValue, {color: feasibleNow ? '#10b981' : '#ef4444'}]}>{feasibleNow ? '✓ Yes' : '✗ No'}</Text></View>
              {!feasibleNow && <View style={styles.rowBetween}><Text style={styles.rowLabel}>Gap</Text><Text style={[styles.rowValue, {color: '#ef4444'}]}>₹{gap.toLocaleString(undefined, {maximumFractionDigits: 0})}/mo</Text></View>}
              <View style={styles.rowBetween}><Text style={styles.rowLabel}>With Spending Cuts?</Text><Text style={[styles.rowValue, {color: feasibleWithCuts ? '#10b981' : '#ef4444'}]}>{feasibleWithCuts ? '✓ Yes' : '✗ No'}</Text></View>
              <View style={styles.divider} />
              <View style={styles.rowBetween}><Text style={styles.rowLabel}>Target Date</Text><Text style={styles.rowValue}>{targetDate}</Text></View>
              <View style={styles.rowBetween}><Text style={styles.rowLabel}>Timeline</Text><Text style={styles.rowValue}>{monthsAway} months away</Text></View>
            </View>

            {/* SPENDING CUTS */}
            {spendingCuts.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>🔍 Spending Cuts to Close Gap</Text>
                {spendingCuts.map((cut, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <View style={styles.listHeaderRow}><View style={styles.numberCircle}><Text style={styles.numberText}>{idx + 1}</Text></View><Text style={styles.listTitle}>{cut.category}</Text></View>
                    <Text style={styles.transitionText}>₹{Number(cut.current_spend || 0).toLocaleString()} → ₹{Number(cut.new_budget || 0).toLocaleString()}</Text>
                    <Text style={styles.descText}>{cut.tip}</Text>
                    <Text style={styles.impactTextHighlight}>Save ₹{Number(cut.monthly_saving || 0).toLocaleString()}/month</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ALTERNATIVE PLANS */}
            {alternativePlans.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>🔄 Alternative Plans</Text>
                {alternativePlans.map((alt, idx) => (
                  <View key={idx} style={styles.altCard}>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}><Text style={[styles.impactDot, {color: getImpactColor(alt.feasibility)}]}>● {String(alt.feasibility || 'medium').toUpperCase()}</Text></View>
                    <Text style={styles.altTitle}>{alt.plan}</Text>
                    <Text style={styles.descText}>{alt.description}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* QUARTERLY MILESTONES */}
            {quarterlyMilestones.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>📅 Quarterly Milestones</Text>
                {quarterlyMilestones.map((ms, idx) => (
                  <View key={idx} style={styles.milestoneCard}>
                    <View style={styles.rowBetween}>
                       <Text style={styles.msTitle}>{ms.milestone}</Text>
                       <Text style={styles.msDate}>{ms.date}</Text>
                    </View>
                    <View style={styles.rowBetween}>
                       <Text style={styles.msPct}>{ms.progress_percent}%</Text>
                       {ms.on_track_check ? <Text style={styles.msStatus}>{ms.on_track_check}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <TouchableOpacity style={styles.finalDeleteBtn} onPress={handleDelete}>
          <Text style={styles.finalDeleteText}>Delete Goal</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* --- EDIT MODAL --- */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Goal</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              
              <Text style={styles.inputLabel}>Goal Name</Text>
              <TextInput style={styles.input} placeholder="e.g., Buy a Bike" value={editData.goal_name} onChangeText={(t) => setEditData({...editData, goal_name: t})} />
              
              <Text style={styles.inputLabel}>Target Amount (₹)</Text>
              <TextInput style={styles.input} placeholder="165000" keyboardType="numeric" value={editData.current_price} onChangeText={(t) => setEditData({...editData, current_price: t})} />
              
              <Text style={styles.inputLabel}>Expected Inflation Rate (%)</Text>
              <TextInput style={styles.input} placeholder="e.g., 6" keyboardType="numeric" value={editData.expected_inflation_rate} onChangeText={(t) => setEditData({...editData, expected_inflation_rate: t})} />
              
              <Text style={styles.inputLabel}>Target Date</Text>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.datePickerText}>{editData.goal_target_date}</Text>
                <Text style={styles.datePickerIcon}>📅</Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={new Date(editData.goal_target_date)}
                  mode="date"
                  display="default"
                  minimumDate={new Date()} 
                  onChange={handleDateChange}
                />
              )}
              
              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 16}}>
                {categories.map(cat => (
                  <TouchableOpacity key={cat} style={[styles.chip, editData.goal_category === cat && styles.chipActive]} onPress={() => setEditData({...editData, goal_category: cat})}>
                    <Text style={[styles.chipText, editData.goal_category === cat && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Priority Level</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 24}}>
                {priorities.map(pri => (
                  <TouchableOpacity key={pri} style={[styles.chip, editData.priority_level === pri && styles.chipActive]} onPress={() => setEditData({...editData, priority_level: pri})}>
                    <Text style={[styles.chipText, editData.priority_level === pri && styles.chipTextActive]}>{pri}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleEditGoal} disabled={updating}>
                  {updating ? <ActivityIndicator color="#fff"/> : <Text style={styles.saveText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- FUNDS MODAL --- */}
      <Modal visible={fundsModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentSmall}>
            <Text style={styles.modalTitle}>Manage Goal Funds</Text>
            
            <View style={styles.toggleRow}>
               <TouchableOpacity style={[styles.toggleBtn, fundAction === 'add' && styles.toggleActiveAdd]} onPress={() => setFundAction('add')}>
                  <Text style={[styles.toggleText, fundAction === 'add' && styles.toggleTextActive]}>Add (+)</Text>
               </TouchableOpacity>
               <TouchableOpacity style={[styles.toggleBtn, fundAction === 'withdraw' && styles.toggleActiveWith]} onPress={() => setFundAction('withdraw')}>
                  <Text style={[styles.toggleText, fundAction === 'withdraw' && styles.toggleTextActive]}>Withdraw (-)</Text>
               </TouchableOpacity>
            </View>

            <TextInput style={styles.input} placeholder="Amount (₹)" keyboardType="numeric" value={fundAmount} onChangeText={setFundAmount} autoFocus />
            <Text style={{fontSize: 12, color: '#6b7280', marginBottom: 20, textAlign: 'center'}}>
               This will log an {fundAction === 'add' ? 'Expense' : 'Income'} transaction in your tracker.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setFundsModalVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleManageFunds} disabled={processingFunds}>
                {processingFunds ? <ActivityIndicator color="#fff"/> : <Text style={styles.saveText}>Update Funds</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backButton: { padding: 8, backgroundColor: '#e5e7eb', borderRadius: 8 },
  backText: { color: '#374151', fontWeight: 'bold' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', textTransform: 'capitalize', flex: 1, textAlign: 'center' },
  editBtnTop: { padding: 8, backgroundColor: '#dbeafe', borderRadius: 8, width: 60, alignItems: 'center' },
  editText: { color: '#1d4ed8', fontWeight: 'bold' },
  
  aiLoadingBar: { flexDirection: 'row', backgroundColor: '#dbeafe', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  aiLoadingText: { marginLeft: 10, color: '#1d4ed8', fontWeight: '600' },
  summaryBanner: { backgroundColor: '#eff6ff', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#bfdbfe' },
  summaryText: { color: '#1e3a8a', fontSize: 14, lineHeight: 22 },
  
  card: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, elevation: 2, marginBottom: 16 },
  sectionTitleCenter: { fontSize: 18, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
  
  scoreCircleContainer: { alignItems: 'center', marginBottom: 12 },
  scoreCircle: { width: 140, height: 140, borderRadius: 70, borderWidth: 10, justifyContent: 'center', alignItems: 'center' },
  scoreText: { fontSize: 42, fontWeight: 'bold', color: '#111827' },
  scoreMax: { fontSize: 14, color: '#6b7280' },
  statusText: { textAlign: 'center', fontSize: 16, fontWeight: 'bold' },
  
  manageFundsBtn: { backgroundColor: '#10b981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  manageFundsText: { color: '#ffffff', fontWeight: 'bold' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridBox: { width: '48%', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12 },
  gridLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  gridValue: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { fontSize: 15, color: '#4b5563', fontWeight: '500' },
  rowValue: { fontSize: 15, color: '#111827', fontWeight: 'bold', textTransform: 'capitalize' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  
  flagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  riskFlag: { backgroundColor: '#fee2e2', color: '#b91c1c', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 12, fontWeight: 'bold', marginRight: 8, marginBottom: 8, textTransform: 'capitalize' },
  
  listItem: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  listHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  numberCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1d4ed8', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  numberText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  listTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', textTransform: 'capitalize' },
  transitionText: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 6 },
  descText: { fontSize: 14, color: '#4b5563', lineHeight: 20, marginBottom: 8 },
  impactTextHighlight: { fontSize: 14, fontWeight: 'bold', color: '#10b981' },
  
  altCard: { borderLeftWidth: 4, borderLeftColor: '#cbd5e1', paddingLeft: 12, marginBottom: 16 },
  impactDot: { fontSize: 12, fontWeight: 'bold' },
  altTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  
  milestoneCard: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 8 },
  msTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  msDate: { fontSize: 14, color: '#64748b' },
  msPct: { fontSize: 14, fontWeight: 'bold', color: '#3b82f6' },
  msStatus: { fontSize: 14, color: '#ef4444', fontWeight: '500' },

  finalDeleteBtn: { marginTop: 10, backgroundColor: '#fee2e2', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca', marginBottom: 20 },
  finalDeleteText: { color: '#b91c1c', fontWeight: 'bold', fontSize: 16 },

  // Modals & Forms
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalContentSmall: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 16, color: '#111827' },
  
  datePickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 14, marginBottom: 16 },
  datePickerText: { fontSize: 16, color: '#111827' },
  datePickerIcon: { fontSize: 18 },

  chip: { backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  chipText: { color: '#4b5563', fontWeight: '500', textTransform: 'capitalize' },
  chipTextActive: { color: '#ffffff', fontWeight: 'bold' },
  
  toggleRow: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 8, padding: 4, marginBottom: 20 },
  toggleBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 6 },
  toggleActiveAdd: { backgroundColor: '#10b981' },
  toggleActiveWith: { backgroundColor: '#ef4444' },
  toggleText: { fontWeight: '600', color: '#6b7280' },
  toggleTextActive: { color: '#ffffff', fontWeight: 'bold' },

  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { flex: 1, padding: 16, alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 8, marginRight: 8 },
  cancelText: { color: '#4b5563', fontWeight: 'bold', fontSize: 16 },
  saveBtn: { flex: 1, padding: 16, alignItems: 'center', backgroundColor: '#1d4ed8', borderRadius: 8, marginLeft: 8 },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default GoalDetailsScreen;



// import React, { useEffect, useState } from 'react';
// import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
// import { getGoalPlan, updateGoal, deleteGoal, addTransaction } from '../api/exports'; 

// const GoalDetailsScreen = ({ route, navigation }) => {
//   const { goal } = route.params;
  
//   const [aiPlan, setAiPlan] = useState({});
//   const [loadingAi, setLoadingAi] = useState(true);

//   // --- EDIT MODAL STATE ---
//   const [editModalVisible, setEditModalVisible] = useState(false);
//   const [updating, setUpdating] = useState(false);
//   const [editData, setEditData] = useState({
//     goal_name: goal.goal_name || goal.name || '',
//     current_price: String(goal.current_price || goal.target_amount || ''),
//     goal_target_date: goal.goal_target_date ? new Date(goal.goal_target_date).toISOString().split('T')[0] : '',
//     goal_category: goal.goal_category || 'vehicle',
//     priority_level: goal.priority_level || 'medium'
//   });

//   const categories = ['vehicle', 'gadget', 'travel', 'investment', 'education', 'other'];
//   const priorities = ['low', 'medium', 'high'];

//   // --- MANAGE FUNDS STATE ---
//   const [fundsModalVisible, setFundsModalVisible] = useState(false);
//   const [fundAmount, setFundAmount] = useState('');
//   const [fundAction, setFundAction] = useState('add');
//   const [processingFunds, setProcessingFunds] = useState(false);

//   // --- INITIAL DATA FETCH ---
//   useEffect(() => {
//     const fetchPlan = async () => {
//       try {
//         const res = await getGoalPlan(goal._id); 
//         const rawData = res.data?.data || res.data || {};
//         setAiPlan(rawData);
//       } catch (error) {
//         console.error("AI Plan Error:", error.message);
//       } finally {
//         setLoadingAi(false);
//       }
//     };
//     fetchPlan();
//   }, [goal._id]);

//   // --- ACTIONS ---
//   const handleEditGoal = async () => {
//     setUpdating(true);
//     try {
//       await updateGoal(goal._id, {
//         ...editData,
//         current_price: Number(editData.current_price),
//         goal_target_date: new Date(editData.goal_target_date).toISOString()
//       });
//       setEditModalVisible(false);
//       Alert.alert("Success", "Goal updated! Go back to refresh the list.");
//     } catch (error) { Alert.alert("Update Failed", error.message); } 
//     finally { setUpdating(false); }
//   };

//   const handleManageFunds = async () => {
//     if (!fundAmount || isNaN(fundAmount) || Number(fundAmount) <= 0) {
//       return Alert.alert("Error", "Enter a valid amount.");
//     }
    
//     const amountNum = Number(fundAmount);
//     const currentSaved = Number(goal.current_amount || 0);

//     // 🚨 THE FIX: STRICT WITHDRAWAL VALIDATION 🚨
//     if (fundAction === 'withdraw' && amountNum > currentSaved) {
//       return Alert.alert(
//         "Invalid Withdrawal", 
//         `You only have ₹${currentSaved.toLocaleString()} saved for this goal. You cannot withdraw ₹${amountNum.toLocaleString()}.`
//       );
//     }

//     setProcessingFunds(true);
//     const newTotal = fundAction === 'add' ? currentSaved + amountNum : currentSaved - amountNum;

//     try {
//       await updateGoal(goal._id, { current_amount: newTotal });
//       await addTransaction({
//         title: fundAction === 'add' ? `Saved for ${editData.goal_name}` : `Withdrew from ${editData.goal_name}`,
//         amount: amountNum,
//         type: fundAction === 'add' ? 'expense' : 'income',
//         category: 'Investment', 
//         date: new Date().toISOString()
//       });
//       setFundsModalVisible(false);
//       setFundAmount('');
//       goal.current_amount = newTotal; 
//       Alert.alert("Success", `Funds ${fundAction === 'add' ? 'added' : 'withdrawn'}!`);
//     } catch (error) { Alert.alert("Error", "Could not process funds."); } 
//     finally { setProcessingFunds(false); }
//   };

//   const handleDelete = () => {
//     Alert.alert("Delete Goal", "Are you sure?", [
//       { text: "Cancel", style: "cancel" },
//       { text: "Delete", style: "destructive", onPress: async () => {
//           try { await deleteGoal(goal._id); navigation.goBack(); } 
//           catch (e) { Alert.alert("Error", e.message); }
//       }}
//     ]);
//   };

//   // --- MAPPING AI DATA ---
//   const goalName = aiPlan.goal_name || goal.goal_name || 'Financial Goal';
//   const summaryText = aiPlan.summary || '';
//   const score = Number(aiPlan.feasibility_score || 0);
//   const statusText = aiPlan.feasibility_label || (score >= 50 ? 'Feasible' : 'Not Feasible');

//   const currentPrice = Number(aiPlan.future_value?.current_price || goal.current_price || 0);
//   const inflationAdjusted = Number(aiPlan.future_value?.future_value || currentPrice);
//   const requiredMonthly = Number(aiPlan.gap_analysis?.required_monthly_saving || 0);
//   const userSavingCapacity = Number(aiPlan.gap_analysis?.potential_monthly_saving || 0);
//   const currentlySaved = Number(goal.current_amount || 0);

//   const profileType = aiPlan.user_type || 'Unknown';
//   const mlPrediction = Number(aiPlan.ml_predicted_saving || 0);
//   const riskPenalty = aiPlan.risk_penalty_percent ? `-${aiPlan.risk_penalty_percent}%` : '0%';
//   const riskFlags = Array.isArray(aiPlan.risk_flags) ? aiPlan.risk_flags : [];

//   const feasibleNow = aiPlan.gap_analysis?.is_feasible_now === true;
//   const gap = Number(aiPlan.gap_analysis?.gap_from_current || 0);
//   const feasibleWithCuts = aiPlan.gap_analysis?.is_feasible_with_cuts === true;
//   const targetDate = aiPlan.target_date || 'Unknown Date';
//   const monthsAway = Number(aiPlan.months_remaining || 0);

//   const spendingCuts = Array.isArray(aiPlan.optimization_suggestions) ? aiPlan.optimization_suggestions : [];
//   const alternativePlans = Array.isArray(aiPlan.alternative_plans) ? aiPlan.alternative_plans : [];
//   const quarterlyMilestones = Array.isArray(aiPlan.milestones) ? aiPlan.milestones : [];

//   const getImpactColor = (impact) => {
//     const s = String(impact).toLowerCase();
//     if (s === 'high') return '#ef4444';
//     if (s === 'medium') return '#f59e0b';
//     return '#10b981';
//   };

//   return (
//     <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
//       <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        
//         {/* HEADER */}
//         <View style={styles.header}>
//           <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
//           <Text style={styles.headerTitle} numberOfLines={1}>{goalName}</Text>
//           <TouchableOpacity style={styles.editBtnTop} onPress={() => setEditModalVisible(true)}><Text style={styles.editText}>Edit</Text></TouchableOpacity>
//         </View>

//         {loadingAi && (
//           <View style={styles.aiLoadingBar}>
//             <ActivityIndicator size="small" color="#1d4ed8" />
//             <Text style={styles.aiLoadingText}>AI is calculating analysis...</Text>
//           </View>
//         )}

//         {summaryText ? <View style={styles.summaryBanner}><Text style={styles.summaryText}>{summaryText}</Text></View> : null}

//         {/* SCORE CARD */}
//         <View style={styles.card}>
//           <Text style={styles.sectionTitleCenter}>Feasibility Score</Text>
//           <View style={styles.scoreCircleContainer}>
//             <View style={[styles.scoreCircle, { borderColor: score >= 50 ? '#10b981' : '#ef4444' }]}>
//               <Text style={styles.scoreText}>{score.toFixed(1)}</Text>
//               <Text style={styles.scoreMax}>/ 100</Text>
//             </View>
//           </View>
//           <Text style={[styles.statusText, { color: score >= 50 ? '#10b981' : '#ef4444', marginBottom: 20 }]}>{statusText}</Text>
          
//           <View style={styles.divider} />
          
//           <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10}}>
//              <View>
//                 <Text style={styles.gridLabel}>Currently Saved</Text>
//                 <Text style={{fontSize: 24, fontWeight: 'bold', color: '#10b981'}}>₹{currentlySaved.toLocaleString()}</Text>
//              </View>
//              <TouchableOpacity style={styles.manageFundsBtn} onPress={() => setFundsModalVisible(true)}>
//                 <Text style={styles.manageFundsText}>Manage Funds</Text>
//              </TouchableOpacity>
//           </View>
//         </View>

//         {/* METRICS GRID */}
//         <View style={styles.card}>
//           <View style={styles.gridContainer}>
//             <View style={styles.gridBox}><Text style={styles.gridLabel}>Current Price</Text><Text style={styles.gridValue}>₹{currentPrice.toLocaleString()}</Text></View>
//             <View style={styles.gridBox}><Text style={styles.gridLabel}>Inflation-adjusted</Text><Text style={styles.gridValue}>₹{inflationAdjusted.toLocaleString(undefined, {maximumFractionDigits: 0})}</Text></View>
//             <View style={styles.gridBox}><Text style={styles.gridLabel}>Required/Month</Text><Text style={[styles.gridValue, {color: '#ef4444'}]}>₹{requiredMonthly.toLocaleString(undefined, {maximumFractionDigits: 0})}</Text></View>
//             <View style={styles.gridBox}><Text style={styles.gridLabel}>You Can Save/Mo</Text><Text style={[styles.gridValue, {color: '#10b981'}]}>₹{userSavingCapacity.toLocaleString(undefined, {maximumFractionDigits: 0})}</Text></View>
//           </View>
//         </View>

//         {Object.keys(aiPlan).length > 0 && !loadingAi && (
//           <>
//             {/* USER PROFILE */}
//             <View style={styles.card}>
//               <Text style={styles.sectionTitle}>User Profile</Text>
//               <View style={styles.rowBetween}><Text style={styles.rowLabel}>Profile</Text><Text style={styles.rowValue}>{profileType}</Text></View>
//               <View style={styles.rowBetween}><Text style={styles.rowLabel}>ML Saving Prediction</Text><Text style={styles.rowValue}>₹{mlPrediction.toLocaleString()}/mo</Text></View>
//               <View style={styles.rowBetween}><Text style={styles.rowLabel}>Risk Penalty</Text><Text style={[styles.rowValue, {color: '#ef4444'}]}>{riskPenalty}</Text></View>
//               {riskFlags.length > 0 && (
//                 <View style={styles.flagsContainer}>
//                   {riskFlags.map((flag, idx) => (<Text key={idx} style={styles.riskFlag}>{String(flag).replace(/_/g, ' ')}</Text>))}
//                 </View>
//               )}
//             </View>

//             {/* GAP ANALYSIS */}
//             <View style={styles.card}>
//               <Text style={styles.sectionTitle}>Gap Analysis</Text>
//               <View style={styles.rowBetween}><Text style={styles.rowLabel}>Feasible Now?</Text><Text style={[styles.rowValue, {color: feasibleNow ? '#10b981' : '#ef4444'}]}>{feasibleNow ? '✓ Yes' : '✗ No'}</Text></View>
//               {!feasibleNow && <View style={styles.rowBetween}><Text style={styles.rowLabel}>Gap</Text><Text style={[styles.rowValue, {color: '#ef4444'}]}>₹{gap.toLocaleString(undefined, {maximumFractionDigits: 0})}/mo</Text></View>}
//               <View style={styles.rowBetween}><Text style={styles.rowLabel}>With Spending Cuts?</Text><Text style={[styles.rowValue, {color: feasibleWithCuts ? '#10b981' : '#ef4444'}]}>{feasibleWithCuts ? '✓ Yes' : '✗ No'}</Text></View>
//               <View style={styles.divider} />
//               <View style={styles.rowBetween}><Text style={styles.rowLabel}>Target Date</Text><Text style={styles.rowValue}>{targetDate}</Text></View>
//               <View style={styles.rowBetween}><Text style={styles.rowLabel}>Timeline</Text><Text style={styles.rowValue}>{monthsAway} months away</Text></View>
//             </View>

//             {/* SPENDING CUTS (Optimization Suggestions) */}
//             {spendingCuts.length > 0 && (
//               <View style={styles.card}>
//                 <Text style={styles.sectionTitle}>🔍 Spending Cuts to Close Gap</Text>
//                 {spendingCuts.map((cut, idx) => (
//                   <View key={idx} style={styles.listItem}>
//                     <View style={styles.listHeaderRow}><View style={styles.numberCircle}><Text style={styles.numberText}>{idx + 1}</Text></View><Text style={styles.listTitle}>{cut.category}</Text></View>
//                     <Text style={styles.transitionText}>₹{Number(cut.current_spend || 0).toLocaleString()} → ₹{Number(cut.new_budget || 0).toLocaleString()}</Text>
//                     <Text style={styles.descText}>{cut.tip}</Text>
//                     <Text style={styles.impactTextHighlight}>Save ₹{Number(cut.monthly_saving || 0).toLocaleString()}/month</Text>
//                   </View>
//                 ))}
//               </View>
//             )}

//             {/* ALTERNATIVE PLANS */}
//             {alternativePlans.length > 0 && (
//               <View style={styles.card}>
//                 <Text style={styles.sectionTitle}>🔄 Alternative Plans</Text>
//                 {alternativePlans.map((alt, idx) => (
//                   <View key={idx} style={styles.altCard}>
//                     <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}><Text style={[styles.impactDot, {color: getImpactColor(alt.feasibility)}]}>● {String(alt.feasibility || 'medium').toUpperCase()}</Text></View>
//                     <Text style={styles.altTitle}>{alt.plan}</Text>
//                     <Text style={styles.descText}>{alt.description}</Text>
//                   </View>
//                 ))}
//               </View>
//             )}

//             {/* QUARTERLY MILESTONES */}
//             {quarterlyMilestones.length > 0 && (
//               <View style={styles.card}>
//                 <Text style={styles.sectionTitle}>📅 Quarterly Milestones</Text>
//                 {quarterlyMilestones.map((ms, idx) => (
//                   <View key={idx} style={styles.milestoneCard}>
//                     <View style={styles.rowBetween}>
//                        <Text style={styles.msTitle}>{ms.milestone}</Text>
//                        <Text style={styles.msDate}>{ms.date}</Text>
//                     </View>
//                     <View style={styles.rowBetween}>
//                        <Text style={styles.msPct}>{ms.progress_percent}%</Text>
//                        {ms.on_track_check ? <Text style={styles.msStatus}>{ms.on_track_check}</Text> : null}
//                     </View>
//                   </View>
//                 ))}
//               </View>
//             )}
//           </>
//         )}

//         <TouchableOpacity style={styles.finalDeleteBtn} onPress={handleDelete}>
//           <Text style={styles.finalDeleteText}>Delete Goal</Text>
//         </TouchableOpacity>
//       </ScrollView>

//       {/* --- EDIT MODAL --- */}
//       <Modal visible={editModalVisible} transparent animationType="slide">
//         <View style={styles.modalOverlay}>
//           <View style={styles.modalContent}>
//             <Text style={styles.modalTitle}>Edit Goal</Text>
//             <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              
//               <Text style={styles.inputLabel}>Goal Name</Text>
//               <TextInput style={styles.input} placeholder="e.g., Buy a Bike" value={editData.goal_name} onChangeText={(t) => setEditData({...editData, goal_name: t})} />
              
//               <Text style={styles.inputLabel}>Target Amount (₹)</Text>
//               <TextInput style={styles.input} placeholder="165000" keyboardType="numeric" value={editData.current_price} onChangeText={(t) => setEditData({...editData, current_price: t})} />
              
//               <Text style={styles.inputLabel}>Target Date (YYYY-MM-DD)</Text>
//               <TextInput style={styles.input} placeholder="2026-08-01" value={editData.goal_target_date} onChangeText={(t) => setEditData({...editData, goal_target_date: t})} />
              
//               <Text style={styles.inputLabel}>Category</Text>
//               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 16}}>
//                 {categories.map(cat => (
//                   <TouchableOpacity key={cat} style={[styles.chip, editData.goal_category === cat && styles.chipActive]} onPress={() => setEditData({...editData, goal_category: cat})}>
//                     <Text style={[styles.chipText, editData.goal_category === cat && styles.chipTextActive]}>{cat}</Text>
//                   </TouchableOpacity>
//                 ))}
//               </ScrollView>

//               <Text style={styles.inputLabel}>Priority Level</Text>
//               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 24}}>
//                 {priorities.map(pri => (
//                   <TouchableOpacity key={pri} style={[styles.chip, editData.priority_level === pri && styles.chipActive]} onPress={() => setEditData({...editData, priority_level: pri})}>
//                     <Text style={[styles.chipText, editData.priority_level === pri && styles.chipTextActive]}>{pri}</Text>
//                   </TouchableOpacity>
//                 ))}
//               </ScrollView>

//               <View style={styles.modalActions}>
//                 <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
//                 <TouchableOpacity style={styles.saveBtn} onPress={handleEditGoal} disabled={updating}>
//                   {updating ? <ActivityIndicator color="#fff"/> : <Text style={styles.saveText}>Save</Text>}
//                 </TouchableOpacity>
//               </View>
//             </ScrollView>
//           </View>
//         </View>
//       </Modal>

//       {/* --- FUNDS MODAL --- */}
//       <Modal visible={fundsModalVisible} transparent animationType="fade">
//         <View style={styles.modalOverlay}>
//           <View style={styles.modalContentSmall}>
//             <Text style={styles.modalTitle}>Manage Goal Funds</Text>
            
//             <View style={styles.toggleRow}>
//                <TouchableOpacity style={[styles.toggleBtn, fundAction === 'add' && styles.toggleActiveAdd]} onPress={() => setFundAction('add')}>
//                   <Text style={[styles.toggleText, fundAction === 'add' && styles.toggleTextActive]}>Add (+)</Text>
//                </TouchableOpacity>
//                <TouchableOpacity style={[styles.toggleBtn, fundAction === 'withdraw' && styles.toggleActiveWith]} onPress={() => setFundAction('withdraw')}>
//                   <Text style={[styles.toggleText, fundAction === 'withdraw' && styles.toggleTextActive]}>Withdraw (-)</Text>
//                </TouchableOpacity>
//             </View>

//             <TextInput style={styles.input} placeholder="Amount (₹)" keyboardType="numeric" value={fundAmount} onChangeText={setFundAmount} autoFocus />
//             <Text style={{fontSize: 12, color: '#6b7280', marginBottom: 20, textAlign: 'center'}}>
//                This will log an {fundAction === 'add' ? 'Expense' : 'Income'} transaction in your tracker.
//             </Text>

//             <View style={styles.modalActions}>
//               <TouchableOpacity style={styles.cancelBtn} onPress={() => setFundsModalVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
//               <TouchableOpacity style={styles.saveBtn} onPress={handleManageFunds} disabled={processingFunds}>
//                 {processingFunds ? <ActivityIndicator color="#fff"/> : <Text style={styles.saveText}>Update Funds</Text>}
//               </TouchableOpacity>
//             </View>
//           </View>
//         </View>
//       </Modal>

//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: { paddingHorizontal: 16, paddingTop: 50 },
//   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
//   backButton: { padding: 8, backgroundColor: '#e5e7eb', borderRadius: 8 },
//   backText: { color: '#374151', fontWeight: 'bold' },
//   headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', textTransform: 'capitalize', flex: 1, textAlign: 'center' },
//   editBtnTop: { padding: 8, backgroundColor: '#dbeafe', borderRadius: 8, width: 60, alignItems: 'center' },
//   editText: { color: '#1d4ed8', fontWeight: 'bold' },
  
//   aiLoadingBar: { flexDirection: 'row', backgroundColor: '#dbeafe', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
//   aiLoadingText: { marginLeft: 10, color: '#1d4ed8', fontWeight: '600' },
//   summaryBanner: { backgroundColor: '#eff6ff', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#bfdbfe' },
//   summaryText: { color: '#1e3a8a', fontSize: 14, lineHeight: 22 },
  
//   card: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, elevation: 2, marginBottom: 16 },
//   sectionTitleCenter: { fontSize: 18, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 16 },
//   sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
  
//   scoreCircleContainer: { alignItems: 'center', marginBottom: 12 },
//   scoreCircle: { width: 140, height: 140, borderRadius: 70, borderWidth: 10, justifyContent: 'center', alignItems: 'center' },
//   scoreText: { fontSize: 42, fontWeight: 'bold', color: '#111827' },
//   scoreMax: { fontSize: 14, color: '#6b7280' },
//   statusText: { textAlign: 'center', fontSize: 16, fontWeight: 'bold' },
  
//   manageFundsBtn: { backgroundColor: '#10b981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
//   manageFundsText: { color: '#ffffff', fontWeight: 'bold' },

//   gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
//   gridBox: { width: '48%', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12 },
//   gridLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
//   gridValue: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  
//   rowBetween: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
//   rowLabel: { fontSize: 15, color: '#4b5563', fontWeight: '500' },
//   rowValue: { fontSize: 15, color: '#111827', fontWeight: 'bold', textTransform: 'capitalize' },
//   divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  
//   flagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
//   riskFlag: { backgroundColor: '#fee2e2', color: '#b91c1c', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 12, fontWeight: 'bold', marginRight: 8, marginBottom: 8, textTransform: 'capitalize' },
  
//   listItem: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
//   listHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
//   numberCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1d4ed8', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
//   numberText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
//   listTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', textTransform: 'capitalize' },
//   transitionText: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 6 },
//   descText: { fontSize: 14, color: '#4b5563', lineHeight: 20, marginBottom: 8 },
//   impactTextHighlight: { fontSize: 14, fontWeight: 'bold', color: '#10b981' },
  
//   altCard: { borderLeftWidth: 4, borderLeftColor: '#cbd5e1', paddingLeft: 12, marginBottom: 16 },
//   impactDot: { fontSize: 12, fontWeight: 'bold' },
//   altTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  
//   milestoneCard: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 8 },
//   msTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
//   msDate: { fontSize: 14, color: '#64748b' },
//   msPct: { fontSize: 14, fontWeight: 'bold', color: '#3b82f6' },
//   msStatus: { fontSize: 14, color: '#ef4444', fontWeight: '500' },

//   finalDeleteBtn: { marginTop: 10, backgroundColor: '#fee2e2', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca', marginBottom: 20 },
//   finalDeleteText: { color: '#b91c1c', fontWeight: 'bold', fontSize: 16 },

//   // Modals & Forms
//   modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
//   modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
//   modalContentSmall: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
//   modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  
//   inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
//   input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 16, color: '#111827' },
  
//   chip: { backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e5e7eb' },
//   chipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
//   chipText: { color: '#4b5563', fontWeight: '500', textTransform: 'capitalize' },
//   chipTextActive: { color: '#ffffff', fontWeight: 'bold' },
  
//   toggleRow: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 8, padding: 4, marginBottom: 20 },
//   toggleBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 6 },
//   toggleActiveAdd: { backgroundColor: '#10b981' },
//   toggleActiveWith: { backgroundColor: '#ef4444' },
//   toggleText: { fontWeight: '600', color: '#6b7280' },
//   toggleTextActive: { color: '#ffffff', fontWeight: 'bold' },

//   modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
//   cancelBtn: { flex: 1, padding: 16, alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 8, marginRight: 8 },
//   cancelText: { color: '#4b5563', fontWeight: 'bold', fontSize: 16 },
//   saveBtn: { flex: 1, padding: 16, alignItems: 'center', backgroundColor: '#1d4ed8', borderRadius: 8, marginLeft: 8 },
//   saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
// });

// export default GoalDetailsScreen;