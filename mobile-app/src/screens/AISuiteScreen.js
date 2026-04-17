import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { getFinancialHealth, fetchMonthlySummary, predictExpense } from '../api/exports';

const fmtCurrency = (val) => `₹${Number(val || 0).toLocaleString()}`;

// --- CUSTOM UI COMPONENTS (HEALTH GUARD) ---
const ProgressBar = ({ label, value }) => (
  <View style={styles.pbContainer}>
    <View style={styles.pbHeader}>
      <Text style={styles.pbLabel}>{label}</Text>
      <Text style={styles.pbScore}>{value}/100</Text>
    </View>
    <View style={styles.pbTrack}>
      <View style={[styles.pbFill, { width: `${Math.max(0, Math.min(value, 100))}%` }]} />
    </View>
  </View>
);

const MetricBox = ({ label, value }) => (
  <View style={styles.metricBox}>
    <Text style={styles.metricBoxValue}>{value}</Text>
    <Text style={styles.metricBoxLabel}>{label}</Text>
  </View>
);

// --- MAIN SCREEN ---
const AISuiteScreen = () => {
  const [activeTab, setActiveTab] = useState('health'); 

  // Health State
  const [healthData, setHealthData] = useState(null);
  const [isHealthLoading, setIsHealthLoading] = useState(true);

  // Predictor State
  const [predictResult, setPredictResult] = useState(null);
  const [isPredictLoading, setIsPredictLoading] = useState(false);
  const [events, setEvents] = useState("");
  const [history, setHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // --- DATA FETCHERS ---
  const loadHealthData = async () => {
    setIsHealthLoading(true);
    try {
      const res = await getFinancialHealth();
      if (res.data) setHealthData(res.data);
    } catch (error) {
      console.log("Health Guard Error:", error.message);
    } finally { setIsHealthLoading(false); }
  };

  const loadHistoryData = async () => {
    setIsHistoryLoading(true);
    try {
      const r = await fetchMonthlySummary();
      const data = r.data?.data || r.data;
      if (Array.isArray(data)) {
        setHistory(data.slice(0, 6).reverse());
      }
    } catch (error) {
      console.log("Failed to load history for AI:", error.message);
    } finally { setIsHistoryLoading(false); }
  };

  const runPrediction = async () => {
    setIsPredictLoading(true);
    setPredictResult(null);
    try {
      const payload = { upcoming_events: events ? events.split(",").map(e => e.trim()).filter(Boolean) : [] };
      const res = await predictExpense(payload);
      if (res.data && res.success !== false) {
        setPredictResult(res.data || res);
      } else {
        Alert.alert("Prediction Failed", res.error || "Check AI service.");
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      Alert.alert("Error", msg.includes("ECONNREFUSED") ? "Cannot connect to AI service." : msg);
    } finally {
      setIsPredictLoading(false);
    }
  };

  // Initial Loaders
  useEffect(() => {
    if (activeTab === 'health' && !healthData) loadHealthData();
    if (activeTab === 'predictor' && history.length === 0) loadHistoryData();
  }, [activeTab]);

  const onRefresh = useCallback(() => {
    if (activeTab === 'health') loadHealthData();
    if (activeTab === 'predictor') loadHistoryData();
  }, [activeTab]);

  // 🚨 FIXED HEALTH EXTRACTORS 🚨
  const overallScore = healthData?.health_score || healthData?.score || 0;
  // Python sends 'risk_level_label'
  const status = healthData?.risk_level_label || healthData?.status || 'Analyzing';
  // Python sends trend as an object {trend: 'improving', description: '...'}
  const rawTrend = healthData?.trend?.trend || healthData?.trend;
  const trend = (typeof rawTrend === 'string' && rawTrend.length > 0) ? rawTrend.charAt(0).toUpperCase() + rawTrend.slice(1) : 'N/A';
  
  const vitals = healthData?.vitals || healthData?.metrics || {};
  const monthsAnalyzed = healthData?.months_analyzed || vitals?.months_analyzed || 0;
  // Multiply savings rate by 100!
  const savingsRate = (vitals?.savings_rate || 0) * 100; 
  // Python sends 'component_scores'
  const breakdown = healthData?.component_scores || healthData?.score_breakdown || {}; 
  const riskAlerts = healthData?.risk_alerts || healthData?.alerts || [];
  const adviceList = healthData?.advice || healthData?.personalized_advice || [];

  const getSeverityColor = (severity) => {
    const s = (severity || '').toLowerCase();
    if (s === 'high') return { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' };
    if (s === 'medium') return { bg: '#fffbeb', border: '#fcd34d', text: '#d97706' };
    return { bg: '#f0fdf4', border: '#86efac', text: '#15803d' }; 
  };

  // --- PREDICTOR EXTRACTORS ---
  const maxHistoryValue = history.reduce((max, h) => Math.max(max, h.total_income || 0, h.total_expense || 0), 1);
  const getSegmentStyle = (seg) => {
    switch(seg) {
      case 'saver': return { color: '#059669', bg: '#d1fae5', label: 'Saver', desc: '< 60% of income' };
      case 'balanced': return { color: '#d97706', bg: '#fef3c7', label: 'Balanced', desc: 'Healthy ratio' };
      case 'spender': return { color: '#e11d48', bg: '#ffe4e6', label: 'Spender', desc: '> 90% of income' };
      default: return { color: '#4b5563', bg: '#f3f4f6', label: 'Unknown', desc: 'Not enough data' };
    }
  };
  const segInfo = getSegmentStyle(predictResult?.user_segment);

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>AI Suite</Text>

      {/* --- TABS --- */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'health' && styles.activeTab]} onPress={() => setActiveTab('health')}>
          <Text style={[styles.tabText, activeTab === 'health' && styles.activeTabText]}>Health Guard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'predictor' && styles.activeTab]} onPress={() => setActiveTab('predictor')}>
          <Text style={[styles.tabText, activeTab === 'predictor' && styles.activeTabText]}>Predictor</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 150 }}
        refreshControl={<RefreshControl refreshing={activeTab === 'health' ? isHealthLoading : isHistoryLoading} onRefresh={onRefresh} colors={["#1d4ed8"]} />}
      >
        
        {/* ==================== HEALTH GUARD TAB =================== */}
        {activeTab === 'health' && (
          isHealthLoading ? <ActivityIndicator size="large" color="#1d4ed8" style={{marginTop: 40}} /> :
          <View>
            <View style={styles.card}>
              <View style={styles.scoreCircle}>
                <Text style={styles.scoreText}>{Number(overallScore).toFixed(0)}</Text>
                <Text style={styles.scoreMax}>/ 100</Text>
              </View>
              <Text style={styles.healthStatus}>
                Status: <Text style={[styles.statusHighlight, overallScore < 50 ? {color: '#ef4444'} : overallScore < 75 ? {color: '#f59e0b'} : {}]}>{status}</Text>
              </Text>

              <View style={styles.metaRow}>
                <MetricBox label="Trend" value={trend} />
                <MetricBox label="Months" value={monthsAnalyzed} />
                <MetricBox label="Savings Rate" value={`${Number(savingsRate).toFixed(1)}%`} />
              </View>
            </View>

            {Object.keys(vitals).length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Financial Vitals</Text>
                <View style={styles.vitalsGrid}>
                  <View style={styles.vitalItem}><Text style={styles.vitalLabel}>Avg Income</Text><Text style={styles.vitalValue}>{fmtCurrency(vitals.avg_monthly_income)}</Text></View>
                  <View style={styles.vitalItem}><Text style={styles.vitalLabel}>Avg Expense</Text><Text style={styles.vitalValue}>{fmtCurrency(vitals.avg_monthly_expense)}</Text></View>
                  <View style={styles.vitalItem}><Text style={styles.vitalLabel}>Emergency Fund</Text><Text style={styles.vitalValue}>{Number(vitals.emergency_fund_months || 0).toFixed(1)} Months</Text></View>
                  <View style={styles.vitalItem}><Text style={styles.vitalLabel}>Total Invested</Text><Text style={styles.vitalValue}>{fmtCurrency(vitals.total_invested)}</Text></View>
                </View>
              </View>
            )}

            {Object.keys(breakdown).length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Score Breakdown</Text>
                {Object.entries(breakdown).map(([key, val]) => (
                  <ProgressBar key={key} label={key.replace(/_/g, ' ')} value={val} />
                ))}
              </View>
            )}

            {riskAlerts.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>⚠️ Risk Alerts</Text>
                {riskAlerts.map((alert, index) => {
                  const title = typeof alert === 'string' ? alert : alert.title || 'Alert';
                  const desc = typeof alert === 'string' ? '' : alert.description || '';
                  const action = typeof alert === 'string' ? '' : alert.action || '';
                  const colors = getSeverityColor(alert.severity);
                  return (
                    <View key={index} style={[styles.alertCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                      <View style={styles.alertHeader}>
                        <Text style={[styles.severityBadge, { backgroundColor: colors.border, color: colors.text }]}>
                          {(alert.severity || 'info').toUpperCase()}
                        </Text>
                        <Text style={[styles.alertTitle, { color: colors.text }]}>{title}</Text>
                      </View>
                      <Text style={styles.alertDesc}>{desc}</Text>
                      {action ? <Text style={styles.alertAction}>→ {action}</Text> : null}
                    </View>
                  );
                })}
              </View>
            )}

            {adviceList.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>💡 Personalized Advice</Text>
                {adviceList.map((item, index) => {
                  const isObj = typeof item === 'object' && item !== null;
                  const title = isObj ? (item.category || item.title || 'Advice') : 'Tip';
                  const impact = isObj ? String(item.impact || item.priority || 'medium') : 'medium';
                  const desc = isObj ? (item.advice || item.description || '') : String(item);
                  const proj = isObj ? (item.estimated_benefit || item.projection || '') : '';
                  const impactColor = impact.toLowerCase() === 'high' ? '#ef4444' : impact.toLowerCase() === 'medium' ? '#f59e0b' : '#10b981';

                  return (
                    <View key={index} style={styles.adviceCard}>
                      <View style={styles.adviceHeaderRow}>
                        <View style={styles.adviceNumberCircle}><Text style={styles.adviceNumberText}>{index + 1}</Text></View>
                        <View style={{flex: 1}}>
                          <Text style={styles.adviceTitle}>{title}</Text>
                          <Text style={[styles.adviceImpact, { color: impactColor }]}>● {impact} impact</Text>
                        </View>
                      </View>
                      <Text style={styles.adviceDesc}>{desc}</Text>
                      {proj ? <Text style={styles.adviceProj}>📈 {proj}</Text> : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ==================== PREDICTOR TAB ====================== */}
        {activeTab === 'predictor' && (
          <View>
            {/* Config & Run */}
            <View style={styles.card}>
              <View style={styles.introHeader}>
                <View style={styles.iconBox}><Text style={styles.iconText}>🧠</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Expense Predictor</Text>
                  <Text style={styles.cardSubtitle}>Analyzes your history & upcoming events using AI to forecast spending.</Text>
                </View>
              </View>
              
              <Text style={styles.inputLabel}>Upcoming Events <Text style={{fontWeight: 'normal', color: '#6b7280'}}>(comma separated)</Text></Text>
              <TextInput style={styles.input} placeholder="e.g. goa trip, wedding, laptop" value={events} onChangeText={setEvents} />
              
              <TouchableOpacity style={styles.runBtn} onPress={runPrediction} disabled={isPredictLoading}>
                {isPredictLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.runBtnText}>◉ Predict Next Month</Text>}
              </TouchableOpacity>
            </View>

            {/* Native History Chart */}
            {history.length > 0 && !predictResult && !isPredictLoading && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Your Last {history.length} Months</Text>
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: '#10b981'}]}/><Text style={styles.legendText}>Income</Text></View>
                  <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: '#f43f5e'}]}/><Text style={styles.legendText}>Expense</Text></View>
                </View>

                {history.map((h, i) => {
                  const incWidth = `${Math.max((h.total_income / maxHistoryValue) * 100, 2)}%`;
                  const expWidth = `${Math.max((h.total_expense / maxHistoryValue) * 100, 2)}%`;
                  return (
                    <View key={i} style={styles.historyRow}>
                      <Text style={styles.historyMonth}>{h.month}</Text>
                      <View style={styles.historyBars}>
                        <View style={[styles.barInc, { width: incWidth }]} />
                        <View style={[styles.barExp, { width: expWidth }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Results UI */}
            {predictResult && !isPredictLoading && (
              <View style={styles.resultsContainer}>
                
                {/* Prediction Amount Box */}
                <View style={styles.card}>
                  <View style={styles.flexBetween}>
                    <Text style={styles.overline}>Predicted for {predictResult.next_month}</Text>
                    <View style={styles.badgeAmber}><Text style={styles.badgeAmberText}>{predictResult.months_analyzed}mo Analyzed</Text></View>
                  </View>
                  
                  <Text style={styles.bigAmount}>{fmtCurrency(predictResult.predicted_amount)}</Text>
                  
                  <View style={styles.statsGrid}>
                    <View style={styles.statTile}><Text style={styles.statLabel}>Base Model</Text><Text style={styles.statValue}>{fmtCurrency(predictResult.base_prediction)}</Text></View>
                    <View style={styles.statTile}><Text style={styles.statLabel}>Multipliers</Text><Text style={styles.statValue}>{fmtCurrency(predictResult.adjusted_amount)}</Text></View>
                    <View style={[styles.statTile, {backgroundColor: '#fef3c7'}]}><Text style={styles.statLabel}>+ Subs</Text><Text style={[styles.statValue, {color: '#d97706'}]}>{fmtCurrency(predictResult.fixed_expense)}</Text></View>
                  </View>

                  {predictResult.prediction_range && (
                    <View style={styles.rangeBox}>
                      <Text style={styles.rangeTitle}>CONFIDENCE RANGE</Text>
                      <View style={styles.flexBetween}>
                        <Text style={styles.rangeTextMin}>{fmtCurrency(predictResult.prediction_range.min)}</Text>
                        <View style={styles.rangeTrack}><View style={styles.rangeGradient} /></View>
                        <Text style={styles.rangeTextMax}>{fmtCurrency(predictResult.prediction_range.max)}</Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.flexRow}>
                  <View style={[styles.card, {flex: 1, marginRight: 6, alignItems: 'center'}]}>
                    <Text style={styles.sectionTitle}>AI Confidence</Text>
                    <Text style={[styles.bigAmount, {fontSize: 28, color: '#1d4ed8'}]}>{Math.round((predictResult.confidence_score || 0)*100)}%</Text>
                    <View style={{width: '100%', height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginTop: 10}}>
                       <View style={{width: `${(predictResult.confidence_score || 0)*100}%`, height: '100%', backgroundColor: '#1d4ed8', borderRadius: 3}} />
                    </View>
                  </View>
                  
                  <View style={[styles.card, {flex: 1, marginLeft: 6, alignItems: 'center', backgroundColor: segInfo.bg}]}>
                    <Text style={styles.sectionTitle}>Profile</Text>
                    <Text style={[styles.bigAmount, {fontSize: 22, color: segInfo.color, marginTop: 4}]}>{segInfo.label}</Text>
                    <Text style={{color: '#4b5563', fontSize: 12, textAlign: 'center', marginTop: 4}}>{segInfo.desc}</Text>
                  </View>
                </View>

                {(predictResult.explanation || []).length > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Why this prediction?</Text>
                    <View style={styles.explanationContainer}>
                      {predictResult.explanation.map((exp, i) => (
                        <View key={i} style={styles.expRow}>
                          <View style={styles.expNumber}>
                            <Text style={styles.expNumberText}>{i+1}</Text>
                          </View>
                          <Text style={styles.expText}>{exp}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Category Breakdown */}
                {predictResult.category_breakdown?.category_predictions && (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Category Breakdown</Text>
                    {Object.entries(predictResult.category_breakdown.category_predictions)
                      .sort((a,b) => b[1]-a[1])
                      .map(([cat, val]) => {
                        const total = predictResult.category_breakdown.total_from_categories || 1;
                        const pct = Math.round((val/total)*100);
                        return (
                          <View key={cat} style={styles.catRow}>
                            <View style={styles.flexBetween}>
                              <Text style={styles.catName}>{cat}</Text>
                              <Text style={styles.catVal}>{fmtCurrency(val)} <Text style={{color: '#9ca3af'}}>({pct}%)</Text></Text>
                            </View>
                            <View style={styles.catTrack}><View style={[styles.catFill, {width: `${pct}%`}]} /></View>
                          </View>
                        );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingTop: 50 },
  screenTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 20 },
  
  // Tabs
  tabContainer: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 12, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#ffffff', elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  activeTabText: { color: '#1d4ed8', fontWeight: 'bold' },

  card: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, elevation: 2, marginBottom: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
  flexBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flexRow: { flexDirection: 'row', justifyContent: 'space-between' },

  // Health Guard Styles
  scoreCircle: { alignSelf: 'center', width: 120, height: 120, borderRadius: 60, borderWidth: 8, borderColor: '#1d4ed8', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  scoreText: { fontSize: 36, fontWeight: 'bold', color: '#111827' },
  scoreMax: { fontSize: 14, color: '#6b7280' },
  healthStatus: { fontSize: 18, fontWeight: '500', color: '#374151', textAlign: 'center', marginBottom: 20, textTransform: 'capitalize' },
  statusHighlight: { color: '#10b981', fontWeight: 'bold' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f9fafb', borderRadius: 12, padding: 12 },
  metricBox: { alignItems: 'center', flex: 1 },
  metricBoxValue: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  metricBoxLabel: { fontSize: 12, color: '#6b7280', marginTop: 4, textTransform: 'capitalize' },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  vitalItem: { width: '48%', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12 },
  vitalLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  vitalValue: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  pbContainer: { marginBottom: 12 },
  pbHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  pbLabel: { fontSize: 14, color: '#374151', fontWeight: '500', textTransform: 'capitalize' },
  pbScore: { fontSize: 14, color: '#6b7280', fontWeight: 'bold' },
  pbTrack: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  pbFill: { height: '100%', backgroundColor: '#1d4ed8', borderRadius: 4 },
  alertCard: { borderWidth: 1, padding: 16, borderRadius: 12, marginBottom: 12 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 10, fontWeight: 'bold', marginRight: 8 },
  alertTitle: { fontSize: 15, fontWeight: 'bold', flex: 1 },
  alertDesc: { fontSize: 14, color: '#374151', marginBottom: 8, lineHeight: 20 },
  alertAction: { fontSize: 14, fontWeight: '600', color: '#111827' },
  adviceCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', padding: 16, borderRadius: 12, marginBottom: 12 },
  adviceHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  adviceNumberCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  adviceNumberText: { fontSize: 14, fontWeight: 'bold', color: '#374151' },
  adviceTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  adviceImpact: { fontSize: 12, fontWeight: 'bold', textTransform: 'lowercase', marginTop: 2 },
  adviceDesc: { fontSize: 14, color: '#4b5563', marginBottom: 12, lineHeight: 22 },
  adviceProj: { fontSize: 14, fontWeight: '600', color: '#0f172a', backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, overflow: 'hidden' },

  // Predictor Styles
  introHeader: { flexDirection: 'row', marginBottom: 16 },
  iconBox: { width: 48, height: 48, backgroundColor: '#dbeafe', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  iconText: { fontSize: 24 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  cardSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 4, lineHeight: 18 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 14, fontSize: 16, color: '#111827' },
  runBtn: { backgroundColor: '#1d4ed8', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  runBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  
  legendRow: { flexDirection: 'row', marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 12, color: '#6b7280' },
  historyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  historyMonth: { width: 50, fontSize: 12, color: '#4b5563', fontWeight: '500' },
  historyBars: { flex: 1, justifyContent: 'center' },
  barInc: { height: 8, backgroundColor: '#10b981', borderRadius: 4, marginBottom: 4 },
  barExp: { height: 8, backgroundColor: '#f43f5e', borderRadius: 4 },

  resultsContainer: { marginTop: 8 },
  overline: { fontSize: 12, color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: 0.5 },
  badgeAmber: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#fde68a' },
  badgeAmberText: { fontSize: 12, color: '#d97706', fontWeight: 'bold' },
  bigAmount: { fontSize: 40, fontWeight: 'bold', color: '#d97706', marginVertical: 8 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statTile: { flex: 1, backgroundColor: '#f9fafb', padding: 10, borderRadius: 8, marginHorizontal: 4, borderWidth: 1, borderColor: '#e5e7eb' },
  statLabel: { fontSize: 10, color: '#6b7280', marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  rangeBox: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fde68a' },
  rangeTitle: { fontSize: 10, color: '#b45309', fontWeight: 'bold', marginBottom: 8 },
  rangeTextMin: { fontSize: 12, color: '#059669', fontWeight: 'bold' },
  rangeTextMax: { fontSize: 12, color: '#e11d48', fontWeight: 'bold' },
  rangeTrack: { flex: 1, height: 6, backgroundColor: '#fde68a', marginHorizontal: 12, borderRadius: 3, overflow: 'hidden' },
  rangeGradient: { flex: 1, backgroundColor: '#d97706' },
  
  explanationContainer: { marginTop: 8 },
  expRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  expNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#fde68a' },
  expNumberText: { fontSize: 12, fontWeight: 'bold', color: '#d97706' },
  expText: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },

  catRow: { marginBottom: 12 },
  catName: { fontSize: 13, color: '#4b5563', textTransform: 'capitalize' },
  catVal: { fontSize: 13, fontWeight: 'bold', color: '#111827' },
  catTrack: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, marginTop: 6 },
  catFill: { height: '100%', backgroundColor: '#d97706', borderRadius: 3 },
});

export default AISuiteScreen;