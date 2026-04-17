import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { fetchMonthlySummary, fetchTransactions, addTransaction } from '../api/exports';

const DashboardScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [summary, setSummary] = useState({ income: 0, expenses: 0, balance: 0 });
  const [recentTransactions, setRecentTransactions] = useState([]); // 🚨 STATE FOR LIST 🚨
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [newTx, setNewTx] = useState({ title: '', amount: '', type: 'expense', category: 'Food' });
  const [submitting, setSubmitting] = useState(false);

  const expenseCategories = ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Other'];
  const incomeCategories = ['Salary', 'Freelance', 'Investments', 'Refund', 'Other'];

  const loadDashboardData = async () => {
    try {
      const [summaryRes, transRes] = await Promise.all([fetchMonthlySummary(), fetchTransactions()]);
      
      let autoIncome = 0;
      let autoExpense = 0;

      if (transRes.data && Array.isArray(transRes.data)) {
        transRes.data.forEach(tx => {
          const amt = Number(tx.amount) || 0;
          if (tx.type === 'income') autoIncome += amt;
          if (tx.type === 'expense' || tx.type === 'expenses') autoExpense += amt;
        });
        
        // 🚨 GET ONLY THE 5 MOST RECENT TRANSACTIONS 🚨
        setRecentTransactions(transRes.data.slice(0, 5));
      }

      let finalIncome = autoIncome;
      let finalExpense = autoExpense;

      if (summaryRes.data) {
        const sumData = Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data;
        if (sumData) {
          const backendIncome = sumData.income || sumData.totalIncome || sumData.total_income || 0;
          const backendExpense = sumData.expenses || sumData.totalExpense || sumData.total_expense || 0;
          
          if (backendIncome > 0) finalIncome = backendIncome;
          if (backendExpense > 0) finalExpense = backendExpense;
        }
      }

      setSummary({
        income: finalIncome,
        expenses: finalExpense,
        balance: finalIncome - finalExpense
      });

    } catch (error) {
      console.error("Dashboard Load Error:", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadDashboardData(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, []);

  const handleAddTransaction = async () => {
    if (!newTx.title || !newTx.amount) return Alert.alert("Error", "Please fill in all fields.");
    if (isNaN(newTx.amount)) return Alert.alert("Error", "Amount must be a valid number.");

    setSubmitting(true);
    try {
      await addTransaction({ 
        ...newTx, 
        amount: Number(newTx.amount), 
        date: new Date().toISOString() 
      });
      setModalVisible(false);
      setNewTx({ title: '', amount: '', type: 'expense', category: 'Food' });
      onRefresh(); 
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 🚨 RENDER INDIVIDUAL TRANSACTION CARD 🚨
  const renderTransaction = ({ item }) => {
    const isIncome = item.type === 'income';
    return (
      <View style={styles.transactionCard}>
        <View style={styles.txIconBox}>
           <Text style={styles.txIcon}>{isIncome ? '↓' : '↑'}</Text>
        </View>
        <View style={styles.txDetails}>
          <Text style={styles.txTitle}>{item.title || item.category}</Text>
          <Text style={styles.txDate}>{new Date(item.date).toLocaleDateString()}</Text>
        </View>
        <Text style={[styles.txAmount, { color: isIncome ? '#10b981' : '#ef4444' }]}>
          {isIncome ? '+' : '-'}₹{Math.abs(item.amount).toLocaleString()}
        </Text>
      </View>
    );
  };

  const currentCategories = newTx.type === 'expense' ? expenseCategories : incomeCategories;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1d4ed8" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={recentTransactions}
        keyExtractor={(item) => item._id}
        renderItem={renderTransaction}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1d4ed8"]} />}
        
        // 🚨 DASHBOARD HEADER (BALANCE + "SEE ALL" BUTTON) 🚨
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.greeting}>Hello, {user?.name || 'User'}!</Text>
            </View>
            
            <View style={styles.balanceCard}>
              <Text style={styles.cardLabel}>Total Balance</Text>
              <Text style={styles.balanceAmount}>₹{summary.balance.toLocaleString()}</Text>
              <View style={styles.row}>
                <View><Text style={styles.cardLabel}>Income</Text><Text style={styles.incomeText}>+₹{summary.income.toLocaleString()}</Text></View>
                <View><Text style={styles.cardLabel}>Expenses</Text><Text style={styles.expenseText}>-₹{summary.expenses.toLocaleString()}</Text></View>
              </View>
            </View>
            
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
                 <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No recent transactions found.</Text>}
      />

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Transaction Modal */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Transaction</Text>
            
            <View style={styles.typeSelector}>
              <TouchableOpacity 
                style={[styles.typeBtn, newTx.type === 'income' && styles.typeBtnActiveIn]} 
                onPress={() => setNewTx({...newTx, type: 'income', category: 'Salary'})}>
                <Text style={newTx.type === 'income' ? styles.typeTextActive : styles.typeText}>Income</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.typeBtn, newTx.type === 'expense' && styles.typeBtnActiveEx]} 
                onPress={() => setNewTx({...newTx, type: 'expense', category: 'Food'})}>
                <Text style={newTx.type === 'expense' ? styles.typeTextActive : styles.typeText}>Expense</Text>
              </TouchableOpacity>
            </View>

            <TextInput style={styles.input} placeholder="Title (e.g., Groceries)" value={newTx.title} onChangeText={(t) => setNewTx({...newTx, title: t})} />
            <TextInput style={styles.input} placeholder="Amount (₹)" value={newTx.amount} onChangeText={(t) => setNewTx({...newTx, amount: t})} keyboardType="numeric" />
            
            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.categoryContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {currentCategories.map(cat => (
                  <TouchableOpacity 
                    key={cat} 
                    style={[styles.catChip, newTx.category === cat && styles.catChipActive]}
                    onPress={() => setNewTx({...newTx, category: cat})}
                  >
                    <Text style={[styles.catChipText, newTx.category === cat && styles.catChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddTransaction} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff"/> : <Text style={styles.saveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 20, paddingTop: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 20 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  
  balanceCard: { backgroundColor: '#1d4ed8', padding: 24, borderRadius: 16, marginBottom: 24, elevation: 4 },
  cardLabel: { color: '#dbeafe', fontSize: 14, marginBottom: 4 },
  balanceAmount: { color: '#ffffff', fontSize: 36, fontWeight: 'bold', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  incomeText: { color: '#34d399', fontSize: 18, fontWeight: '600' },
  expenseText: { color: '#f87171', fontSize: 18, fontWeight: '600' },
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#374151' },
  seeAll: { color: '#1d4ed8', fontWeight: '600', fontSize: 14, padding: 4 },
  
  transactionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginBottom: 12, elevation: 1 },
  txIconBox: { backgroundColor: '#f3f4f6', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txIcon: { fontSize: 18, fontWeight: 'bold', color: '#6b7280' },
  txDetails: { flex: 1 },
  txTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  txDate: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  txAmount: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#1d4ed8', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabText: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginTop: -2 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#111827' },
  typeSelector: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#f3f4f6', borderRadius: 8, padding: 4 },
  typeBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 6 },
  typeBtnActiveIn: { backgroundColor: '#10b981' },
  typeBtnActiveEx: { backgroundColor: '#ef4444' },
  typeText: { fontWeight: '600', color: '#6b7280' },
  typeTextActive: { fontWeight: 'bold', color: '#fff' },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  categoryContainer: { marginBottom: 24 },
  catChip: { backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  catChipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  catChipText: { color: '#4b5563', fontWeight: '500' },
  catChipTextActive: { color: '#ffffff', fontWeight: 'bold' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, padding: 16, alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 8, marginRight: 8 },
  cancelText: { color: '#4b5563', fontWeight: 'bold', fontSize: 16 },
  saveBtn: { flex: 1, padding: 16, alignItems: 'center', backgroundColor: '#1d4ed8', borderRadius: 8, marginLeft: 8 },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default DashboardScreen;