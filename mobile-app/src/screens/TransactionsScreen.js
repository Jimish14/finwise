import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchTransactions } from '../api/exports';

const TransactionsScreen = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = async () => {
    try {
      const response = await fetchTransactions();
      if (response.data) setTransactions(response.data);
    } catch (error) {
      console.error("Error loading transactions:", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // This is the magic hook! It runs every single time this tab is opened.
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadTransactions();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTransactions();
  }, []);

  const renderTransaction = ({ item }) => (
    <View style={styles.card}>
      <View>
        <Text style={styles.title}>{item.title || item.category}</Text>
        <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
      </View>
      <Text style={[styles.amount, { color: item.type === 'income' ? '#10b981' : '#ef4444' }]}>
        {item.type === 'income' ? '+' : '-'}₹{Math.abs(item.amount)}
      </Text>
    </View>
  );

  if (loading && !refreshing) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1d4ed8" /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>All Transactions</Text>
      
      <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        renderItem={renderTransaction}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1d4ed8"]} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No transactions found.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 20, paddingTop: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 20 },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 1 },
  title: { fontSize: 16, fontWeight: '500', color: '#111827' },
  date: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  amount: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 40 }
});

export default TransactionsScreen;