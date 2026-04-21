// // // import React, { useState, useEffect, useRef, useCallback } from 'react';
// // // import {
// // //   View, StyleSheet, Text, TouchableOpacity, Alert,
// // //   ActivityIndicator, Modal, TextInput, SafeAreaView,
// // //   ScrollView, KeyboardAvoidingView, Platform
// // // } from 'react-native';
// // // import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
// // // import * as Location from 'expo-location';
// // // import * as TaskManager from 'expo-task-manager';
// // // import AsyncStorage from '@react-native-async-storage/async-storage';
// // // import { Ionicons } from '@expo/vector-icons';
// // // import axios from 'axios';
// // // import { io, Socket } from 'socket.io-client';
// // // import { BASE_URL } from '../../services/api';

// // // const LOCATION_TASK_NAME = 'background-location-task';
// // // const SHIFT_DURATION_MS = 8 * 60 * 60 * 1000;
// // // const MIN_METERS = 10; // GPS drift filter

// // // const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
// // //   const R = 6371;
// // //   const dLat = (lat2 - lat1) * Math.PI / 180;
// // //   const dLon = (lon2 - lon1) * Math.PI / 180;
// // //   const a =
// // //     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
// // //     Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
// // //     Math.sin(dLon / 2) * Math.sin(dLon / 2);
// // //   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// // // };

// // // const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
// // //   return calculateDistance(lat1, lon1, lat2, lon2) * 1000;
// // // };

// // // // ─── Socket instance (module level) ───────────
// // // let socket: Socket | null = null;
// // // let lastSentLat: number | null = null;
// // // let lastSentLng: number | null = null;

// // // // ─────────────────────────────────────────────
// // // //         BACKGROUND LOCATION TASK
// // // // ─────────────────────────────────────────────
// // // TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
// // //   if (error || !data?.locations?.length) return;
// // //   try {
// // //     const { latitude, longitude } = data.locations[0].coords;

// // //     // GPS drift filter
// // //     if (lastSentLat !== null && lastSentLng !== null) {
// // //       const dist = haversineMeters(lastSentLat, lastSentLng, latitude, longitude);
// // //       if (dist < MIN_METERS) return;
// // //     }

// // //     const rawId = await AsyncStorage.getItem('userId');
// // //     const shiftId = await AsyncStorage.getItem('activeShiftId');
// // //     if (!rawId) return;
// // //     const cleanId = rawId.replace(/['"]+/g, '').trim();

// // //     lastSentLat = latitude;
// // //     lastSentLng = longitude;

// // //     // ✅ Send via Socket if connected, else fallback to REST
// // //     if (socket?.connected && shiftId) {
// // //       socket.emit('location_update', {
// // //         userId: cleanId,
// // //         shiftId,
// // //         latitude,
// // //         longitude,
// // //       });
// // //     } else {
// // //       await axios.post(`${BASE_URL}/track`, { userId: cleanId, latitude, longitude });
// // //     }
// // //   } catch (err: any) {
// // //     console.log('BG tracking failed:', err.message);
// // //   }
// // // });

// // // // ─────────────────────────────────────────────
// // // //         MAIN COMPONENT
// // // // ─────────────────────────────────────────────
// // // export default function FieldDashboard() {
// // //   const mapRef = useRef<MapView>(null);
// // //   const isEndingShift = useRef(false);

// // //   const [shiftStart, setShiftStart] = useState<number | null>(null);
// // //   const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
// // //   const [timeLeft, setTimeLeft] = useState('08:00:00');
// // //   const [totalDistance, setTotalDistance] = useState(0);
// // //   const [loading, setLoading] = useState(true);
// // //   const [pathCoordinates, setPathCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
// // //   const [isNoteModalVisible, setNoteModalVisible] = useState(false);

// // //   const [formData, setFormData] = useState({
// // //     className: '',
// // //     directorName: '',
// // //     directorNumber: '',
// // //     address: '',
// // //     contactPersonName: '',
// // //     contactPersonNumber: '',
// // //     studentCount: '',
// // //     classCount: '',
// // //     remark: '',
// // //   });

// // //   const [userLocation, setUserLocation] = useState({
// // //     latitude: 19.076,
// // //     longitude: 72.8777,
// // //   });

// // //   // ─── Connect Socket ────────────────────────
// // //   const connectSocket = useCallback((shiftId: string) => {
// // //     if (socket?.connected) return;

// // //     socket = io(BASE_URL, {
// // //       transports: ['websocket'],
// // //       reconnection: true,
// // //       reconnectionAttempts: 10,
// // //       reconnectionDelay: 2000,
// // //     });

// // //     socket.on('connect', () => {
// // //       console.log('✅ Worker socket connected:', socket?.id);
// // //       // Join shift room so server knows which shift this worker is on
// // //       socket?.emit('join_shift', { shiftId });
// // //     });

// // //     socket.on('disconnect', () => {
// // //       console.log('❌ Worker socket disconnected');
// // //     });
// // //   }, []);

// // //   // ─── Disconnect Socket ─────────────────────
// // //   const disconnectSocket = () => {
// // //     if (socket) {
// // //       socket.disconnect();
// // //       socket = null;
// // //     }
// // //     lastSentLat = null;
// // //     lastSentLng = null;
// // //   };

// // //   // ─── Distance Calculator ───────────────────
// // //   useEffect(() => {
// // //     if (pathCoordinates.length < 2) { setTotalDistance(0); return; }
// // //     let dist = 0;
// // //     for (let i = 0; i < pathCoordinates.length - 1; i++) {
// // //       dist += calculateDistance(
// // //         pathCoordinates[i].latitude, pathCoordinates[i].longitude,
// // //         pathCoordinates[i + 1].latitude, pathCoordinates[i + 1].longitude
// // //       );
// // //     }
// // //     setTotalDistance(dist);
// // //   }, [pathCoordinates]);

// // //   // ─── Fetch Active Shift Path ───────────────
// // //   const fetchCurrentPath = useCallback(async () => {
// // //     try {
// // //       const userId = await AsyncStorage.getItem('userId');
// // //       if (!userId) return;
// // //       const cleanId = userId.replace(/['"]+/g, '');
// // //       const res = await axios.get(`${BASE_URL}/shift/active/${cleanId}`);
// // //       if (res.data?.path?.length) {
// // //         const coords = res.data.path.map((p: any) => ({
// // //           latitude: Number(p.latitude),
// // //           longitude: Number(p.longitude),
// // //         }));
// // //         setPathCoordinates(coords);
// // //       }
// // //     } catch (err) { }
// // //   }, []);

// // //   // ─── Start Background Tracking ─────────────
// // //   const startBackgroundTracking = async () => {
// // //     await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
// // //       accuracy: Location.Accuracy.BestForNavigation, // ✅ Highest accuracy
// // //       timeInterval: 3000,     // Every 3 seconds
// // //       distanceInterval: 10,   // Or every 10 meters
// // //       foregroundService: {
// // //         notificationTitle: "Tracking Active",
// // //         notificationBody: "Your shift location is being recorded.",
// // //         notificationColor: "#007AFF",
// // //       },
// // //     });
// // //   };

// // //   // ─── On Mount: Check Permissions & Active Shift ──
// // //   useEffect(() => {
// // //     (async () => {
// // //       try {
// // //         const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
// // //         if (fgStatus !== 'granted') return;
// // //         await Location.requestBackgroundPermissionsAsync();

// // //         const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
// // //         setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });

// // //         const userId = await AsyncStorage.getItem('userId');
// // //         if (userId) {
// // //           const cleanId = userId.replace(/['"]+/g, '');
// // //           try {
// // //             const res = await axios.get(`${BASE_URL}/shift/active/${cleanId}`);
// // //             if (res.data?.startTime) {
// // //               const shiftId = res.data._id?.toString();
// // //               setShiftStart(new Date(res.data.startTime).getTime());
// // //               setActiveShiftId(shiftId);
// // //               await AsyncStorage.setItem('activeShiftId', shiftId);
// // //               await fetchCurrentPath();
// // //               connectSocket(shiftId);
// // //               const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
// // //               if (!isTracking) await startBackgroundTracking();
// // //             }
// // //           } catch (e) { }
// // //         }
// // //       } catch (err) { }
// // //       finally { setLoading(false); }
// // //     })();

// // //     // Cleanup on unmount
// // //     return () => { disconnectSocket(); };
// // //   }, [fetchCurrentPath, connectSocket]);

// // //   // ─── Timer + Path Sync ─────────────────────
// // //   useEffect(() => {
// // //     if (!shiftStart) return;
// // //     const syncInterval = setInterval(fetchCurrentPath, 8000);
// // //     const timer = setInterval(() => {
// // //       const remaining = SHIFT_DURATION_MS - (Date.now() - shiftStart);
// // //       if (remaining <= 0) {
// // //         clearInterval(timer);
// // //         handleEndShift();
// // //       } else {
// // //         const h = Math.floor(remaining / 3600000);
// // //         const m = Math.floor((remaining % 3600000) / 60000);
// // //         const s = Math.floor((remaining % 60000) / 1000);
// // //         setTimeLeft(`${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`);
// // //       }
// // //     }, 1000);
// // //     return () => { clearInterval(timer); clearInterval(syncInterval); };
// // //   }, [shiftStart, fetchCurrentPath]);

// // //   // ─── Start Shift ───────────────────────────
// // //   const handleStartShift = async () => {
// // //     try {
// // //       setLoading(true);
// // //       const userId = await AsyncStorage.getItem('userId');
// // //       const cleanId = userId?.replace(/['"]+/g, '');
// // //       const res = await axios.post(`${BASE_URL}/shift/start`, { userId: cleanId });

// // //       const shiftId = res.data.shiftId?.toString();
// // //       setShiftStart(new Date(res.data.startTime).getTime());
// // //       setActiveShiftId(shiftId);
// // //       await AsyncStorage.setItem('activeShiftId', shiftId);
// // //       setPathCoordinates([]);
// // //       isEndingShift.current = false;

// // //       // ✅ Connect socket immediately on shift start
// // //       connectSocket(shiftId);
// // //       await startBackgroundTracking();
// // //     } catch (err: any) {
// // //       Alert.alert("Error", "Could not start shift.");
// // //     } finally {
// // //       setLoading(false);
// // //     }
// // //   };

// // //   // ─── End Shift ─────────────────────────────
// // //   const handleEndShift = async () => {
// // //     if (isEndingShift.current) return;
// // //     isEndingShift.current = true;
// // //     try {
// // //       setLoading(true);
// // //       const userId = await AsyncStorage.getItem('userId');
// // //       const cleanId = userId?.replace(/['"]+/g, '');
// // //       await axios.post(`${BASE_URL}/shift/end`, { userId: cleanId });
// // //       if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
// // //         await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
// // //       }
// // //       // ✅ Disconnect socket on shift end
// // //       disconnectSocket();
// // //       await AsyncStorage.removeItem('activeShiftId');
// // //       setShiftStart(null);
// // //       setActiveShiftId(null);
// // //       setPathCoordinates([]);
// // //       setTimeLeft('08:00:00');
// // //       Alert.alert("Shift Ended", `Distance: ${totalDistance.toFixed(2)} km`);
// // //     } catch (err: any) {
// // //       Alert.alert("Error", "Failed to end shift.");
// // //     } finally {
// // //       setLoading(false);
// // //       isEndingShift.current = false;
// // //     }
// // //   };

// // //   // ─── Save Note ─────────────────────────────
// // //   const saveEntryToLog = async () => {
// // //     if (!formData.className.trim()) {
// // //       Alert.alert("Error", "Class Name is required.");
// // //       return;
// // //     }
// // //     try {
// // //       setLoading(true);
// // //       const userId = await AsyncStorage.getItem('userId');
// // //       const loc = await Location.getCurrentPositionAsync({});
// // //       await axios.post(`${BASE_URL}/notes`, {
// // //         userId: userId?.replace(/['"]+/g, ''),
// // //         className: formData.className,
// // //         directorName: formData.directorName,
// // //         directorNumber: formData.directorNumber,
// // //         address: formData.address,
// // //         contactPersonName: formData.contactPersonName,
// // //         contactPersonNumber: formData.contactPersonNumber,
// // //         studentCount: formData.studentCount ? parseInt(formData.studentCount) : 0,
// // //         classCount: formData.classCount ? parseInt(formData.classCount) : 0,
// // //         remark: formData.remark,
// // //         latitude: loc.coords.latitude,
// // //         longitude: loc.coords.longitude,
// // //       });
// // //       setFormData({
// // //         className: '', directorName: '', directorNumber: '',
// // //         address: '', contactPersonName: '', contactPersonNumber: '',
// // //         studentCount: '', classCount: '', remark: '',
// // //       });
// // //       setNoteModalVisible(false);
// // //       Alert.alert("Success", "Entry saved.");
// // //     } catch (err) {
// // //       Alert.alert("Error", "Save failed.");
// // //     } finally {
// // //       setLoading(false);
// // //     }
// // //   };

// // //   if (loading) {
// // //     return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
// // //   }

// // //   return (
// // //     <View style={styles.container}>
// // //       <MapView
// // //         ref={mapRef}
// // //         provider={PROVIDER_GOOGLE}
// // //         style={styles.map}
// // //         initialRegion={{ ...userLocation, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
// // //         showsUserLocation
// // //       >
// // //         {pathCoordinates.length > 1 && (
// // //           <Polyline
// // //             coordinates={pathCoordinates}
// // //             strokeColor="#007AFF"
// // //             strokeWidth={6}
// // //             geodesic={true}
// // //           />
// // //         )}
// // //       </MapView>

// // //       <SafeAreaView style={styles.headerContainer}>
// // //         <View style={styles.glassHeader}>
// // //           <View>
// // //             <Text style={styles.headerLabel}>{shiftStart ? 'ACTIVE SHIFT' : 'OFF DUTY'}</Text>
// // //             <Text style={styles.timerText}>{shiftStart ? timeLeft : '08:00:00'}</Text>
// // //             <View style={styles.statsRow}>
// // //               <Text style={styles.subLabel}>{totalDistance.toFixed(2)} km</Text>
// // //               <Text style={styles.subDivider}>•</Text>
// // //               <Text style={styles.subLabel}>{pathCoordinates.length} points</Text>
// // //               {/* ✅ Socket connection indicator */}
// // //               <Text style={styles.subDivider}>•</Text>
// // //               <View style={[styles.socketDot, { backgroundColor: activeShiftId ? '#4ADE80' : '#F87171' }]} />
// // //               <Text style={styles.subLabel}>{activeShiftId ? 'LIVE' : 'OFF'}</Text>
// // //             </View>
// // //           </View>
// // //           <View style={[styles.statusDot, { backgroundColor: shiftStart ? '#4ADE80' : '#F87171' }]} />
// // //         </View>
// // //       </SafeAreaView>

// // //       <View style={styles.bottomControls}>
// // //         {!shiftStart ? (
// // //           <TouchableOpacity style={styles.mainBtn} onPress={handleStartShift}>
// // //             <Ionicons name="play" size={24} color="white" />
// // //             <Text style={styles.mainBtnText}>Start Tracking</Text>
// // //           </TouchableOpacity>
// // //         ) : (
// // //           <View style={styles.activeRow}>
// // //             <TouchableOpacity style={styles.noteFab} onPress={() => setNoteModalVisible(true)}>
// // //               <Ionicons name="add-circle" size={32} color="white" />
// // //             </TouchableOpacity>
// // //             <TouchableOpacity style={styles.stopBtn} onPress={handleEndShift}>
// // //               <Ionicons name="stop" size={24} color="white" />
// // //               <Text style={styles.mainBtnText}>End Shift</Text>
// // //             </TouchableOpacity>
// // //           </View>
// // //         )}
// // //       </View>

// // //       <Modal visible={isNoteModalVisible} transparent animationType="slide">
// // //         <KeyboardAvoidingView
// // //           behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
// // //           style={styles.modalOverlay}
// // //         >
// // //           <View style={styles.formCard}>
// // //             <View style={styles.formHeader}>
// // //               <Text style={styles.formTitle}>Field Entry Form</Text>
// // //               <TouchableOpacity onPress={() => setNoteModalVisible(false)}>
// // //                 <Ionicons name="close" size={28} color="#A0AEC0" />
// // //               </TouchableOpacity>
// // //             </View>
// // //             <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
// // //               <Text style={styles.inputLabel}>Class Name *</Text>
// // //               <TextInput style={styles.formInput} placeholder="Enter Class Name"
// // //                 value={formData.className} onChangeText={(t) => setFormData({ ...formData, className: t })} />
// // //               <Text style={styles.inputLabel}>Director / Proprietor Name</Text>
// // //               <TextInput style={styles.formInput} placeholder="Name"
// // //                 value={formData.directorName} onChangeText={(t) => setFormData({ ...formData, directorName: t })} />
// // //               <Text style={styles.inputLabel}>Director Phone Number</Text>
// // //               <TextInput style={styles.formInput} placeholder="Phone" keyboardType="phone-pad"
// // //                 value={formData.directorNumber} onChangeText={(t) => setFormData({ ...formData, directorNumber: t })} />
// // //               <Text style={styles.inputLabel}>Address — Class Number</Text>
// // //               <TextInput style={styles.formInput} placeholder="Full Address / Room No"
// // //                 value={formData.address} onChangeText={(t) => setFormData({ ...formData, address: t })} />
// // //               <Text style={styles.inputLabel}>Contact Person Name</Text>
// // //               <TextInput style={styles.formInput} placeholder="Name"
// // //                 value={formData.contactPersonName} onChangeText={(t) => setFormData({ ...formData, contactPersonName: t })} />
// // //               <Text style={styles.inputLabel}>Contact Person Number</Text>
// // //               <TextInput style={styles.formInput} placeholder="Phone" keyboardType="phone-pad"
// // //                 value={formData.contactPersonNumber} onChangeText={(t) => setFormData({ ...formData, contactPersonNumber: t })} />
// // //               <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
// // //                 <View style={{ flex: 1, marginRight: 10 }}>
// // //                   <Text style={styles.inputLabel}>Student Count</Text>
// // //                   <TextInput style={styles.formInput} placeholder="0" keyboardType="numeric"
// // //                     value={formData.studentCount} onChangeText={(t) => setFormData({ ...formData, studentCount: t })} />
// // //                 </View>
// // //                 <View style={{ flex: 1 }}>
// // //                   <Text style={styles.inputLabel}>Class Count</Text>
// // //                   <TextInput style={styles.formInput} placeholder="0" keyboardType="numeric"
// // //                     value={formData.classCount} onChangeText={(t) => setFormData({ ...formData, classCount: t })} />
// // //                 </View>
// // //               </View>
// // //               <Text style={styles.inputLabel}>Remark</Text>
// // //               <TextInput style={[styles.formInput, styles.remarkInput]} placeholder="Any additional remarks..."
// // //                 multiline numberOfLines={3} textAlignVertical="top"
// // //                 value={formData.remark} onChangeText={(t) => setFormData({ ...formData, remark: t })} />
// // //               <TouchableOpacity style={styles.saveToLogBtn} onPress={saveEntryToLog}>
// // //                 <Text style={styles.saveToLogText}>Save to Log</Text>
// // //               </TouchableOpacity>
// // //             </ScrollView>
// // //           </View>
// // //         </KeyboardAvoidingView>
// // //       </Modal>
// // //     </View>
// // //   );
// // // }

// // // const styles = StyleSheet.create({
// // //   container: { flex: 1 },
// // //   map: { ...StyleSheet.absoluteFillObject },
// // //   center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
// // //   headerContainer: { position: 'absolute', top: 50, width: '100%', alignItems: 'center' },
// // //   glassHeader: {
// // //     width: '90%', backgroundColor: 'white', borderRadius: 15,
// // //     padding: 15, flexDirection: 'row', justifyContent: 'space-between',
// // //     alignItems: 'center', elevation: 5,
// // //     shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
// // //     shadowOpacity: 0.1, shadowRadius: 8,
// // //   },
// // //   headerLabel: { fontSize: 10, color: 'gray', letterSpacing: 1 },
// // //   timerText: { fontSize: 26, fontWeight: 'bold' },
// // //   statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
// // //   subLabel: { fontSize: 12, color: '#007AFF', fontWeight: '600' },
// // //   subDivider: { marginHorizontal: 6, color: '#CCC' },
// // //   statusDot: { width: 12, height: 12, borderRadius: 6 },
// // //   socketDot: { width: 8, height: 8, borderRadius: 4, marginRight: 3 },
// // //   bottomControls: { position: 'absolute', bottom: 30, width: '100%', paddingHorizontal: 20 },
// // //   mainBtn: {
// // //     backgroundColor: '#007AFF', padding: 18, borderRadius: 30,
// // //     flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
// // //   },
// // //   activeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
// // //   noteFab: {
// // //     backgroundColor: '#007AFF', width: 60, height: 60,
// // //     borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 4,
// // //   },
// // //   stopBtn: {
// // //     backgroundColor: '#FF3B30', flex: 0.8, height: 60,
// // //     borderRadius: 30, justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
// // //   },
// // //   mainBtnText: { color: 'white', fontWeight: 'bold', fontSize: 18, marginLeft: 10 },
// // //   modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
// // //   formCard: { backgroundColor: 'white', width: '92%', borderRadius: 24, padding: 24, maxHeight: '88%' },
// // //   formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
// // //   formTitle: { fontSize: 22, fontWeight: 'bold', color: '#2D3748' },
// // //   inputLabel: { fontSize: 13, fontWeight: '700', color: '#4A5568', marginTop: 12, marginBottom: 4 },
// // //   formInput: {
// // //     backgroundColor: '#F7F8FA', borderRadius: 12, padding: 12,
// // //     fontSize: 15, color: '#2D3748', borderWidth: 1, borderColor: '#EDF2F7',
// // //   },
// // //   remarkInput: { height: 85, textAlignVertical: 'top' },
// // //   saveToLogBtn: { backgroundColor: '#007AFF', borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 25 },
// // //   saveToLogText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
// // // });



// // import React, { useEffect, useRef, useState, useCallback } from 'react';
// // import {
// //   View, Text, StyleSheet, TouchableOpacity, Alert,
// //   Animated, Easing, Platform, AppState, Modal,
// //   TextInput, ScrollView, KeyboardAvoidingView, SafeAreaView
// // } from 'react-native';
// // import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
// // import * as Location from 'expo-location';
// // import * as TaskManager from 'expo-task-manager';
// // import AsyncStorage from '@react-native-async-storage/async-storage';
// // import { Ionicons } from '@expo/vector-icons';
// // import axios from 'axios';
// // import { io, Socket } from 'socket.io-client';
// // import { BASE_URL } from '../../services/api';

// // // ── Constants ─────────────────────────────────────────────────────────────────
// // const LOCATION_TASK = 'bg-location-task';
// // const SHIFT_MS = 8 * 60 * 60 * 1000;
// // const MIN_METERS = 8; // filter GPS drift
// // const SOCKET_URL = BASE_URL.replace('/api', '');

// // // ── Uber-style dark map ───────────────────────────────────────────────────────
// // const DARK_MAP = [
// //   { elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
// //   { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
// //   { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1117' }] },
// //   { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1c2333' }] },
// //   { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1e3a5f' }] },
// //   { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#0066cc' }] },
// //   { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1a2332' }] },
// //   { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1628' }] },
// //   { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#111827' }] },
// //   { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f1f0f' }] },
// //   { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#111827' }] },
// //   { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
// //   { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
// //   { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#4b5563' }] },
// // ];

// // // ── Haversine ─────────────────────────────────────────────────────────────────
// // const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
// //   const R = 6371000;
// //   const dLat = (lat2 - lat1) * Math.PI / 180;
// //   const dLon = (lon2 - lon1) * Math.PI / 180;
// //   const a = Math.sin(dLat / 2) ** 2 +
// //     Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
// //   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// // };

// // // ── Module-level socket & last-sent coords ────────────────────────────────────
// // let socket: Socket | null = null;
// // let lastLat: number | null = null;
// // let lastLng: number | null = null;

// // // ── Background task ───────────────────────────────────────────────────────────
// // TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
// //   if (error || !data?.locations?.length) return;
// //   try {
// //     const { latitude, longitude } = data.locations[0].coords;
// //     if (lastLat !== null && lastLng !== null) {
// //       if (haversineMeters(lastLat, lastLng, latitude, longitude) < MIN_METERS) return;
// //     }
// //     const rawId = await AsyncStorage.getItem('userId');
// //     const shiftId = await AsyncStorage.getItem('activeShiftId');
// //     if (!rawId) return;
// //     const userId = rawId.replace(/['"]+/g, '').trim();
// //     lastLat = latitude; lastLng = longitude;

// //     if (socket?.connected && shiftId) {
// //       socket.emit('location_update', { userId, shiftId, latitude, longitude });
// //     } else {
// //       await axios.post(`${BASE_URL}/track`, { userId, latitude, longitude });
// //     }
// //   } catch (e: any) { console.log('BG task error:', e.message); }
// // });

// // // ─────────────────────────────────────────────────────────────────────────────
// // export default function FieldDashboard() {
// //   const mapRef = useRef<MapView>(null);
// //   const isEndingRef = useRef(false);
// //   const cameraFollowRef = useRef(true);

// //   // State
// //   const [userId, setUserId] = useState('');
// //   const [shiftId, setShiftId] = useState<string | null>(null);
// //   const [shiftStart, setShiftStart] = useState<number | null>(null);
// //   const [timeLeft, setTimeLeft] = useState('08:00:00');
// //   const [location, setLocation] = useState({ latitude: 19.076, longitude: 72.8777 });
// //   const [heading, setHeading] = useState(0);
// //   const [speed, setSpeed] = useState(0);
// //   const [accuracy, setAccuracy] = useState(0);
// //   const [path, setPath] = useState<{ latitude: number; longitude: number }[]>([]);
// //   const [distanceKm, setDistanceKm] = useState(0);
// //   const [loading, setLoading] = useState(true);
// //   const [noteModal, setNoteModal] = useState(false);
// //   const [form, setForm] = useState({
// //     className: '', directorName: '', directorNumber: '',
// //     address: '', contactPersonName: '', contactPersonNumber: '',
// //     studentCount: '', classCount: '', remark: '',
// //   });

// //   // Animations
// //   const pulseRing = useRef(new Animated.Value(0)).current;
// //   const pulseOpacity = useRef(new Animated.Value(1)).current;
// //   const markerScale = useRef(new Animated.Value(1)).current;
// //   const headerAnim = useRef(new Animated.Value(0)).current;
// //   const fabAnim = useRef(new Animated.Value(0)).current;

// //   // ── Pulse animation (active tracking ring) ──
// //   const startPulse = useCallback(() => {
// //     Animated.loop(
// //       Animated.parallel([
// //         Animated.timing(pulseRing, {
// //           toValue: 1, duration: 1500,
// //           easing: Easing.out(Easing.ease), useNativeDriver: true,
// //         }),
// //         Animated.sequence([
// //           Animated.timing(pulseOpacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
// //           Animated.timing(pulseOpacity, { toValue: 1, duration: 0, useNativeDriver: true }),
// //         ]),
// //       ])
// //     ).start();
// //   }, []);

// //   // ── Bounce marker when location updates ──
// //   const bounceMarker = () => {
// //     Animated.sequence([
// //       Animated.timing(markerScale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
// //       Animated.spring(markerScale, { toValue: 1, friction: 4, useNativeDriver: true }),
// //     ]).start();
// //   };

// //   // ── Connect socket ──
// //   const connectSocket = useCallback((sId: string) => {
// //     if (socket?.connected) return;
// //     socket = io(SOCKET_URL, {
// //       transports: ['websocket'],
// //       reconnection: true,
// //       reconnectionAttempts: 15,
// //       reconnectionDelay: 2000,
// //     });
// //     socket.on('connect', () => {
// //       console.log('✅ Socket connected');
// //       socket?.emit('join_shift', { shiftId: sId });
// //     });
// //     socket.on('disconnect', () => console.log('❌ Socket disconnected'));
// //   }, []);

// //   const disconnectSocket = () => {
// //     socket?.disconnect();
// //     socket = null;
// //     lastLat = null; lastLng = null;
// //   };

// //   // ── Start background location ──
// //   const startBgTracking = async () => {
// //     const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
// //     if (isRunning) return;
// //     await Location.startLocationUpdatesAsync(LOCATION_TASK, {
// //       accuracy: Location.Accuracy.BestForNavigation,
// //       timeInterval: 3000,
// //       distanceInterval: MIN_METERS,
// //       foregroundService: {
// //         notificationTitle: '📍 Shift Tracking Active',
// //         notificationBody: 'Your location is being recorded.',
// //         notificationColor: '#007AFF',
// //       },
// //       pausesUpdatesAutomatically: false,
// //       activityType: Location.ActivityType.AutomotiveNavigation,
// //       showsBackgroundLocationIndicator: true, // iOS blue bar
// //     });
// //   };

// //   // ── Foreground watcher (for live UI updates) ──
// //   const fgWatcherRef = useRef<Location.LocationSubscription | null>(null);

// //   const startFgWatcher = useCallback((sId: string, uid: string) => {
// //     Location.watchPositionAsync(
// //       {
// //         accuracy: Location.Accuracy.BestForNavigation,
// //         timeInterval: 2000,
// //         distanceInterval: 5,
// //       },
// //       (loc) => {
// //         const { latitude, longitude, heading: hdg, speed: spd, accuracy: acc } = loc.coords;

// //         setLocation({ latitude, longitude });
// //         setHeading(hdg ?? 0);
// //         setSpeed(Math.round((spd ?? 0) * 3.6)); // m/s → km/h
// //         setAccuracy(Math.round(acc ?? 0));
// //         bounceMarker();

// //         // Update path + distance
// //         setPath(prev => {
// //           if (prev.length > 0) {
// //             const last = prev[prev.length - 1];
// //             const d = haversineMeters(last.latitude, last.longitude, latitude, longitude);
// //             if (d < MIN_METERS) return prev;
// //             setDistanceKm(km => km + d / 1000);
// //           }
// //           return [...prev, { latitude, longitude }];
// //         });

// //         // Emit via socket
// //         if (socket?.connected) {
// //           socket.emit('location_update', { userId: uid, shiftId: sId, latitude, longitude });
// //         }

// //         // 3D camera follow — Uber style
// //         if (cameraFollowRef.current) {
// //           mapRef.current?.animateCamera({
// //             center: { latitude, longitude },
// //             heading: hdg ?? 0,
// //             pitch: 55,
// //             zoom: 18,
// //           }, { duration: 800 });
// //         }
// //       }
// //     ).then(sub => { fgWatcherRef.current = sub; });
// //   }, []);

// //   // ── Load user & check active shift on mount ──
// //   useEffect(() => {
// //     (async () => {
// //       try {
// //         const { status } = await Location.requestForegroundPermissionsAsync();
// //         if (status !== 'granted') {
// //           Alert.alert('Permission Required', 'Enable location to use tracking.');
// //           return;
// //         }
// //         await Location.requestBackgroundPermissionsAsync();

// //         const raw = await AsyncStorage.getItem('userId');
// //         if (!raw) return;
// //         const uid = raw.replace(/['"]+/g, '').trim();
// //         setUserId(uid);

// //         // Get current position immediately
// //         const loc = await Location.getCurrentPositionAsync({
// //           accuracy: Location.Accuracy.High,
// //         });
// //         setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });

// //         // Check for active shift
// //         const res = await axios.get(`${BASE_URL}/shift/active/${uid}`);
// //         if (res.data?.startTime) {
// //           const sId = res.data._id.toString();
// //           setShiftId(sId);
// //           setShiftStart(new Date(res.data.startTime).getTime());
// //           await AsyncStorage.setItem('activeShiftId', sId);

// //           // Restore path
// //           if (res.data.path?.length) {
// //             const coords = res.data.path.map((p: any) => ({
// //               latitude: Number(p.latitude), longitude: Number(p.longitude),
// //             }));
// //             setPath(coords);
// //           }

// //           connectSocket(sId);
// //           await startBgTracking();
// //           startFgWatcher(sId, uid);
// //           startPulse();

// //           // Animate header in
// //           Animated.spring(headerAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
// //           Animated.spring(fabAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
// //         }
// //       } catch (_) {}
// //       finally { setLoading(false); }
// //     })();

// //     return () => {
// //       fgWatcherRef.current?.remove();
// //       disconnectSocket();
// //     };
// //   }, []);

// //   // ── Shift countdown timer ──
// //   useEffect(() => {
// //     if (!shiftStart) return;
// //     const t = setInterval(() => {
// //       const rem = SHIFT_MS - (Date.now() - shiftStart);
// //       if (rem <= 0) { handleEndShift(); return; }
// //       const h = Math.floor(rem / 3600000);
// //       const m = Math.floor((rem % 3600000) / 60000);
// //       const s = Math.floor((rem % 60000) / 1000);
// //       setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
// //     }, 1000);
// //     return () => clearInterval(t);
// //   }, [shiftStart]);

// //   // ── Start Shift ──
// //   const handleStartShift = async () => {
// //     try {
// //       setLoading(true);
// //       const res = await axios.post(`${BASE_URL}/shift/start`, { userId });
// //       const sId = res.data.shiftId.toString();
// //       setShiftId(sId);
// //       setShiftStart(new Date(res.data.startTime).getTime());
// //       setPath([]); setDistanceKm(0);
// //       await AsyncStorage.setItem('activeShiftId', sId);
// //       isEndingRef.current = false;

// //       connectSocket(sId);
// //       await startBgTracking();
// //       startFgWatcher(sId, userId);
// //       startPulse();

// //       Animated.spring(headerAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
// //       Animated.spring(fabAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
// //     } catch {
// //       Alert.alert('Error', 'Could not start shift.');
// //     } finally { setLoading(false); }
// //   };

// //   // ── End Shift ──
// //   const handleEndShift = () => {
// //     if (isEndingRef.current) return;
// //     Alert.alert('End Shift', 'Are you sure you want to end your shift?', [
// //       { text: 'Cancel', style: 'cancel' },
// //       {
// //         text: 'End Shift', style: 'destructive',
// //         onPress: async () => {
// //           isEndingRef.current = true;
// //           setLoading(true);
// //           try {
// //             await axios.post(`${BASE_URL}/shift/end`, { userId });
// //             fgWatcherRef.current?.remove();
// //             const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
// //             if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
// //             disconnectSocket();
// //             await AsyncStorage.removeItem('activeShiftId');
// //             setShiftId(null); setShiftStart(null);
// //             setPath([]); setDistanceKm(0); setTimeLeft('08:00:00');
// //             pulseRing.stopAnimation(); pulseOpacity.stopAnimation();
// //             headerAnim.setValue(0); fabAnim.setValue(0);
// //           } catch { Alert.alert('Error', 'Failed to end shift.'); }
// //           finally { setLoading(false); isEndingRef.current = false; }
// //         }
// //       }
// //     ]);
// //   };

// //   // ── Save note ──
// //   const saveNote = async () => {
// //     if (!form.className.trim()) { Alert.alert('Error', 'Class Name is required.'); return; }
// //     try {
// //       setLoading(true);
// //       const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
// //       await axios.post(`${BASE_URL}/notes`, {
// //         userId,
// //         ...form,
// //         studentCount: form.studentCount ? parseInt(form.studentCount) : 0,
// //         classCount: form.classCount ? parseInt(form.classCount) : 0,
// //         latitude: loc.coords.latitude,
// //         longitude: loc.coords.longitude,
// //       });
// //       setForm({ className: '', directorName: '', directorNumber: '', address: '', contactPersonName: '', contactPersonNumber: '', studentCount: '', classCount: '', remark: '' });
// //       setNoteModal(false);
// //       Alert.alert('✅ Saved', 'Entry recorded successfully.');
// //     } catch { Alert.alert('Error', 'Save failed.'); }
// //     finally { setLoading(false); }
// //   };

// //   const pulseScale = pulseRing.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
// //   const isActive = !!shiftStart;

// //   return (
// //     <View style={s.container}>

// //       {/* ── 3D Dark Map ── */}
// //       <MapView
// //         ref={mapRef}
// //         style={StyleSheet.absoluteFillObject}
// //         provider={PROVIDER_GOOGLE}
// //         customMapStyle={DARK_MAP}
// //         initialRegion={{ ...location, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
// //         pitchEnabled rotateEnabled showsBuildings showsTraffic
// //         showsCompass={false} showsMyLocationButton={false}
// //         mapPadding={{ top: 0, right: 0, bottom: 220, left: 0 }}
// //         onPanDrag={() => { cameraFollowRef.current = false; }}
// //       >
// //         {/* Route trail */}
// //         {path.length > 1 && (
// //           <Polyline
// //             coordinates={path}
// //             strokeColor="#007AFF"
// //             strokeWidth={5}
// //             geodesic
// //             lineCap="round"
// //             lineJoin="round"
// //           />
// //         )}

// //         {/* Animated marker */}
// //         {isActive && (
// //           <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }} flat tracksViewChanges>
// //             <View style={s.markerWrapper}>
// //               {/* Pulse ring */}
// //               <Animated.View style={[s.pulseRing, {
// //                 transform: [{ scale: pulseScale }],
// //                 opacity: pulseOpacity,
// //               }]} />
// //               {/* Marker dot */}
// //               <Animated.View style={[s.markerDot, { transform: [{ scale: markerScale }] }]}>
// //                 <View style={s.markerCore} />
// //                 <View style={s.markerArrow} />
// //               </Animated.View>
// //             </View>
// //           </Marker>
// //         )}
// //       </MapView>

// //       {/* ── Recenter button ── */}
// //       <TouchableOpacity
// //         style={s.recenterBtn}
// //         onPress={() => {
// //           cameraFollowRef.current = true;
// //           mapRef.current?.animateCamera({
// //             center: location, heading, pitch: 55, zoom: 18,
// //           }, { duration: 600 });
// //         }}
// //       >
// //         <Ionicons name="navigate" size={22} color="#007AFF" />
// //       </TouchableOpacity>

// //       {/* ── Top HUD (shown when shift active) ── */}
// //       <Animated.View style={[s.hud, {
// //         opacity: headerAnim,
// //         transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }]
// //       }]}>
// //         <SafeAreaView>
// //           <View style={s.hudInner}>
// //             <View style={s.hudLeft}>
// //               <View style={s.liveBadge}>
// //                 <Animated.View style={[s.liveDot, { opacity: pulseOpacity }]} />
// //                 <Text style={s.liveText}>LIVE</Text>
// //               </View>
// //               <Text style={s.timerText}>{timeLeft}</Text>
// //               <Text style={s.hudSub}>
// //                 {distanceKm.toFixed(2)} km  ·  {path.length} pts  ·  {speed} km/h
// //               </Text>
// //             </View>
// //             <View style={s.hudRight}>
// //               <Text style={s.accuracyText}>±{accuracy}m</Text>
// //               <View style={[s.signalDot, { backgroundColor: accuracy < 15 ? '#4ADE80' : accuracy < 40 ? '#FACC15' : '#F87171' }]} />
// //             </View>
// //           </View>
// //         </SafeAreaView>
// //       </Animated.View>

// //       {/* ── Bottom Controls ── */}
// //       <View style={s.bottom}>
// //         {!isActive ? (
// //           <TouchableOpacity style={s.startBtn} onPress={handleStartShift} activeOpacity={0.85}>
// //             <Ionicons name="radio-button-on" size={22} color="#fff" style={{ marginRight: 10 }} />
// //             <Text style={s.startBtnText}>Start Shift</Text>
// //           </TouchableOpacity>
// //         ) : (
// //           <Animated.View style={[s.activeRow, {
// //             opacity: fabAnim,
// //             transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }]
// //           }]}>
// //             {/* Note FAB */}
// //             <TouchableOpacity style={s.noteFab} onPress={() => setNoteModal(true)} activeOpacity={0.85}>
// //               <Ionicons name="add" size={30} color="#fff" />
// //             </TouchableOpacity>

// //             {/* End shift */}
// //             <TouchableOpacity style={s.endBtn} onPress={handleEndShift} activeOpacity={0.85}>
// //               <Ionicons name="stop-circle" size={22} color="#fff" style={{ marginRight: 8 }} />
// //               <Text style={s.endBtnText}>End Shift</Text>
// //             </TouchableOpacity>
// //           </Animated.View>
// //         )}
// //       </View>

// //       {/* ── Note Modal ── */}
// //       <Modal visible={noteModal} transparent animationType="slide">
// //         <KeyboardAvoidingView
// //           behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
// //           style={s.modalOverlay}
// //         >
// //           <View style={s.sheet}>
// //             <View style={s.sheetHandle} />
// //             <View style={s.sheetHeader}>
// //               <Text style={s.sheetTitle}>Field Entry</Text>
// //               <TouchableOpacity onPress={() => setNoteModal(false)}>
// //                 <Ionicons name="close-circle" size={28} color="#6b7280" />
// //               </TouchableOpacity>
// //             </View>
// //             <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
// //               {[
// //                 { label: 'Class Name *', key: 'className', placeholder: 'Enter class name' },
// //                 { label: 'Director / Proprietor Name', key: 'directorName', placeholder: 'Name' },
// //                 { label: 'Director Phone', key: 'directorNumber', placeholder: 'Phone', keyboard: 'phone-pad' },
// //                 { label: 'Address', key: 'address', placeholder: 'Full address' },
// //                 { label: 'Contact Person Name', key: 'contactPersonName', placeholder: 'Name' },
// //                 { label: 'Contact Person Phone', key: 'contactPersonNumber', placeholder: 'Phone', keyboard: 'phone-pad' },
// //               ].map(({ label, key, placeholder, keyboard }: any) => (
// //                 <View key={key}>
// //                   <Text style={s.inputLabel}>{label}</Text>
// //                   <TextInput
// //                     style={s.input}
// //                     placeholder={placeholder}
// //                     placeholderTextColor="#9ca3af"
// //                     keyboardType={keyboard || 'default'}
// //                     value={(form as any)[key]}
// //                     onChangeText={t => setForm(f => ({ ...f, [key]: t }))}
// //                   />
// //                 </View>
// //               ))}
// //               <View style={{ flexDirection: 'row', gap: 12 }}>
// //                 {[{ label: 'Student Count', key: 'studentCount' }, { label: 'Class Count', key: 'classCount' }].map(({ label, key }) => (
// //                   <View key={key} style={{ flex: 1 }}>
// //                     <Text style={s.inputLabel}>{label}</Text>
// //                     <TextInput
// //                       style={s.input}
// //                       placeholder="0"
// //                       placeholderTextColor="#9ca3af"
// //                       keyboardType="numeric"
// //                       value={(form as any)[key]}
// //                       onChangeText={t => setForm(f => ({ ...f, [key]: t }))}
// //                     />
// //                   </View>
// //                 ))}
// //               </View>
// //               <Text style={s.inputLabel}>Remark</Text>
// //               <TextInput
// //                 style={[s.input, { height: 80, textAlignVertical: 'top' }]}
// //                 placeholder="Any remarks..."
// //                 placeholderTextColor="#9ca3af"
// //                 multiline
// //                 value={form.remark}
// //                 onChangeText={t => setForm(f => ({ ...f, remark: t }))}
// //               />
// //               <TouchableOpacity style={s.saveBtn} onPress={saveNote} activeOpacity={0.85}>
// //                 <Text style={s.saveBtnText}>Save Entry</Text>
// //               </TouchableOpacity>
// //             </ScrollView>
// //           </View>
// //         </KeyboardAvoidingView>
// //       </Modal>
// //     </View>
// //   );
// // }

// // // ── Styles ────────────────────────────────────────────────────────────────────
// // const s = StyleSheet.create({
// //   container: { flex: 1, backgroundColor: '#0d1117' },

// //   // Map marker
// //   markerWrapper: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
// //   pulseRing: {
// //     position: 'absolute', width: 24, height: 24, borderRadius: 12,
// //     backgroundColor: 'rgba(0,122,255,0.3)', borderWidth: 1, borderColor: 'rgba(0,122,255,0.5)',
// //   },
// //   markerDot: {
// //     width: 24, height: 24, borderRadius: 12,
// //     backgroundColor: '#007AFF',
// //     borderWidth: 3, borderColor: '#fff',
// //     elevation: 6,
// //     shadowColor: '#007AFF', shadowOffset: { width: 0, height: 0 },
// //     shadowOpacity: 0.8, shadowRadius: 8,
// //     alignItems: 'center', justifyContent: 'center',
// //   },
// //   markerCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
// //   markerArrow: {
// //     position: 'absolute', bottom: -6,
// //     width: 0, height: 0,
// //     borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8,
// //     borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#007AFF',
// //   },

// //   // Recenter
// //   recenterBtn: {
// //     position: 'absolute', right: 16, bottom: 240,
// //     width: 46, height: 46, borderRadius: 23,
// //     backgroundColor: '#1c2333',
// //     alignItems: 'center', justifyContent: 'center',
// //     elevation: 6,
// //     shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
// //     shadowOpacity: 0.4, shadowRadius: 6,
// //     borderWidth: 1, borderColor: '#2d3748',
// //   },

// //   // HUD
// //   hud: {
// //     position: 'absolute', top: 0, left: 0, right: 0,
// //     backgroundColor: 'rgba(13,17,23,0.88)',
// //     borderBottomWidth: 1, borderBottomColor: '#1c2333',
// //     paddingHorizontal: 20, paddingBottom: 14,
// //   },
// //   hudInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
// //   hudLeft: { flex: 1 },
// //   hudRight: { alignItems: 'flex-end' },
// //   liveBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
// //   liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#4ADE80', marginRight: 6 },
// //   liveText: { fontSize: 10, fontWeight: '800', color: '#4ADE80', letterSpacing: 1.5 },
// //   timerText: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1, fontVariant: ['tabular-nums'] },
// //   hudSub: { fontSize: 12, color: '#6b7280', marginTop: 2, fontWeight: '600' },
// //   accuracyText: { fontSize: 12, color: '#6b7280', fontWeight: '700' },
// //   signalDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, alignSelf: 'flex-end' },

// //   // Bottom
// //   bottom: {
// //     position: 'absolute', bottom: 0, left: 0, right: 0,
// //     paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
// //     paddingTop: 16,
// //     backgroundColor: 'rgba(13,17,23,0.92)',
// //     borderTopWidth: 1, borderTopColor: '#1c2333',
// //   },
// //   startBtn: {
// //     backgroundColor: '#007AFF', borderRadius: 18, height: 60,
// //     flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
// //     elevation: 6,
// //     shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 },
// //     shadowOpacity: 0.5, shadowRadius: 12,
// //   },
// //   startBtnText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
// //   activeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
// //   noteFab: {
// //     width: 60, height: 60, borderRadius: 30,
// //     backgroundColor: '#1d4ed8', alignItems: 'center', justifyContent: 'center',
// //     elevation: 6,
// //     shadowColor: '#1d4ed8', shadowOffset: { width: 0, height: 4 },
// //     shadowOpacity: 0.5, shadowRadius: 12,
// //   },
// //   endBtn: {
// //     flex: 1, height: 60, borderRadius: 18,
// //     backgroundColor: '#dc2626', flexDirection: 'row',
// //     alignItems: 'center', justifyContent: 'center',
// //     elevation: 6,
// //     shadowColor: '#dc2626', shadowOffset: { width: 0, height: 4 },
// //     shadowOpacity: 0.4, shadowRadius: 12,
// //   },
// //   endBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },

// //   // Modal / Sheet
// //   modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
// //   sheet: {
// //     backgroundColor: '#111827', borderTopLeftRadius: 28, borderTopRightRadius: 28,
// //     paddingHorizontal: 20, paddingTop: 12, maxHeight: '90%',
// //     borderWidth: 1, borderColor: '#1f2937',
// //   },
// //   sheetHandle: {
// //     width: 40, height: 4, borderRadius: 2,
// //     backgroundColor: '#374151', alignSelf: 'center', marginBottom: 16,
// //   },
// //   sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
// //   sheetTitle: { fontSize: 22, fontWeight: '800', color: '#f9fafb' },
// //   inputLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginTop: 14, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
// //   input: {
// //     backgroundColor: '#1f2937', borderRadius: 12, padding: 14,
// //     fontSize: 15, color: '#f9fafb', borderWidth: 1, borderColor: '#374151',
// //   },
// //   saveBtn: {
// //     backgroundColor: '#007AFF', borderRadius: 16, height: 56,
// //     alignItems: 'center', justifyContent: 'center', marginTop: 24,
// //     shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 },
// //     shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
// //   },
// //   saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
// // });

// import React, { useEffect, useRef, useState, useCallback } from 'react';
// import {
//   View, Text, StyleSheet, TouchableOpacity, Alert,
//   Animated, Easing, Platform, Modal,
//   TextInput, ScrollView, KeyboardAvoidingView, SafeAreaView
// } from 'react-native';
// import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
// import * as Location from 'expo-location';
// import * as TaskManager from 'expo-task-manager';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { Ionicons } from '@expo/vector-icons';
// import axios from 'axios';
// import { io, Socket } from 'socket.io-client';
// import { BASE_URL } from '../../services/api';

// // ── Constants ─────────────────────────────────────────────────────────────────
// const LOCATION_TASK = 'bg-location-task';
// const SHIFT_MS = 8 * 60 * 60 * 1000;

// // ✅ ACCURACY FILTER — ignore fixes worse than this (meters)
// const MAX_ACCURACY_METERS = 30;

// // ✅ SMART DISTANCE FILTER — ignore movement smaller than this (meters)
// const MIN_DISTANCE_METERS = 6;

// // ✅ SPEED FILTER — ignore teleportation jumps (km/h)
// const MAX_SPEED_KMH = 200;

// // ✅ SOCKET throttle — emit at most once per N ms to avoid flooding
// const SOCKET_THROTTLE_MS = 1500;

// const SOCKET_URL = BASE_URL.replace('/api', '');

// // ── Clean Light Map style ─────────────────────────────────────────────────────
// const LIGHT_MAP = [
//   { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
//   { elementType: 'labels.text.fill', stylers: [{ color: '#333333' }] },
//   { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
//   { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
//   { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e0e0e0' }] },
//   { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
//   { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#bdbdbd' }] },
//   { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fafafa' }] },
//   { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9dff0' }] },
//   { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e8f5e9' }] },
//   { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d0eac8' }] },
//   { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
//   { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#e0e0e0' }] },
//   { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
//   { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#777777' }] },
//   { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#eef2eb' }] },
// ];

// // ── Haversine ─────────────────────────────────────────────────────────────────
// const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
//   const R = 6371000;
//   const dLat = (lat2 - lat1) * Math.PI / 180;
//   const dLon = (lon2 - lon1) * Math.PI / 180;
//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// };

// // ✅ SMOOTH LOCATION — Kalman-style exponential moving average
// class LocationSmoother {
//   private smoothLat: number | null = null;
//   private smoothLng: number | null = null;
//   private readonly alpha = 0.25; // lower = smoother, higher = more responsive

//   smooth(lat: number, lng: number): { latitude: number; longitude: number } {
//     if (this.smoothLat === null || this.smoothLng === null) {
//       this.smoothLat = lat;
//       this.smoothLng = lng;
//     } else {
//       this.smoothLat = this.alpha * lat + (1 - this.alpha) * this.smoothLat;
//       this.smoothLng = this.alpha * lng + (1 - this.alpha) * this.smoothLng;
//     }
//     return { latitude: this.smoothLat, longitude: this.smoothLng };
//   }

//   reset() {
//     this.smoothLat = null;
//     this.smoothLng = null;
//   }
// }

// // ── Module-level state ────────────────────────────────────────────────────────
// let socket: Socket | null = null;
// let lastLat: number | null = null;
// let lastLng: number | null = null;
// let lastSocketEmit = 0;
// const smoother = new LocationSmoother();

// // ── Background task ───────────────────────────────────────────────────────────
// TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
//   if (error || !data?.locations?.length) return;
//   try {
//     const loc = data.locations[0];
//     const { latitude, longitude, accuracy, speed } = loc.coords;

//     // ✅ Accuracy filter
//     if (accuracy && accuracy > MAX_ACCURACY_METERS) return;

//     // ✅ Speed filter (impossible jump)
//     if (speed && speed * 3.6 > MAX_SPEED_KMH) return;

//     // ✅ Distance filter
//     if (lastLat !== null && lastLng !== null) {
//       if (haversineMeters(lastLat, lastLng, latitude, longitude) < MIN_DISTANCE_METERS) return;
//     }

//     const rawId = await AsyncStorage.getItem('userId');
//     const shiftId = await AsyncStorage.getItem('activeShiftId');
//     if (!rawId) return;
//     const userId = rawId.replace(/['"]+/g, '').trim();

//     lastLat = latitude;
//     lastLng = longitude;

//     // ✅ Socket throttle
//     const now = Date.now();
//     if (socket?.connected && shiftId && now - lastSocketEmit >= SOCKET_THROTTLE_MS) {
//       lastSocketEmit = now;
//       socket.emit('location_update', { userId, shiftId, latitude, longitude, accuracy });
//     } else {
//       await axios.post(`${BASE_URL}/track`, { userId, latitude, longitude, accuracy });
//     }
//   } catch (e: any) {
//     console.log('BG task error:', e.message);
//   }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// export default function FieldDashboard() {
//   const mapRef = useRef<MapView>(null);
//   const isEndingRef = useRef(false);
//   const cameraFollowRef = useRef(true);
//   const lastSocketEmitRef = useRef(0);

//   // State
//   const [userId, setUserId] = useState('');
//   const [shiftId, setShiftId] = useState<string | null>(null);
//   const [shiftStart, setShiftStart] = useState<number | null>(null);
//   const [timeLeft, setTimeLeft] = useState('08:00:00');
//   const [location, setLocation] = useState({ latitude: 19.076, longitude: 72.8777 });
//   const [heading, setHeading] = useState(0);
//   const [speed, setSpeed] = useState(0);
//   const [accuracy, setAccuracy] = useState(0);
//   const [path, setPath] = useState<{ latitude: number; longitude: number }[]>([]);
//   const [distanceKm, setDistanceKm] = useState(0);
//   const [loading, setLoading] = useState(true);
//   const [noteModal, setNoteModal] = useState(false);
//   const [gpsPermission, setGpsPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
//   const [form, setForm] = useState({
//     className: '', directorName: '', directorNumber: '',
//     address: '', contactPersonName: '', contactPersonNumber: '',
//     studentCount: '', classCount: '', remark: '',
//   });

//   // Animations
//   const pulseRing = useRef(new Animated.Value(0)).current;
//   const pulseOpacity = useRef(new Animated.Value(1)).current;
//   const markerScale = useRef(new Animated.Value(1)).current;
//   const headerAnim = useRef(new Animated.Value(0)).current;
//   const fabAnim = useRef(new Animated.Value(0)).current;
//   const markerBeat = useRef(new Animated.Value(1)).current;

//   // ── Pulse animation ──
//   const startPulse = useCallback(() => {
//     Animated.loop(
//       Animated.parallel([
//         Animated.timing(pulseRing, {
//           toValue: 1, duration: 2000,
//           easing: Easing.out(Easing.ease), useNativeDriver: true,
//         }),
//         Animated.sequence([
//           Animated.timing(pulseOpacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
//           Animated.timing(pulseOpacity, { toValue: 1, duration: 0, useNativeDriver: true }),
//         ]),
//       ])
//     ).start();

//     // ✅ Small heartbeat on the core dot
//     Animated.loop(
//       Animated.sequence([
//         Animated.timing(markerBeat, { toValue: 1.25, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
//         Animated.timing(markerBeat, { toValue: 1, duration: 600, easing: Easing.in(Easing.ease), useNativeDriver: true }),
//       ])
//     ).start();
//   }, []);

//   // ── Bounce marker ──
//   const bounceMarker = () => {
//     Animated.sequence([
//       Animated.timing(markerScale, { toValue: 1.35, duration: 120, useNativeDriver: true }),
//       Animated.spring(markerScale, { toValue: 1, friction: 5, useNativeDriver: true }),
//     ]).start();
//   };

//   // ── Socket ──
//   const connectSocket = useCallback((sId: string) => {
//     if (socket?.connected) return;
//     socket = io(SOCKET_URL, {
//       transports: ['websocket'],
//       reconnection: true,
//       reconnectionAttempts: 20,
//       reconnectionDelay: 1500,
//       timeout: 10000,
//     });
//     socket.on('connect', () => {
//       console.log('✅ Socket connected');
//       socket?.emit('join_shift', { shiftId: sId });
//     });
//     socket.on('disconnect', (reason) => console.log('❌ Socket disconnected:', reason));
//     socket.on('connect_error', (err) => console.log('Socket error:', err.message));
//   }, []);

//   const disconnectSocket = () => {
//     socket?.disconnect();
//     socket = null;
//     lastLat = null;
//     lastLng = null;
//     smoother.reset();
//   };

//   // ── Background tracking ──
//   const startBgTracking = async () => {
//     const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
//     if (isRunning) return;
//     await Location.startLocationUpdatesAsync(LOCATION_TASK, {
//       // ✅ BETTER GPS SETTINGS
//       accuracy: Location.Accuracy.BestForNavigation,
//       timeInterval: 3000,
//       distanceInterval: MIN_DISTANCE_METERS,
//       foregroundService: {
//         notificationTitle: '📍 Shift Tracking Active',
//         notificationBody: 'Your location is being recorded.',
//         notificationColor: '#2563EB',
//       },
//       pausesUpdatesAutomatically: false,
//       activityType: Location.ActivityType.AutomotiveNavigation,
//       showsBackgroundLocationIndicator: true,
//       deferredUpdatesInterval: 0,
//       deferredUpdatesDistance: 0,
//     });
//   };

//   // ── Foreground watcher ──
//   const fgWatcherRef = useRef<Location.LocationSubscription | null>(null);
//   const lastFgLat = useRef<number | null>(null);
//   const lastFgLng = useRef<number | null>(null);

//   const startFgWatcher = useCallback((sId: string, uid: string) => {
//     Location.watchPositionAsync(
//       {
//         // ✅ BEST GPS SETTINGS for foreground
//         accuracy: Location.Accuracy.BestForNavigation,
//         timeInterval: 1500,
//         distanceInterval: 3,
//         mayShowUserSettingsDialog: true,
//       },
//       (loc) => {
//         const { latitude: rawLat, longitude: rawLng, heading: hdg, speed: spd, accuracy: acc } = loc.coords;

//         // ✅ Accuracy filter
//         if (acc && acc > MAX_ACCURACY_METERS) return;

//         // ✅ Speed filter
//         const speedKmh = (spd ?? 0) * 3.6;
//         if (speedKmh > MAX_SPEED_KMH) return;

//         // ✅ Distance filter
//         if (lastFgLat.current !== null && lastFgLng.current !== null) {
//           const dist = haversineMeters(lastFgLat.current, lastFgLng.current, rawLat, rawLng);
//           if (dist < MIN_DISTANCE_METERS) return;
//         }

//         // ✅ Smooth location
//         const { latitude, longitude } = smoother.smooth(rawLat, rawLng);

//         lastFgLat.current = rawLat;
//         lastFgLng.current = rawLng;

//         setLocation({ latitude, longitude });
//         setHeading(hdg ?? 0);
//         setSpeed(Math.round(speedKmh));
//         setAccuracy(Math.round(acc ?? 0));
//         bounceMarker();

//         // Update path + distance
//         setPath(prev => {
//           if (prev.length > 0) {
//             const last = prev[prev.length - 1];
//             const d = haversineMeters(last.latitude, last.longitude, latitude, longitude);
//             if (d < MIN_DISTANCE_METERS) return prev;
//             setDistanceKm(km => parseFloat((km + d / 1000).toFixed(3)));
//           }
//           return [...prev, { latitude, longitude }];
//         });

//         // ✅ SOCKET OPTIMIZATION — throttled emit
//         const now = Date.now();
//         if (socket?.connected && now - lastSocketEmitRef.current >= SOCKET_THROTTLE_MS) {
//           lastSocketEmitRef.current = now;
//           socket.emit('location_update', { userId: uid, shiftId: sId, latitude, longitude, accuracy: acc, speed: speedKmh });
//         }

//         // 3D camera follow
//         if (cameraFollowRef.current) {
//           mapRef.current?.animateCamera({
//             center: { latitude, longitude },
//             heading: hdg ?? 0,
//             pitch: 50,
//             zoom: 18,
//           }, { duration: 600 });
//         }
//       }
//     ).then(sub => { fgWatcherRef.current = sub; });
//   }, []);

//   // ── Mount: request permission & check active shift ──
//   useEffect(() => {
//     (async () => {
//       try {
//         // ✅ GPS Permission flow
//         const { status: fg } = await Location.requestForegroundPermissionsAsync();
//         if (fg !== 'granted') {
//           setGpsPermission('denied');
//           Alert.alert(
//             'Location Required',
//             'Please enable location permission to track your shift.',
//             [{ text: 'OK' }]
//           );
//           setLoading(false);
//           return;
//         }
//         setGpsPermission('granted');
//         await Location.requestBackgroundPermissionsAsync();

//         const raw = await AsyncStorage.getItem('userId');
//         if (!raw) return;
//         const uid = raw.replace(/['"]+/g, '').trim();
//         setUserId(uid);

//         const loc = await Location.getCurrentPositionAsync({
//           accuracy: Location.Accuracy.High,
//         });
//         setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });

//         const res = await axios.get(`${BASE_URL}/shift/active/${uid}`);
//         if (res.data?.startTime) {
//           const sId = res.data._id.toString();
//           setShiftId(sId);
//           setShiftStart(new Date(res.data.startTime).getTime());
//           await AsyncStorage.setItem('activeShiftId', sId);

//           if (res.data.path?.length) {
//             const coords = res.data.path.map((p: any) => ({
//               latitude: Number(p.latitude), longitude: Number(p.longitude),
//             }));
//             setPath(coords);
//           }

//           connectSocket(sId);
//           await startBgTracking();
//           startFgWatcher(sId, uid);
//           startPulse();

//           Animated.spring(headerAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
//           Animated.spring(fabAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
//         }
//       } catch (_) {}
//       finally { setLoading(false); }
//     })();

//     return () => {
//       fgWatcherRef.current?.remove();
//       disconnectSocket();
//     };
//   }, []);

//   // ── Countdown timer ──
//   useEffect(() => {
//     if (!shiftStart) return;
//     const t = setInterval(() => {
//       const rem = SHIFT_MS - (Date.now() - shiftStart);
//       if (rem <= 0) { handleEndShift(); return; }
//       const h = Math.floor(rem / 3600000);
//       const m = Math.floor((rem % 3600000) / 60000);
//       const s = Math.floor((rem % 60000) / 1000);
//       setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
//     }, 1000);
//     return () => clearInterval(t);
//   }, [shiftStart]);

//   // ── Start Shift ──
//   const handleStartShift = async () => {
//     try {
//       setLoading(true);
//       const res = await axios.post(`${BASE_URL}/shift/start`, { userId });
//       const sId = res.data.shiftId.toString();
//       setShiftId(sId);
//       setShiftStart(new Date(res.data.startTime).getTime());
//       setPath([]); setDistanceKm(0);
//       lastFgLat.current = null; lastFgLng.current = null;
//       smoother.reset();
//       await AsyncStorage.setItem('activeShiftId', sId);
//       isEndingRef.current = false;

//       connectSocket(sId);
//       await startBgTracking();
//       startFgWatcher(sId, userId);
//       startPulse();

//       Animated.spring(headerAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
//       Animated.spring(fabAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
//     } catch {
//       Alert.alert('Error', 'Could not start shift.');
//     } finally { setLoading(false); }
//   };

//   // ── End Shift ──
//   const handleEndShift = () => {
//     if (isEndingRef.current) return;
//     Alert.alert('End Shift', 'Are you sure you want to end your shift?', [
//       { text: 'Cancel', style: 'cancel' },
//       {
//         text: 'End Shift', style: 'destructive',
//         onPress: async () => {
//           isEndingRef.current = true;
//           setLoading(true);
//           try {
//             await axios.post(`${BASE_URL}/shift/end`, { userId });
//             fgWatcherRef.current?.remove();
//             const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
//             if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
//             disconnectSocket();
//             await AsyncStorage.removeItem('activeShiftId');
//             setShiftId(null); setShiftStart(null);
//             setPath([]); setDistanceKm(0); setTimeLeft('08:00:00');
//             pulseRing.stopAnimation(); pulseOpacity.stopAnimation(); markerBeat.stopAnimation();
//             headerAnim.setValue(0); fabAnim.setValue(0);
//             lastFgLat.current = null; lastFgLng.current = null;
//             smoother.reset();
//           } catch { Alert.alert('Error', 'Failed to end shift.'); }
//           finally { setLoading(false); isEndingRef.current = false; }
//         }
//       }
//     ]);
//   };

//   // ── Save note ──
//   const saveNote = async () => {
//     if (!form.className.trim()) { Alert.alert('Error', 'Class Name is required.'); return; }
//     try {
//       setLoading(true);
//       const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
//       await axios.post(`${BASE_URL}/notes`, {
//         userId,
//         ...form,
//         studentCount: form.studentCount ? parseInt(form.studentCount) : 0,
//         classCount: form.classCount ? parseInt(form.classCount) : 0,
//         latitude: loc.coords.latitude,
//         longitude: loc.coords.longitude,
//       });
//       setForm({ className: '', directorName: '', directorNumber: '', address: '', contactPersonName: '', contactPersonNumber: '', studentCount: '', classCount: '', remark: '' });
//       setNoteModal(false);
//       Alert.alert('✅ Saved', 'Entry recorded successfully.');
//     } catch { Alert.alert('Error', 'Save failed.'); }
//     finally { setLoading(false); }
//   };

//   const pulseScale = pulseRing.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });
//   const isActive = !!shiftStart;

//   const signalColor = accuracy === 0 ? '#9ca3af' : accuracy < 15 ? '#16a34a' : accuracy < 40 ? '#ca8a04' : '#dc2626';

//   // ── GPS Denied Screen ──
//   if (gpsPermission === 'denied') {
//     return (
//       <SafeAreaView style={s.permScreen}>
//         <View style={s.permBox}>
//           <Ionicons name="location-outline" size={64} color="#2563EB" />
//           <Text style={s.permTitle}>Location Access Needed</Text>
//           <Text style={s.permSub}>This app tracks your field shift. Please allow location access in Settings.</Text>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   return (
//     <View style={s.container}>

//       {/* ── Light Map ── */}
//       <MapView
//         ref={mapRef}
//         style={StyleSheet.absoluteFillObject}
//         provider={PROVIDER_GOOGLE}
//         customMapStyle={LIGHT_MAP}
//         initialRegion={{ ...location, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
//         pitchEnabled rotateEnabled showsBuildings showsTraffic
//         showsCompass={false} showsMyLocationButton={false}
//         mapPadding={{ top: 0, right: 0, bottom: 210, left: 0 }}
//         onPanDrag={() => { cameraFollowRef.current = false; }}
//       >
//         {/* ✅ Route trail — vivid blue, clearly visible on light map */}
//         {path.length > 1 && (
//           <Polyline
//             coordinates={path}
//             strokeColor="#2563EB"
//             strokeWidth={5}
//             geodesic
//             lineCap="round"
//             lineJoin="round"
//           />
//         )}

//         {/* ✅ Animated GPS marker */}
//         {isActive && (
//           <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }} flat tracksViewChanges>
//             <View style={s.markerWrapper}>
//               {/* Outer pulse ring */}
//               <Animated.View style={[s.pulseRing, {
//                 transform: [{ scale: pulseScale }],
//                 opacity: pulseOpacity,
//               }]} />
//               {/* Inner accuracy ring */}
//               <View style={[s.accuracyRing, { borderColor: signalColor }]} />
//               {/* Core dot with heartbeat */}
//               <Animated.View style={[s.markerDot, {
//                 transform: [{ scale: Animated.multiply(markerScale, markerBeat) }],
//                 backgroundColor: '#2563EB',
//                 shadowColor: '#2563EB',
//               }]}>
//                 <View style={s.markerCore} />
//               </Animated.View>
//             </View>
//           </Marker>
//         )}
//       </MapView>

//       {/* ── Recenter ── */}
//       <TouchableOpacity
//         style={s.recenterBtn}
//         onPress={() => {
//           cameraFollowRef.current = true;
//           mapRef.current?.animateCamera({
//             center: location, heading, pitch: 50, zoom: 18,
//           }, { duration: 500 });
//         }}
//       >
//         <Ionicons name="navigate" size={20} color="#2563EB" />
//       </TouchableOpacity>

//       {/* ── Top HUD ── */}
//       <Animated.View style={[s.hud, {
//         opacity: headerAnim,
//         transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) }]
//       }]}>
//         <SafeAreaView>
//           <View style={s.hudInner}>
//             <View style={s.hudLeft}>
//               <View style={s.liveBadge}>
//                 <Animated.View style={[s.liveDot, { opacity: pulseOpacity }]} />
//                 <Text style={s.liveText}>LIVE</Text>
//               </View>
//               <Text style={s.timerText}>{timeLeft}</Text>
//               <Text style={s.hudSub}>
//                 {distanceKm.toFixed(2)} km  ·  {path.length} pts  ·  {speed} km/h
//               </Text>
//             </View>
//             <View style={s.hudRight}>
//               <View style={s.signalRow}>
//                 <View style={[s.signalDot, { backgroundColor: signalColor }]} />
//                 <Text style={[s.accuracyText, { color: signalColor }]}>±{accuracy}m</Text>
//               </View>
//               <Text style={s.gpsLabel}>GPS</Text>
//             </View>
//           </View>
//         </SafeAreaView>
//       </Animated.View>

//       {/* ── Bottom Controls ── */}
//       <View style={s.bottom}>
//         {!isActive ? (
//           <TouchableOpacity style={s.startBtn} onPress={handleStartShift} activeOpacity={0.85}>
//             <Ionicons name="radio-button-on" size={20} color="#fff" style={{ marginRight: 10 }} />
//             <Text style={s.startBtnText}>Start Shift</Text>
//           </TouchableOpacity>
//         ) : (
//           <Animated.View style={[s.activeRow, {
//             opacity: fabAnim,
//             transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }]
//           }]}>
//             <TouchableOpacity style={s.noteFab} onPress={() => setNoteModal(true)} activeOpacity={0.85}>
//               <Ionicons name="add" size={28} color="#fff" />
//             </TouchableOpacity>
//             <TouchableOpacity style={s.endBtn} onPress={handleEndShift} activeOpacity={0.85}>
//               <Ionicons name="stop-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
//               <Text style={s.endBtnText}>End Shift</Text>
//             </TouchableOpacity>
//           </Animated.View>
//         )}
//       </View>

//       {/* ── Note Modal ── */}
//       <Modal visible={noteModal} transparent animationType="slide">
//         <KeyboardAvoidingView
//           behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//           style={s.modalOverlay}
//         >
//           <View style={s.sheet}>
//             <View style={s.sheetHandle} />
//             <View style={s.sheetHeader}>
//               <Text style={s.sheetTitle}>Field Entry</Text>
//               <TouchableOpacity onPress={() => setNoteModal(false)}>
//                 <Ionicons name="close-circle" size={26} color="#9ca3af" />
//               </TouchableOpacity>
//             </View>
//             <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
//               {[
//                 { label: 'Class Name *', key: 'className', placeholder: 'Enter class name' },
//                 { label: 'Director / Proprietor Name', key: 'directorName', placeholder: 'Name' },
//                 { label: 'Director Phone', key: 'directorNumber', placeholder: 'Phone', keyboard: 'phone-pad' },
//                 { label: 'Address', key: 'address', placeholder: 'Full address' },
//                 { label: 'Contact Person Name', key: 'contactPersonName', placeholder: 'Name' },
//                 { label: 'Contact Person Phone', key: 'contactPersonNumber', placeholder: 'Phone', keyboard: 'phone-pad' },
//               ].map(({ label, key, placeholder, keyboard }: any) => (
//                 <View key={key}>
//                   <Text style={s.inputLabel}>{label}</Text>
//                   <TextInput
//                     style={s.input}
//                     placeholder={placeholder}
//                     placeholderTextColor="#9ca3af"
//                     keyboardType={keyboard || 'default'}
//                     value={(form as any)[key]}
//                     onChangeText={t => setForm(f => ({ ...f, [key]: t }))}
//                   />
//                 </View>
//               ))}
//               <View style={{ flexDirection: 'row', gap: 12 }}>
//                 {[{ label: 'Student Count', key: 'studentCount' }, { label: 'Class Count', key: 'classCount' }].map(({ label, key }) => (
//                   <View key={key} style={{ flex: 1 }}>
//                     <Text style={s.inputLabel}>{label}</Text>
//                     <TextInput
//                       style={s.input}
//                       placeholder="0"
//                       placeholderTextColor="#9ca3af"
//                       keyboardType="numeric"
//                       value={(form as any)[key]}
//                       onChangeText={t => setForm(f => ({ ...f, [key]: t }))}
//                     />
//                   </View>
//                 ))}
//               </View>
//               <Text style={s.inputLabel}>Remark</Text>
//               <TextInput
//                 style={[s.input, { height: 80, textAlignVertical: 'top' }]}
//                 placeholder="Any remarks..."
//                 placeholderTextColor="#9ca3af"
//                 multiline
//                 value={form.remark}
//                 onChangeText={t => setForm(f => ({ ...f, remark: t }))}
//               />
//               <TouchableOpacity style={s.saveBtn} onPress={saveNote} activeOpacity={0.85}>
//                 <Text style={s.saveBtnText}>Save Entry</Text>
//               </TouchableOpacity>
//             </ScrollView>
//           </View>
//         </KeyboardAvoidingView>
//       </Modal>
//     </View>
//   );
// }

// // ── Styles ────────────────────────────────────────────────────────────────────
// const s = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#f0f4f8' },

//   // Permission screen
//   permScreen: { flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
//   permBox: { alignItems: 'center', padding: 32 },
//   permTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b', marginTop: 20, marginBottom: 10 },
//   permSub: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22 },

//   // Marker
//   markerWrapper: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
//   pulseRing: {
//     position: 'absolute', width: 22, height: 22, borderRadius: 11,
//     backgroundColor: 'rgba(37,99,235,0.18)', borderWidth: 1, borderColor: 'rgba(37,99,235,0.35)',
//   },
//   accuracyRing: {
//     position: 'absolute', width: 32, height: 32, borderRadius: 16,
//     borderWidth: 1.5, backgroundColor: 'transparent',
//   },
//   markerDot: {
//     width: 22, height: 22, borderRadius: 11,
//     borderWidth: 3, borderColor: '#ffffff',
//     elevation: 8,
//     shadowOffset: { width: 0, height: 0 },
//     shadowOpacity: 0.6, shadowRadius: 8,
//     alignItems: 'center', justifyContent: 'center',
//   },
//   markerCore: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' },

//   // Recenter
//   recenterBtn: {
//     position: 'absolute', right: 14, bottom: 230,
//     width: 44, height: 44, borderRadius: 22,
//     backgroundColor: '#ffffff',
//     alignItems: 'center', justifyContent: 'center',
//     elevation: 5,
//     shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.15, shadowRadius: 6,
//     borderWidth: 1, borderColor: '#e2e8f0',
//   },

//   // HUD
//   hud: {
//     position: 'absolute', top: 0, left: 0, right: 0,
//     backgroundColor: 'rgba(255,255,255,0.95)',
//     borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
//     paddingHorizontal: 20, paddingBottom: 14,
//     shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08, shadowRadius: 8,
//   },
//   hudInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
//   hudLeft: { flex: 1 },
//   hudRight: { alignItems: 'flex-end' },
//   liveBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
//   liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#16a34a', marginRight: 6 },
//   liveText: { fontSize: 10, fontWeight: '800', color: '#16a34a', letterSpacing: 1.5 },
//   timerText: { fontSize: 30, fontWeight: '800', color: '#1e293b', letterSpacing: -1, fontVariant: ['tabular-nums'] },
//   hudSub: { fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '600' },
//   signalRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
//   signalDot: { width: 9, height: 9, borderRadius: 4.5 },
//   accuracyText: { fontSize: 12, fontWeight: '700' },
//   gpsLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '700', letterSpacing: 1, marginTop: 4 },

//   // Bottom
//   bottom: {
//     position: 'absolute', bottom: 0, left: 0, right: 0,
//     paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 38 : 22,
//     paddingTop: 16,
//     backgroundColor: 'rgba(255,255,255,0.97)',
//     borderTopWidth: 1, borderTopColor: '#e2e8f0',
//     shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
//     shadowOpacity: 0.06, shadowRadius: 8,
//   },
//   startBtn: {
//     backgroundColor: '#2563EB', borderRadius: 16, height: 58,
//     flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
//     elevation: 4,
//     shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.35, shadowRadius: 10,
//   },
//   startBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
//   activeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
//   noteFab: {
//     width: 58, height: 58, borderRadius: 29,
//     backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center',
//     elevation: 5,
//     shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.35, shadowRadius: 10,
//   },
//   endBtn: {
//     flex: 1, height: 58, borderRadius: 16,
//     backgroundColor: '#dc2626', flexDirection: 'row',
//     alignItems: 'center', justifyContent: 'center',
//     elevation: 5,
//     shadowColor: '#dc2626', shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.3, shadowRadius: 10,
//   },
//   endBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

//   // Modal
//   modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
//   sheet: {
//     backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
//     paddingHorizontal: 20, paddingTop: 12, maxHeight: '92%',
//     borderWidth: 1, borderColor: '#e2e8f0',
//     shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
//     shadowOpacity: 0.1, shadowRadius: 16,
//   },
//   sheetHandle: {
//     width: 36, height: 4, borderRadius: 2,
//     backgroundColor: '#cbd5e1', alignSelf: 'center', marginBottom: 14,
//   },
//   sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
//   sheetTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
//   inputLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginTop: 14, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' },
//   input: {
//     backgroundColor: '#f8fafc', borderRadius: 12, padding: 14,
//     fontSize: 15, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0',
//   },
//   saveBtn: {
//     backgroundColor: '#2563EB', borderRadius: 14, height: 54,
//     alignItems: 'center', justifyContent: 'center', marginTop: 22,
//     shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
//   },
//   saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
// });


import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  Animated, Easing, Platform, Modal,
  TextInput, ScrollView, KeyboardAvoidingView, SafeAreaView
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { BASE_URL } from '../../services/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const LOCATION_TASK = 'bg-location-task';
const SHIFT_MS = 8 * 60 * 60 * 1000;
const MAX_ACCURACY_METERS = 30;
const MIN_DISTANCE_METERS = 6;
const MAX_SPEED_KMH = 200;
const SOCKET_THROTTLE_MS = 1500;
const SOCKET_URL = BASE_URL.replace('/api', '');

// ── Light Map ─────────────────────────────────────────────────────────────────
const LIGHT_MAP = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#333333' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fafafa' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9dff0' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e8f5e9' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d0eac8' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#777777' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#eef2eb' }] },
];

// ── Haversine ─────────────────────────────────────────────────────────────────
const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Bearing between two coords (degrees 0–360) ────────────────────────────────
const bearingDeg = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x =
    Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

// ── Location Smoother (EMA) ───────────────────────────────────────────────────
class LocationSmoother {
  private smoothLat: number | null = null;
  private smoothLng: number | null = null;
  private readonly alpha = 0.25;

  smooth(lat: number, lng: number): { latitude: number; longitude: number } {
    if (this.smoothLat === null || this.smoothLng === null) {
      this.smoothLat = lat; this.smoothLng = lng;
    } else {
      this.smoothLat = this.alpha * lat + (1 - this.alpha) * this.smoothLat;
      this.smoothLng = this.alpha * lng + (1 - this.alpha) * this.smoothLng;
    }
    return { latitude: this.smoothLat, longitude: this.smoothLng };
  }

  reset() { this.smoothLat = null; this.smoothLng = null; }
}

// ── Module-level state ────────────────────────────────────────────────────────
let socket: Socket | null = null;
let lastLat: number | null = null;
let lastLng: number | null = null;
let lastSocketEmit = 0;
const smoother = new LocationSmoother();

// ── Background task ───────────────────────────────────────────────────────────
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error || !data?.locations?.length) return;
  try {
    const loc = data.locations[0];
    const { latitude, longitude, accuracy, speed } = loc.coords;

    if (accuracy && accuracy > MAX_ACCURACY_METERS) return;
    if (speed && speed * 3.6 > MAX_SPEED_KMH) return;
    if (lastLat !== null && lastLng !== null) {
      if (haversineMeters(lastLat, lastLng, latitude, longitude) < MIN_DISTANCE_METERS) return;
    }

    const rawId = await AsyncStorage.getItem('userId');
    const shiftId = await AsyncStorage.getItem('activeShiftId');
    if (!rawId) return;
    const userId = rawId.replace(/['"]+/g, '').trim();

    lastLat = latitude; lastLng = longitude;

    const now = Date.now();
    if (socket?.connected && shiftId && now - lastSocketEmit >= SOCKET_THROTTLE_MS) {
      lastSocketEmit = now;
      socket.emit('location_update', { userId, shiftId, latitude, longitude, accuracy });
    } else {
      await axios.post(`${BASE_URL}/track`, { userId, latitude, longitude, accuracy });
    }
  } catch (e: any) { console.log('BG task error:', e.message); }
});

// ── Direction Arrow Marker ────────────────────────────────────────────────────
// White chevron outline + blue fill, rotated by bearing
const DirectionArrow = React.memo(({ rotation }: { rotation: number }) => (
  <View style={{
    width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: `${rotation}deg` }],
  }}>
    {/* White outline triangle */}
    <View style={{
      width: 0, height: 0,
      borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 12,
      borderLeftColor: 'transparent', borderRightColor: 'transparent',
      borderBottomColor: 'rgba(255,255,255,0.95)',
      position: 'absolute',
    }} />
    {/* Blue fill triangle */}
    <View style={{
      width: 0, height: 0,
      borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 8,
      borderLeftColor: 'transparent', borderRightColor: 'transparent',
      borderBottomColor: '#2563EB',
      marginTop: 1,
    }} />
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
export default function FieldDashboard() {
  const mapRef = useRef<MapView>(null);
  const isEndingRef = useRef(false);
  const cameraFollowRef = useRef(true);
  const lastSocketEmitRef = useRef(0);

  const [userId, setUserId] = useState('');
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [shiftStart, setShiftStart] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState('08:00:00');
  const [location, setLocation] = useState({ latitude: 19.076, longitude: 72.8777 });
  const [heading, setHeading] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [path, setPath] = useState<{ latitude: number; longitude: number }[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [loading, setLoading] = useState(true);
  const [noteModal, setNoteModal] = useState(false);
  const [gpsPermission, setGpsPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [form, setForm] = useState({
    className: '', directorName: '', directorNumber: '',
    address: '', contactPersonName: '', contactPersonNumber: '',
    studentCount: '', classCount: '', remark: '',
  });

  // Animations
  const pulseRing = useRef(new Animated.Value(0)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const markerScale = useRef(new Animated.Value(1)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const fabAnim = useRef(new Animated.Value(0)).current;
  const markerBeat = useRef(new Animated.Value(1)).current;

  // ── Pulse ──
  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.parallel([
        Animated.timing(pulseRing, {
          toValue: 1, duration: 2000,
          easing: Easing.out(Easing.ease), useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(markerBeat, { toValue: 1.25, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(markerBeat, { toValue: 1, duration: 600, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const bounceMarker = () => {
    Animated.sequence([
      Animated.timing(markerScale, { toValue: 1.35, duration: 120, useNativeDriver: true }),
      Animated.spring(markerScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  };

  // ── Socket ──
  const connectSocket = useCallback((sId: string) => {
    if (socket?.connected) return;
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1500,
      timeout: 10000,
    });
    socket.on('connect', () => { socket?.emit('join_shift', { shiftId: sId }); });
    socket.on('disconnect', (reason) => console.log('Socket disconnected:', reason));
    socket.on('connect_error', (err) => console.log('Socket error:', err.message));
  }, []);

  const disconnectSocket = () => {
    socket?.disconnect(); socket = null;
    lastLat = null; lastLng = null; smoother.reset();
  };

  // ── Background tracking ──
  const startBgTracking = async () => {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) return;
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 3000,
      distanceInterval: MIN_DISTANCE_METERS,
      foregroundService: {
        notificationTitle: '📍 Shift Tracking Active',
        notificationBody: 'Your location is being recorded.',
        notificationColor: '#2563EB',
      },
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      deferredUpdatesInterval: 0,
      deferredUpdatesDistance: 0,
    });
  };

  // ── Foreground watcher ──
  const fgWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const lastFgLat = useRef<number | null>(null);
  const lastFgLng = useRef<number | null>(null);

  const startFgWatcher = useCallback((sId: string, uid: string) => {
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1500,
        distanceInterval: 3,
        mayShowUserSettingsDialog: true,
      },
      (loc) => {
        const { latitude: rawLat, longitude: rawLng, heading: hdg, speed: spd, accuracy: acc } = loc.coords;

        if (acc && acc > MAX_ACCURACY_METERS) return;
        const speedKmh = (spd ?? 0) * 3.6;
        if (speedKmh > MAX_SPEED_KMH) return;

        if (lastFgLat.current !== null && lastFgLng.current !== null) {
          const dist = haversineMeters(lastFgLat.current, lastFgLng.current, rawLat, rawLng);
          if (dist < MIN_DISTANCE_METERS) return;
        }

        const { latitude, longitude } = smoother.smooth(rawLat, rawLng);
        lastFgLat.current = rawLat; lastFgLng.current = rawLng;

        setLocation({ latitude, longitude });
        setHeading(hdg ?? 0);
        setSpeed(Math.round(speedKmh));
        setAccuracy(Math.round(acc ?? 0));
        bounceMarker();

        setPath(prev => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const d = haversineMeters(last.latitude, last.longitude, latitude, longitude);
            if (d < MIN_DISTANCE_METERS) return prev;
            setDistanceKm(km => parseFloat((km + d / 1000).toFixed(3)));
          }
          return [...prev, { latitude, longitude }];
        });

        const now = Date.now();
        if (socket?.connected && now - lastSocketEmitRef.current >= SOCKET_THROTTLE_MS) {
          lastSocketEmitRef.current = now;
          socket.emit('location_update', { userId: uid, shiftId: sId, latitude, longitude, accuracy: acc, speed: speedKmh });
        }

        if (cameraFollowRef.current) {
          mapRef.current?.animateCamera({
            center: { latitude, longitude },
            heading: hdg ?? 0, pitch: 50, zoom: 18,
          }, { duration: 600 });
        }
      }
    ).then(sub => { fgWatcherRef.current = sub; });
  }, []);

  // ── Mount ──
  useEffect(() => {
    (async () => {
      try {
        const { status: fg } = await Location.requestForegroundPermissionsAsync();
        if (fg !== 'granted') {
          setGpsPermission('denied'); setLoading(false); return;
        }
        setGpsPermission('granted');
        await Location.requestBackgroundPermissionsAsync();

        const raw = await AsyncStorage.getItem('userId');
        if (!raw) return;
        const uid = raw.replace(/['"]+/g, '').trim();
        setUserId(uid);

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });

        const res = await axios.get(`${BASE_URL}/shift/active/${uid}`);
        if (res.data?.startTime) {
          const sId = res.data._id.toString();
          setShiftId(sId);
          setShiftStart(new Date(res.data.startTime).getTime());
          await AsyncStorage.setItem('activeShiftId', sId);

          if (res.data.path?.length) {
            const coords = res.data.path.map((p: any) => ({
              latitude: Number(p.latitude), longitude: Number(p.longitude),
            }));
            setPath(coords);
          }

          connectSocket(sId);
          await startBgTracking();
          startFgWatcher(sId, uid);
          startPulse();
          Animated.spring(headerAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
          Animated.spring(fabAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
        }
      } catch (_) { }
      finally { setLoading(false); }
    })();
    return () => { fgWatcherRef.current?.remove(); disconnectSocket(); };
  }, []);

  // ── Timer ──
  useEffect(() => {
    if (!shiftStart) return;
    const t = setInterval(() => {
      const rem = SHIFT_MS - (Date.now() - shiftStart);
      if (rem <= 0) { handleEndShift(); return; }
      const h = Math.floor(rem / 3600000);
      const m = Math.floor((rem % 3600000) / 60000);
      const s = Math.floor((rem % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(t);
  }, [shiftStart]);

  // ── Start Shift ──
  const handleStartShift = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${BASE_URL}/shift/start`, { userId });
      const sId = res.data.shiftId.toString();
      setShiftId(sId); setShiftStart(new Date(res.data.startTime).getTime());
      setPath([]); setDistanceKm(0);
      lastFgLat.current = null; lastFgLng.current = null; smoother.reset();
      await AsyncStorage.setItem('activeShiftId', sId);
      isEndingRef.current = false;
      connectSocket(sId);
      await startBgTracking();
      startFgWatcher(sId, userId);
      startPulse();
      Animated.spring(headerAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
      Animated.spring(fabAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
    } catch { Alert.alert('Error', 'Could not start shift.'); }
    finally { setLoading(false); }
  };

  // ── End Shift ──
  const handleEndShift = () => {
    if (isEndingRef.current) return;
    Alert.alert('End Shift', 'Are you sure you want to end your shift?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Shift', style: 'destructive',
        onPress: async () => {
          isEndingRef.current = true; setLoading(true);
          try {
            await axios.post(`${BASE_URL}/shift/end`, { userId });
            fgWatcherRef.current?.remove();
            const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
            if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
            disconnectSocket();
            await AsyncStorage.removeItem('activeShiftId');
            setShiftId(null); setShiftStart(null);
            setPath([]); setDistanceKm(0); setTimeLeft('08:00:00');
            pulseRing.stopAnimation(); pulseOpacity.stopAnimation(); markerBeat.stopAnimation();
            headerAnim.setValue(0); fabAnim.setValue(0);
            lastFgLat.current = null; lastFgLng.current = null; smoother.reset();
          } catch { Alert.alert('Error', 'Failed to end shift.'); }
          finally { setLoading(false); isEndingRef.current = false; }
        }
      }
    ]);
  };

  // ── Save note ──
  const saveNote = async () => {
    if (!form.className.trim()) { Alert.alert('Error', 'Class Name is required.'); return; }
    try {
      setLoading(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await axios.post(`${BASE_URL}/notes`, {
        userId, ...form,
        studentCount: form.studentCount ? parseInt(form.studentCount) : 0,
        classCount: form.classCount ? parseInt(form.classCount) : 0,
        latitude: loc.coords.latitude, longitude: loc.coords.longitude,
      });
      setForm({ className: '', directorName: '', directorNumber: '', address: '', contactPersonName: '', contactPersonNumber: '', studentCount: '', classCount: '', remark: '' });
      setNoteModal(false);
      Alert.alert('✅ Saved', 'Entry recorded successfully.');
    } catch { Alert.alert('Error', 'Save failed.'); }
    finally { setLoading(false); }
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const pulseScale = pulseRing.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });
  const isActive = !!shiftStart;
  const signalColor = accuracy === 0 ? '#9ca3af' : accuracy < 15 ? '#16a34a' : accuracy < 40 ? '#ca8a04' : '#dc2626';

  // Direction arrows: every 5th point, show travel direction
  const arrowPoints = React.useMemo(() => {
    if (path.length < 6) return [];
    const result: { coord: { latitude: number; longitude: number }; bearing: number }[] = [];
    for (let i = 5; i < path.length; i += 5) {
      const prev = path[i - 1];
      const curr = path[i];
      result.push({
        coord: curr,
        bearing: bearingDeg(prev.latitude, prev.longitude, curr.latitude, curr.longitude),
      });
    }
    return result;
  }, [path]);

  // Breadcrumb dots: every 10th point (skip arrow points to avoid overlap)
  const crumbPoints = React.useMemo(() => {
    if (path.length < 11) return [];
    return path.filter((_, i) => i > 0 && i % 10 === 0 && i % 5 !== 0 && i < path.length - 1);
  }, [path]);

  // ── GPS Denied Screen ─────────────────────────────────────────────────────
  if (gpsPermission === 'denied') {
    return (
      <SafeAreaView style={s.permScreen}>
        <View style={s.permBox}>
          <Ionicons name="location-outline" size={64} color="#2563EB" />
          <Text style={s.permTitle}>Location Access Needed</Text>
          <Text style={s.permSub}>
            This app tracks your field shift. Please allow location access in Settings.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>

      {/* ── Light Map ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        customMapStyle={LIGHT_MAP}
        initialRegion={{ ...location, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
        pitchEnabled rotateEnabled showsBuildings showsTraffic
        showsCompass={false} showsMyLocationButton={false}
        mapPadding={{ top: 0, right: 0, bottom: 210, left: 0 }}
        onPanDrag={() => { cameraFollowRef.current = false; }}
      >

        {/* ── Layer 1: Full path — faded (past trail) ── */}
        {path.length > 1 && (
          <Polyline
            coordinates={path}
            strokeColor="rgba(37,99,235,0.4)"
            strokeWidth={5}
            geodesic
            lineCap="round"
            lineJoin="round"
            zIndex={1}
          />
        )}

        {/* ── Layer 2: Recent 6 points — bright leading edge ── */}
        {path.length > 5 && (
          <Polyline
            coordinates={path.slice(Math.max(path.length - 6, 0))}
            strokeColor="#2563EB"
            strokeWidth={6}
            geodesic
            lineCap="round"
            lineJoin="round"
            zIndex={2}
          />
        )}

        {/* ── Layer 3: Green start pin ── */}
        {path.length > 0 && (
          <Marker
            coordinate={path[0]}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={5}
          >
            <View style={s.startPin}>
              <View style={s.startPinInner} />
            </View>
          </Marker>
        )}

        {/* ── Layer 4: Direction arrows (every 5th point) ── */}
        {arrowPoints.map((item, i) => (
          <Marker
            key={`arrow-${i}`}
            coordinate={item.coord}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            tracksViewChanges={false}
            zIndex={3}
          >
            <DirectionArrow rotation={item.bearing} />
          </Marker>
        ))}

        {/* ── Layer 5: Breadcrumb dots (every 10th point) ── */}
        {crumbPoints.map((point, i) => (
          <Marker
            key={`crumb-${i}`}
            coordinate={point}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={3}
          >
            <View style={s.crumbDot} />
          </Marker>
        ))}

        {/* ── Layer 6: Animated current-position marker ── */}
        {isActive && (
          <Marker
            coordinate={location}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            tracksViewChanges
            zIndex={10}
          >
            <View style={s.markerWrapper}>
              <Animated.View style={[s.pulseRing, {
                transform: [{ scale: pulseScale }],
                opacity: pulseOpacity,
              }]} />
              <View style={[s.accuracyRing, { borderColor: signalColor }]} />
              <Animated.View style={[s.markerDot, {
                transform: [{ scale: Animated.multiply(markerScale, markerBeat) }],
                backgroundColor: '#2563EB',
                shadowColor: '#2563EB',
              }]}>
                <View style={s.markerCore} />
              </Animated.View>
            </View>
          </Marker>
        )}

      </MapView>

      {/* ── Recenter ── */}
      <TouchableOpacity
        style={s.recenterBtn}
        onPress={() => {
          cameraFollowRef.current = true;
          mapRef.current?.animateCamera({
            center: location, heading, pitch: 50, zoom: 18,
          }, { duration: 500 });
        }}
      >
        <Ionicons name="navigate" size={20} color="#2563EB" />
      </TouchableOpacity>

      {/* ── Top HUD ── */}
      <Animated.View style={[s.hud, {
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) }]
      }]}>
        <SafeAreaView>
          <View style={s.hudInner}>
            <View style={s.hudLeft}>
              <View style={s.liveBadge}>
                <Animated.View style={[s.liveDot, { opacity: pulseOpacity }]} />
                <Text style={s.liveText}>LIVE</Text>
              </View>
              <Text style={s.timerText}>{timeLeft}</Text>
              <Text style={s.hudSub}>
                {distanceKm.toFixed(2)} km  ·  {path.length} pts  ·  {speed} km/h
              </Text>
            </View>
            <View style={s.hudRight}>
              <View style={s.signalRow}>
                <View style={[s.signalDot, { backgroundColor: signalColor }]} />
                <Text style={[s.accuracyText, { color: signalColor }]}>±{accuracy}m</Text>
              </View>
              <Text style={s.gpsLabel}>GPS</Text>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* ── Bottom Controls ── */}
      <View style={s.bottom}>
        {!isActive ? (
          <TouchableOpacity style={s.startBtn} onPress={handleStartShift} activeOpacity={0.85}>
            <Ionicons name="radio-button-on" size={20} color="#fff" style={{ marginRight: 10 }} />
            <Text style={s.startBtnText}>Start Shift</Text>
          </TouchableOpacity>
        ) : (
          <Animated.View style={[s.activeRow, {
            opacity: fabAnim,
            transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }]
          }]}>
            <TouchableOpacity style={s.noteFab} onPress={() => setNoteModal(true)} activeOpacity={0.85}>
              <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={s.endBtn} onPress={handleEndShift} activeOpacity={0.85}>
              <Ionicons name="stop-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.endBtnText}>End Shift</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {/* ── Note Modal ── */}
      <Modal visible={noteModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modalOverlay}
        >
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Field Entry</Text>
              <TouchableOpacity onPress={() => setNoteModal(false)}>
                <Ionicons name="close-circle" size={26} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              {[
                { label: 'Class Name *', key: 'className', placeholder: 'Enter class name' },
                { label: 'Director / Proprietor Name', key: 'directorName', placeholder: 'Name' },
                { label: 'Director Phone', key: 'directorNumber', placeholder: 'Phone', keyboard: 'phone-pad' },
                { label: 'Address', key: 'address', placeholder: 'Full address' },
                { label: 'Contact Person Name', key: 'contactPersonName', placeholder: 'Name' },
                { label: 'Contact Person Phone', key: 'contactPersonNumber', placeholder: 'Phone', keyboard: 'phone-pad' },
              ].map(({ label, key, placeholder, keyboard }: any) => (
                <View key={key}>
                  <Text style={s.inputLabel}>{label}</Text>
                  <TextInput
                    style={s.input}
                    placeholder={placeholder}
                    placeholderTextColor="#9ca3af"
                    keyboardType={keyboard || 'default'}
                    value={(form as any)[key]}
                    onChangeText={t => setForm(f => ({ ...f, [key]: t }))}
                  />
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {[{ label: 'Student Count', key: 'studentCount' }, { label: 'Class Count', key: 'classCount' }].map(({ label, key }) => (
                  <View key={key} style={{ flex: 1 }}>
                    <Text style={s.inputLabel}>{label}</Text>
                    <TextInput
                      style={s.input}
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                      value={(form as any)[key]}
                      onChangeText={t => setForm(f => ({ ...f, [key]: t }))}
                    />
                  </View>
                ))}
              </View>
              <Text style={s.inputLabel}>Remark</Text>
              <TextInput
                style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Any remarks..."
                placeholderTextColor="#9ca3af"
                multiline
                value={form.remark}
                onChangeText={t => setForm(f => ({ ...f, remark: t }))}
              />
              <TouchableOpacity style={s.saveBtn} onPress={saveNote} activeOpacity={0.85}>
                <Text style={s.saveBtnText}>Save Entry</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // Permission
  permScreen: { flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  permBox: { alignItems: 'center', padding: 32 },
  permTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b', marginTop: 20, marginBottom: 10 },
  permSub: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22 },

  // Start pin (green)
  startPin: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#16a34a',
    borderWidth: 2.5, borderColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
    elevation: 5,
    shadowColor: '#16a34a', shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 6,
  },
  startPinInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffffff' },

  // Breadcrumb dot
  crumbDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#2563EB',
    borderWidth: 1.5, borderColor: '#ffffff',
    elevation: 2,
  },

  // GPS Marker
  markerWrapper: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute', width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(37,99,235,0.18)',
    borderWidth: 1, borderColor: 'rgba(37,99,235,0.35)',
  },
  accuracyRing: {
    position: 'absolute', width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, backgroundColor: 'transparent',
  },
  markerDot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 3, borderColor: '#ffffff',
    elevation: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  markerCore: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' },

  // Recenter
  recenterBtn: {
    position: 'absolute', right: 14, bottom: 230,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6,
    borderWidth: 1, borderColor: '#e2e8f0',
  },

  // HUD
  hud: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    paddingHorizontal: 20, paddingBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8,
  },
  hudInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hudLeft: { flex: 1 },
  hudRight: { alignItems: 'flex-end' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#16a34a', marginRight: 6 },
  liveText: { fontSize: 10, fontWeight: '800', color: '#16a34a', letterSpacing: 1.5 },
  timerText: { fontSize: 30, fontWeight: '800', color: '#1e293b', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  hudSub: { fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '600' },
  signalRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  signalDot: { width: 9, height: 9, borderRadius: 4.5 },
  accuracyText: { fontSize: 12, fontWeight: '700' },
  gpsLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '700', letterSpacing: 1, marginTop: 4 },

  // Bottom
  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 38 : 22,
    paddingTop: 16,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1, borderTopColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  startBtn: {
    backgroundColor: '#2563EB', borderRadius: 16, height: 58,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    elevation: 4,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10,
  },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  noteFab: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center',
    elevation: 5,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10,
  },
  endBtn: {
    flex: 1, height: 58, borderRadius: 16,
    backgroundColor: '#dc2626', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    elevation: 5,
    shadowColor: '#dc2626', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10,
  },
  endBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: '92%',
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 16,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#cbd5e1', alignSelf: 'center', marginBottom: 14,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  inputLabel: {
    fontSize: 11, fontWeight: '700', color: '#64748b',
    marginTop: 14, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 14,
    fontSize: 15, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0',
  },
  saveBtn: {
    backgroundColor: '#2563EB', borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center', marginTop: 22,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});