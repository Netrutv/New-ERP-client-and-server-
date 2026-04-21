import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, ActivityIndicator, RefreshControl,
    Alert, Animated
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../../services/api';

export default function AdminDashboard() {
    const router = useRouter();
    const [ongoingShifts, setOngoingShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Pulse animation for live dots
    const pulseAnim = useState(new Animated.Value(1))[0];

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.5, duration: 700, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    // ─── Load + Auto-refresh ───────────────────
    useEffect(() => {
        fetchOngoingShifts();
        const interval = setInterval(fetchOngoingShifts, 15000); // refresh every 15s
        return () => clearInterval(interval);
    }, []);

    const fetchOngoingShifts = async () => {
        try {
            const data = await authService.getOngoingShifts();
            setOngoingShifts(data);
        } catch (e: any) {
            console.error("Dashboard Fetch Error:", e);
            if (loading) Alert.alert("Sync Error", "Could not connect to server.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLogout = async () => {
        await AsyncStorage.clear();
        router.replace('/(auth)/login');
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchOngoingShifts();
    };

    // ─── Get avatar background color based on name ──
    const getAvatarColor = (name: string) => {
        const colors = ['#007AFF', '#FF6B6B', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4', '#F44336', '#3F51B5'];
        if (!name) return colors[0];
        const index = name.charCodeAt(0) % colors.length;
        return colors[index];
    };

    // ─── Render Each Worker Card ───────────────
    const renderShiftItem = ({ item }: any) => {
        const workerName = item.userId?.name || 'Unknown User';
        const initial = workerName.charAt(0).toUpperCase();
        const avatarColor = getAvatarColor(workerName);
        const clockInTime = new Date(item.startTime).toLocaleTimeString([], {
            hour: '2-digit', minute: '2-digit'
        });

        return (
            <TouchableOpacity
                style={styles.shiftCard}
                onPress={() => router.push({
                    pathname: '/(admin)/live-track',
                    params: { shiftId: item._id, workerName: workerName }
                })}
                activeOpacity={0.75}
            >
                {/* Left: Avatar + Info */}
                <View style={styles.workerInfo}>
                    {/* Avatar with initial */}
                    <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                        <Text style={styles.avatarText}>{initial}</Text>
                        {/* Live indicator dot on avatar */}
                        <View style={styles.onlineDot} />
                    </View>

                    <View style={{ marginLeft: 14 }}>
                        <Text style={styles.workerName}>{workerName}</Text>
                        <View style={styles.clockInRow}>
                            <Ionicons name="time-outline" size={12} color="#8E8E93" />
                            <Text style={styles.startTime}> Clocked in: {clockInTime}</Text>
                        </View>
                        <View style={styles.trackingBadge}>
                            <Ionicons name="navigate" size={10} color="#007AFF" />
                            <Text style={styles.trackingText}> Tracking Active</Text>
                        </View>
                    </View>
                </View>

                {/* Right: Live badge + Arrow */}
                <View style={styles.statusSection}>
                    <View style={styles.liveBadge}>
                        <Animated.View style={[
                            styles.liveDot,
                            { transform: [{ scale: pulseAnim }] }
                        ]} />
                        <Text style={styles.liveText}>LIVE</Text>
                    </View>
                    <View style={styles.viewBtn}>
                        <Text style={styles.viewBtnText}>View</Text>
                        <Ionicons name="chevron-forward" size={14} color="#007AFF" />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>

            {/* ─── HEADER ─── */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcome}>Admin Panel</Text>
                    <Text style={styles.subText}>Real-time Monitoring</Text>
                </View>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                    <Ionicons name="power" size={22} color="#FF3B30" />
                </TouchableOpacity>
            </View>

            {/* ─── STATS ROW ─── */}
            <View style={styles.statsRow}>
                {/* Active Workers */}
                <View style={[styles.statBox, { backgroundColor: '#E8F5E9' }]}>
                    <View style={styles.statIconRow}>
                        <Ionicons name="people" size={22} color="#4CAF50" />
                        <Animated.View style={[styles.statLiveDot, { transform: [{ scale: pulseAnim }] }]} />
                    </View>
                    <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{ongoingShifts.length}</Text>
                    <Text style={styles.statLabel}>Active Now</Text>
                </View>

                {/* Navigate to Workers List */}
                <TouchableOpacity
                    style={[styles.statBox, { backgroundColor: '#E3F2FD' }]}
                    onPress={() => router.push('/(admin)/workers-list')}
                >
                    <Ionicons name="list" size={22} color="#007AFF" />
                    <Text style={[styles.statNumber, { color: '#007AFF' }]}>All</Text>
                    <Text style={[styles.statLabel, { color: '#007AFF' }]}>Employees</Text>
                </TouchableOpacity>

                {/* Navigate to Settings */}
                <TouchableOpacity
                    style={[styles.statBox, { backgroundColor: '#FFF3E0' }]}
                    onPress={() => router.push('/(admin)/settings')}
                >
                    <Ionicons name="settings-outline" size={22} color="#FF9800" />
                    <Text style={[styles.statNumber, { color: '#FF9800', fontSize: 14 }]}>Settings</Text>
                    <Text style={[styles.statLabel, { color: '#FF9800' }]}>Admin</Text>
                </TouchableOpacity>
            </View>

            {/* ─── ONGOING SHIFTS LIST ─── */}
            <View style={styles.listContainer}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Ongoing Shifts</Text>
                    <TouchableOpacity onPress={fetchOngoingShifts} style={styles.refreshIconBtn}>
                        <Ionicons name="refresh" size={18} color="#007AFF" />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} />
                ) : (
                    <FlatList
                        data={ongoingShifts}
                        keyExtractor={(item: any) => item._id}
                        renderItem={renderShiftItem}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor="#007AFF"
                            />
                        }
                        contentContainerStyle={{ paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <View style={styles.emptyIcon}>
                                    <Ionicons name="walk-outline" size={48} color="#C7C7CC" />
                                </View>
                                <Text style={styles.emptyTitle}>No Active Workers</Text>
                                <Text style={styles.emptyText}>Workers will appear here when they start their shift.</Text>
                                <TouchableOpacity onPress={fetchOngoingShifts} style={styles.refreshBtn}>
                                    <Ionicons name="refresh" size={16} color="#007AFF" />
                                    <Text style={styles.refreshBtnText}> Tap to Refresh</Text>
                                </TouchableOpacity>
                            </View>
                        }
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7', paddingTop: 60 },

    // Header
    header: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', paddingHorizontal: 25, marginBottom: 20,
    },
    welcome: { fontSize: 32, fontWeight: 'bold', color: '#1C1C1E' },
    subText: { color: '#8E8E93', fontSize: 15, fontWeight: '500' },
    logoutBtn: {
        backgroundColor: '#FFF', padding: 12, borderRadius: 15, elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1, shadowRadius: 3,
    },

    // Stats
    statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 25 },
    statBox: {
        flex: 1, padding: 16, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center', elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08, shadowRadius: 3,
    },
    statIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    statLiveDot: {
        width: 7, height: 7, borderRadius: 4,
        backgroundColor: '#4CAF50', marginLeft: 4,
    },
    statNumber: { fontSize: 22, fontWeight: 'bold', color: '#1C1C1E' },
    statLabel: { fontSize: 11, color: '#8E8E93', marginTop: 2, fontWeight: '600' },

    // List
    listContainer: {
        flex: 1, backgroundColor: '#FFF',
        borderTopLeftRadius: 35, borderTopRightRadius: 35,
        padding: 25, elevation: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06, shadowRadius: 8,
    },
    sectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 20,
    },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1E' },
    refreshIconBtn: {
        backgroundColor: '#F2F2F7', padding: 8,
        borderRadius: 10,
    },

    // Worker Card
    shiftCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#FAFAFA', padding: 16, borderRadius: 20, marginBottom: 12,
        borderWidth: 1, borderColor: '#F0F0F0',
        elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4,
    },
    workerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },

    // Avatar
    avatar: {
        width: 52, height: 52, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
        position: 'relative',
    },
    avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 22 },
    onlineDot: {
        position: 'absolute', bottom: -2, right: -2,
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: '#4CAF50',
        borderWidth: 2, borderColor: 'white',
    },

    clockInRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
    workerName: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
    startTime: { fontSize: 12, color: '#8E8E93' },
    trackingBadge: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#EFF6FF', paddingHorizontal: 6,
        paddingVertical: 2, borderRadius: 6, marginTop: 4,
        alignSelf: 'flex-start',
    },
    trackingText: { fontSize: 10, color: '#007AFF', fontWeight: '700' },

    // Right side
    statusSection: { alignItems: 'flex-end', gap: 8 },
    liveBadge: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    },
    liveDot: {
        width: 7, height: 7, borderRadius: 4,
        backgroundColor: '#4CAF50', marginRight: 5,
    },
    liveText: { fontSize: 10, fontWeight: '900', color: '#4CAF50' },
    viewBtn: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    },
    viewBtnText: { fontSize: 12, color: '#007AFF', fontWeight: '700' },

    // Empty State
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyIcon: {
        width: 90, height: 90, borderRadius: 45,
        backgroundColor: '#F2F2F7',
        justifyContent: 'center', alignItems: 'center', marginBottom: 15,
    },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1E', marginBottom: 6 },
    emptyText: { color: '#8E8E93', fontSize: 14, textAlign: 'center', paddingHorizontal: 30 },
    refreshBtn: {
        flexDirection: 'row', alignItems: 'center',
        marginTop: 20, backgroundColor: '#EFF6FF',
        padding: 12, borderRadius: 12,
    },
    refreshBtnText: { color: '#007AFF', fontWeight: 'bold', fontSize: 14 },
});
