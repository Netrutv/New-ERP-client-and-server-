import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet,
    ActivityIndicator, RefreshControl, TouchableOpacity,
    Alert, Modal, Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { authService, BASE_URL as API_URL } from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NoteItem {
    _id: string;
    className?: string;
    directorName?: string;
    directorNumber?: string;
    address?: string;
    contactPersonName?: string;
    studentCount?: number;
    classCount?: number;
}

interface ShiftItem {
    _id: string;
    date: string;
    loginTime: string;
    logoutTime: string;
    path?: any[];
    notes?: NoteItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const parseShiftDate = (dateStr: string): Date => {
    const parts = dateStr.replace(/-/g, '/').split('/');
    if (parts.length === 3) {
        const [d, m, y] = parts;
        return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
    return new Date(dateStr);
};

const formatDisplayDate = (date: Date): string =>
    `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

const isBetween = (shiftDateStr: string, start: Date, end: Date): boolean => {
    const d = parseShiftDate(shiftDateStr);
    const s = new Date(start); s.setHours(0, 0, 0, 0);
    const e = new Date(end); e.setHours(23, 59, 59, 999);
    return d >= s && d <= e;
};

// ─── Date Picker Row ──────────────────────────────────────────────────────────
interface DateRowProps {
    label: string;
    date: Date;
    onPress: () => void;
}
const DateRow = ({ label, date, onPress }: DateRowProps) => (
    <TouchableOpacity style={styles.datePickerBtn} onPress={onPress} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={16} color="#007AFF" />
        <Text style={styles.datePickerLabel}>{label}</Text>
        <Text style={styles.datePickerValue}>{formatDisplayDate(date)}</Text>
    </TouchableOpacity>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WorkerShifts() {
    const { userId, name } = useLocalSearchParams();
    const router = useRouter();

    const [shifts, setShifts] = useState<ShiftItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState(false);

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const [startDate, setStartDate] = useState<Date>(thirtyDaysAgo);
    const [endDate, setEndDate] = useState<Date>(today);

    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');
    const [tempPickerDate, setTempPickerDate] = useState<Date>(new Date());

    // ── Fetch history ──
    const fetchUserHistory = useCallback(async () => {
        try {
            const data = await authService.getHistory(userId as string);
            setShifts(data);
        } catch (e) {
            console.error('History Fetch Error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId]);

    useEffect(() => { fetchUserHistory(); }, [fetchUserHistory]);

    const filteredShifts = shifts.filter(s => isBetween(s.date, startDate, endDate));

    const openPicker = (target: 'start' | 'end') => {
        setPickerTarget(target);
        setTempPickerDate(target === 'start' ? startDate : endDate);
        setPickerVisible(true);
    };

    const confirmDate = () => {
        if (pickerTarget === 'start') {
            if (tempPickerDate > endDate) {
                Alert.alert('Invalid Range', 'Start date cannot be after end date.');
                return;
            }
            setStartDate(tempPickerDate);
        } else {
            if (tempPickerDate < startDate) {
                Alert.alert('Invalid Range', 'End date cannot be before start date.');
                return;
            }
            setEndDate(tempPickerDate);
        }
        setPickerVisible(false);
    };

    // ── Individual shift report (from server) ──
    const downloadShiftReport = async (shiftId: string, date: string) => {
        try {
            const cleanDate = date.replace(/\//g, '-');
            const fileUri = `${FileSystem.documentDirectory}Report_${cleanDate}.xlsx`;
            const downloadUrl = `${API_URL}/download-shift-report/${shiftId}`;
            const dl = FileSystem.createDownloadResumable(downloadUrl, fileUri);
            const result = await dl.downloadAsync();
            if (!result || result.status !== 200) {
                Alert.alert('Error', 'Server failed to generate the report.');
                return;
            }
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(result.uri, {
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    dialogTitle: `Report for ${date}`,
                    UTI: 'com.microsoft.excel.xlsx',
                });
            } else {
                Alert.alert('Saved', `File saved to: ${result.uri}`);
            }
        } catch (err) {
            console.error('Download error:', err);
            Alert.alert('Download Failed', 'Something went wrong.');
        }
    };

    // ── Date range Excel export ✅ NOW FROM SERVER ──
    const exportRangeExcel = async () => {
        if (filteredShifts.length === 0) {
            Alert.alert('No Data', 'No shifts found in the selected date range.');
            return;
        }
        setExporting(true);
        try {
            const startStr = formatDisplayDate(startDate);
            const endStr = formatDisplayDate(endDate);
            const workerIdStr = (userId as string).replace(/['"]+/g, '').trim();
            const encodedStart = encodeURIComponent(startStr);
            const encodedEnd = encodeURIComponent(endStr);

            const downloadUrl = `${API_URL}/export-range/${workerIdStr}?startDate=${encodedStart}&endDate=${encodedEnd}`;

            const safeStart = startStr.replace(/\//g, '-');
            const safeEnd = endStr.replace(/\//g, '-');
            const fileName = `Report_${safeStart}_to_${safeEnd}.xlsx`;
            const fileUri = `${FileSystem.documentDirectory}${fileName}`;

            const dl = FileSystem.createDownloadResumable(downloadUrl, fileUri);
            const result = await dl.downloadAsync();

            if (!result || result.status !== 200) {
                Alert.alert('Error', 'Server failed to generate the report.');
                return;
            }

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(result.uri, {
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    dialogTitle: 'Save Excel Report',
                    UTI: 'com.microsoft.excel.xlsx',
                });
            } else {
                Alert.alert('Saved', `Excel saved to:\n${result.uri}`);
            }
        } catch (err) {
            console.error('Export error:', err);
            Alert.alert('Export Failed', 'Could not generate Excel file.');
        } finally {
            setExporting(false);
        }
    };

    // ── Shift card ──
    const renderShiftCard = ({ item }: { item: ShiftItem }) => {
        const isOngoing = item.logoutTime === 'Ongoing' || !item.logoutTime;

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.dateText}>{item.date}</Text>
                    <View style={[styles.statusBadge, isOngoing ? styles.ongoingBg : styles.completedBg]}>
                        <View style={[styles.dot, isOngoing ? styles.ongoingDot : styles.completedDot]} />
                        <Text style={[styles.statusText, isOngoing ? styles.ongoingColor : styles.completedColor]}>
                            {isOngoing ? 'ONGOING' : 'COMPLETED'}
                        </Text>
                    </View>
                </View>

                <View style={styles.timeRow}>
                    <View style={styles.timeBlock}>
                        <Ionicons name="log-in-outline" size={16} color="#8E8E93" />
                        <Text style={styles.timeLabel}> Login: <Text style={styles.timeValue}>{item.loginTime}</Text></Text>
                    </View>
                    <View style={styles.timeBlock}>
                        <Ionicons name="log-out-outline" size={16} color="#8E8E93" />
                        <Text style={styles.timeLabel}> Logout: <Text style={styles.timeValue}>{item.logoutTime}</Text></Text>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statGroup}>
                        <Ionicons name="location-outline" size={14} color="#8E8E93" />
                        <Text style={styles.statText}>{item.path?.length || 0} Points</Text>
                    </View>
                    <View style={styles.statGroup}>
                        <Ionicons name="document-text-outline" size={14} color="#8E8E93" />
                        <Text style={styles.statText}>{item.notes?.length || 0} Notes</Text>
                    </View>
                    {!isOngoing && (
                        <TouchableOpacity
                            onPress={() => downloadShiftReport(item._id, item.date)}
                            style={styles.downloadBtn}
                        >
                            <Ionicons name="cloud-download-outline" size={20} color="#007AFF" />
                            <Text style={styles.downloadBtnText}>Report</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.actionRow}>
                    {isOngoing && (
                        <TouchableOpacity
                            style={[styles.btn, styles.btnLive]}
                            onPress={() => router.push({ pathname: '/(admin)/live-track', params: { userId } })}
                        >
                            <View style={[styles.dot, { backgroundColor: '#34C759' }]} />
                            <Text style={styles.btnLiveText}>Live Track</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.btn, styles.btnDetails, !isOngoing && { width: '100%' }]}
                        onPress={() => router.push({ pathname: '/(admin)/details', params: { shiftId: item._id } })}
                    >
                        <Ionicons name="eye-outline" size={18} color="#007AFF" />
                        <Text style={styles.btnDetailsText}> View Details</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* ── Header ── */}
            <View style={styles.screenHeader}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{name || 'User'}'s Shifts</Text>
                </View>
            </View>

            {/* ── Date Range Filter + Export ── */}
            <View style={styles.filterCard}>
                <Text style={styles.filterLabel}>📅 Date Range</Text>
                <View style={styles.dateRow}>
                    <DateRow label="From" date={startDate} onPress={() => openPicker('start')} />
                    <Ionicons name="arrow-forward" size={16} color="#C7C7CC" style={{ marginHorizontal: 4 }} />
                    <DateRow label="To" date={endDate} onPress={() => openPicker('end')} />
                </View>
                <View style={styles.filterBottom}>
                    <Text style={styles.matchCount}>
                        {filteredShifts.length} shift{filteredShifts.length !== 1 ? 's' : ''} found
                    </Text>
                    <TouchableOpacity
                        style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
                        onPress={exportRangeExcel}
                        disabled={exporting}
                    >
                        {exporting ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <>
                                <Ionicons name="download-outline" size={16} color="#FFF" />
                                <Text style={styles.exportBtnText}>  Export Excel</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── List ── */}
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            ) : (
                <FlatList
                    data={filteredShifts}
                    keyExtractor={item => item._id}
                    renderItem={renderShiftCard}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={fetchUserHistory} tintColor="#007AFF" />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="calendar-clear-outline" size={48} color="#C7C7CC" />
                            <Text style={styles.emptyText}>No shifts in selected range</Text>
                        </View>
                    }
                />
            )}

            {/* ── Date Picker Modal ── */}
            {Platform.OS === 'ios' ? (
                <Modal transparent visible={pickerVisible} animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalSheet}>
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={() => setPickerVisible(false)}>
                                    <Text style={styles.modalCancel}>Cancel</Text>
                                </TouchableOpacity>
                                <Text style={styles.modalTitle}>
                                    {pickerTarget === 'start' ? 'Start Date' : 'End Date'}
                                </Text>
                                <TouchableOpacity onPress={confirmDate}>
                                    <Text style={styles.modalDone}>Done</Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={tempPickerDate}
                                mode="date"
                                display="spinner"
                                onChange={(_, d) => d && setTempPickerDate(d)}
                                maximumDate={new Date()}
                            />
                        </View>
                    </View>
                </Modal>
            ) : (
                pickerVisible && (
                    <DateTimePicker
                        value={tempPickerDate}
                        mode="date"
                        display="default"
                        onChange={(_, d) => {
                            setPickerVisible(false);
                            if (d) {
                                if (pickerTarget === 'start') {
                                    if (d > endDate) {
                                        Alert.alert('Invalid Range', 'Start date cannot be after end date.');
                                    } else {
                                        setStartDate(d);
                                    }
                                } else {
                                    if (d < startDate) {
                                        Alert.alert('Invalid Range', 'End date cannot be before start date.');
                                    } else {
                                        setEndDate(d);
                                    }
                                }
                            }
                        }}
                        maximumDate={new Date()}
                    />
                )
            )}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    screenHeader: {
        flexDirection: 'row', alignItems: 'center',
        padding: 20, paddingTop: 50,
        backgroundColor: '#FFF',
        borderBottomWidth: 1, borderBottomColor: '#E5E5EA',
    },
    headerInfo: { marginLeft: 15 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1E' },

    filterCard: {
        backgroundColor: '#FFF', margin: 16, borderRadius: 16, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    },
    filterLabel: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', marginBottom: 12 },
    dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },

    datePickerBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F2F2F7', borderRadius: 10, padding: 10,
    },
    datePickerLabel: { fontSize: 11, color: '#8E8E93', marginLeft: 6, marginRight: 4 },
    datePickerValue: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', flex: 1 },

    filterBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    matchCount: { fontSize: 13, color: '#8E8E93' },

    exportBtn: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#34C759', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    },
    exportBtnDisabled: { backgroundColor: '#A8A8A8' },
    exportBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

    list: { padding: 16 },

    card: {
        backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    dateText: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    },
    ongoingBg: { backgroundColor: '#E8F5E9' },
    completedBg: { backgroundColor: '#F2F2F7' },
    statusText: { fontSize: 11, fontWeight: 'bold' },
    ongoingColor: { color: '#34C759' },
    completedColor: { color: '#8E8E93' },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    ongoingDot: { backgroundColor: '#34C759' },
    completedDot: { backgroundColor: '#8E8E93' },

    timeRow: {
        flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12,
        paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
    },
    timeBlock: { flexDirection: 'row', alignItems: 'center' },
    timeLabel: { fontSize: 14, color: '#8E8E93' },
    timeValue: { color: '#1C1C1E', fontWeight: '600' },

    statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    statGroup: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
    statText: { fontSize: 13, color: '#8E8E93', marginLeft: 4 },
    downloadBtn: {
        marginLeft: 'auto', flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F0F7FF', padding: 6, borderRadius: 8,
    },
    downloadBtnText: { color: '#007AFF', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },

    actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
    btn: { height: 48, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    btnLive: { width: '48%', backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#34C759' },
    btnDetails: { width: '48%', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#007AFF' },
    btnLiveText: { color: '#34C759', fontWeight: 'bold' },
    btnDetailsText: { color: '#007AFF', fontWeight: 'bold' },

    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#8E8E93', fontSize: 16, marginTop: 10 },

    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    modalSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34,
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E5EA',
    },
    modalTitle: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
    modalCancel: { fontSize: 16, color: '#FF3B30' },
    modalDone: { fontSize: 16, color: '#007AFF', fontWeight: '700' },
});