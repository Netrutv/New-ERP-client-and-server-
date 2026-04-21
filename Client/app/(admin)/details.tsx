import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, Linking, ActivityIndicator, Animated, Easing,
} from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import React, {
  useMemo, useState, useRef, useEffect, useCallback,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { BASE_URL } from '../../services/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const MIN_DISTANCE_METERS = 6;
const MAX_ACCURACY_METERS = 30;
const MAX_SPEED_KMH = 200;
const SOCKET_URL = BASE_URL.replace('/api', '');

// ── Light Map Style (matches FieldDashboard) ──────────────────────────────────
const LIGHT_MAP = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#333333' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9dff0' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e8f5e9' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d0eac8' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#eef2eb' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#777777' }] },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Note {
  _id?: string;
  latitude: number;
  longitude: number;
  className: string;
  directorName?: string;
  directorNumber?: string;
  address?: string;
  contactPersonName?: string;
  contactPersonNumber?: string;
  studentCount?: number;
  classCount?: number;
  remark?: string;
  createdAt?: string;
}

type ConnectionStatus = 'connecting' | 'live' | 'disconnected';

// ── Haversine (meters) ────────────────────────────────────────────────────────
const haversineMeters = (
  lat1: number, lon1: number, lat2: number, lon2: number
): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Bearing (0–360°) ──────────────────────────────────────────────────────────
const bearingDeg = (
  lat1: number, lon1: number, lat2: number, lon2: number
): number => {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x =
    Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

// ── EMA Location Smoother (same as FieldDashboard) ────────────────────────────
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

// ── Direction Arrow (same as FieldDashboard) ──────────────────────────────────
const DirectionArrow = React.memo(({ rotation }: { rotation: number }) => (
  <View style={{
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: `${rotation}deg` }],
  }}>
    <View style={{
      position: 'absolute', width: 0, height: 0,
      borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 12,
      borderLeftColor: 'transparent', borderRightColor: 'transparent',
      borderBottomColor: 'rgba(255,255,255,0.95)',
    }} />
    <View style={{
      width: 0, height: 0, marginTop: 1,
      borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 8,
      borderLeftColor: 'transparent', borderRightColor: 'transparent',
      borderBottomColor: '#2563EB',
    }} />
  </View>
));

// ── Module-level smoother ─────────────────────────────────────────────────────
const smoother = new LocationSmoother();

// ─────────────────────────────────────────────────────────────────────────────
export default function DayDetails() {
  const { shiftId } = useLocalSearchParams();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastRawRef = useRef<{ lat: number; lng: number } | null>(null);
  const cameraFollowRef = useRef(true);
  const prevPathLenRef = useRef(0);

  const [isTaskListVisible, setTaskListVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

  const [shiftData, setShiftData] = useState<{
    date: string;
    path: { latitude: number; longitude: number }[];
    notes: Note[];
  }>({ date: '', path: [], notes: [] });

  // ── Animations ──
  const pulseRing = useRef(new Animated.Value(0)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const markerBeat = useRef(new Animated.Value(1)).current;
  const markerScale = useRef(new Animated.Value(1)).current;
  const liveDotAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // GPS marker pulse
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

    // GPS marker heartbeat
    Animated.loop(
      Animated.sequence([
        Animated.timing(markerBeat, { toValue: 1.25, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(markerBeat, { toValue: 1, duration: 700, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Live badge dot blink
    Animated.loop(
      Animated.sequence([
        Animated.timing(liveDotAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(liveDotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const bounceMarker = useCallback(() => {
    Animated.sequence([
      Animated.timing(markerScale, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.spring(markerScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Smooth camera ──
  const animateToLocation = useCallback((latitude: number, longitude: number, hdg = 0) => {
    mapRef.current?.animateCamera(
      { center: { latitude, longitude }, pitch: 50, heading: hdg, zoom: 18 },
      { duration: 800 }
    );
  }, []);

  // ── Apply filtered + smoothed point ──
  const applyNewPoint = useCallback((
    rawLat: number, rawLng: number,
    opts?: { accuracy?: number; speed?: number }
  ) => {
    if (opts?.accuracy && opts.accuracy > MAX_ACCURACY_METERS) return;
    if (opts?.speed && opts.speed * 3.6 > MAX_SPEED_KMH) return;

    if (lastRawRef.current) {
      const d = haversineMeters(lastRawRef.current.lat, lastRawRef.current.lng, rawLat, rawLng);
      if (d < MIN_DISTANCE_METERS) return;
    }
    lastRawRef.current = { lat: rawLat, lng: rawLng };

    const { latitude, longitude } = smoother.smooth(rawLat, rawLng);

    setShiftData(prev => {
      const last = prev.path[prev.path.length - 1];
      if (last) {
        const d = haversineMeters(last.latitude, last.longitude, latitude, longitude);
        if (d < MIN_DISTANCE_METERS) return prev;
      }
      return { ...prev, path: [...prev.path, { latitude, longitude }] };
    });

    bounceMarker();
    if (cameraFollowRef.current) animateToLocation(latitude, longitude);
  }, [animateToLocation, bounceMarker]);

  // ── Initial HTTP fetch ──
  const fetchDetails = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/shift-details/${shiftId}`);
      const data = await res.json();
      if (!data) return;

      const rawPath = (data.path || [])
        .filter((p: any) => p?.latitude && p?.longitude)
        .map((p: any) => ({
          latitude: parseFloat(p.latitude),
          longitude: parseFloat(p.longitude),
        }));

      // Filter initial path with same MIN_DISTANCE gate
      const filtered: { latitude: number; longitude: number }[] = [];
      for (const pt of rawPath) {
        if (filtered.length === 0) { filtered.push(pt); continue; }
        const last = filtered[filtered.length - 1];
        if (haversineMeters(last.latitude, last.longitude, pt.latitude, pt.longitude) >= MIN_DISTANCE_METERS) {
          filtered.push(pt);
        }
      }

      if (filtered.length > 0) {
        const last = filtered[filtered.length - 1];
        lastRawRef.current = { lat: last.latitude, lng: last.longitude };
        smoother.reset();
        animateToLocation(last.latitude, last.longitude);
      }

      setShiftData({
        date: data.date || '',
        path: filtered,
        notes: data.notes || [],
      });
    } catch (err) {
      console.error('❌ HTTP fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [shiftId, animateToLocation]);

  // ── Socket.IO (matches your existing backend) ──
  useEffect(() => {
    smoother.reset();
    lastRawRef.current = null;
    fetchDetails();

    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1500,
      timeout: 10000,
    });

    socketRef.current.on('connect', () => {
      setConnectionStatus('live');
      // Watch this shift room for admin updates
      socketRef.current?.emit('watch_shift', { shiftId });
    });

    socketRef.current.on('disconnect', () => setConnectionStatus('disconnected'));
    socketRef.current.on('connect_error', () => setConnectionStatus('disconnected'));

    // Real-time location from worker
    socketRef.current.on('location_updated', ({
      latitude, longitude, accuracy, speed,
    }: { latitude: number; longitude: number; accuracy?: number; speed?: number }) => {
      applyNewPoint(latitude, longitude, { accuracy, speed });
    });

    // New note saved by worker
    socketRef.current.on('note_added', (note: Note) => {
      setShiftData(prev => ({ ...prev, notes: [...prev.notes, note] }));
    });

    return () => {
      socketRef.current?.disconnect();
      smoother.reset();
      lastRawRef.current = null;
    };
  }, [shiftId]);

  // ── Auto-camera: only trigger when path grows ──
  const formattedPath = shiftData.path;
  useEffect(() => {
    if (!cameraFollowRef.current) return;
    if (formattedPath.length === prevPathLenRef.current) return;
    prevPathLenRef.current = formattedPath.length;
    if (formattedPath.length < 2) return;

    const last = formattedPath[formattedPath.length - 1];
    const prev = formattedPath[formattedPath.length - 2];
    const hdg = bearingDeg(prev.latitude, prev.longitude, last.latitude, last.longitude);
    animateToLocation(last.latitude, last.longitude, hdg);
  }, [formattedPath.length]);

  // ── Derived ──
  const pulseScale = pulseRing.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });

  const arrowPoints = useMemo(() => {
    if (formattedPath.length < 6) return [];
    const result: { coord: { latitude: number; longitude: number }; bearing: number }[] = [];
    for (let i = 5; i < formattedPath.length; i += 5) {
      const prev = formattedPath[i - 1];
      const curr = formattedPath[i];
      result.push({ coord: curr, bearing: bearingDeg(prev.latitude, prev.longitude, curr.latitude, curr.longitude) });
    }
    return result;
  }, [formattedPath]);

  const crumbPoints = useMemo(() => {
    if (formattedPath.length < 11) return [];
    return formattedPath.filter((_, i) => i > 0 && i % 10 === 0 && i % 5 !== 0 && i < formattedPath.length - 1);
  }, [formattedPath]);

  const totalKm = useMemo(() => {
    if (formattedPath.length < 2) return 0;
    let dist = 0;
    for (let i = 0; i < formattedPath.length - 1; i++) {
      dist += haversineMeters(
        formattedPath[i].latitude, formattedPath[i].longitude,
        formattedPath[i + 1].latitude, formattedPath[i + 1].longitude
      ) / 1000;
    }
    return dist;
  }, [formattedPath]);

  const totals = useMemo(() => {
    return shiftData.notes.reduce(
      (acc, curr) => ({
        students: acc.students + (Number(curr.studentCount) || 0),
        classes: acc.classes + (Number(curr.classCount) || 0),
      }),
      { students: 0, classes: 0 }
    );
  }, [shiftData.notes]);

  const latestPos = formattedPath.length > 0 ? formattedPath[formattedPath.length - 1] : null;
  const startPos = formattedPath.length > 0 ? formattedPath[0] : null;

  const badgeConfig: Record<ConnectionStatus, { color: string; label: string }> = {
    live: { color: '#16a34a', label: 'LIVE' },
    connecting: { color: '#ca8a04', label: 'CONNECTING…' },
    disconnected: { color: '#dc2626', label: 'RECONNECTING…' },
  };
  const badge = badgeConfig[connectionStatus];

  const callNumber = (num?: string) => { if (num) Linking.openURL(`tel:${num}`); };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading && !shiftData.date) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingText}>Loading shift data...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>

      {/* ── Map ── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        customMapStyle={LIGHT_MAP}
        pitchEnabled
        rotateEnabled
        showsBuildings
        showsCompass={false}
        showsMyLocationButton={false}
        mapPadding={{ top: 0, right: 0, bottom: 200, left: 0 }}
        onPanDrag={() => { cameraFollowRef.current = false; }}
        initialCamera={{
          center: {
            latitude: latestPos?.latitude ?? 19.076,
            longitude: latestPos?.longitude ?? 72.8777,
          },
          pitch: 50, heading: 0, zoom: 17, altitude: 500,
        }}
      >

        {/* Faded full trail */}
        {formattedPath.length > 1 && (
          <Polyline
            coordinates={formattedPath}
            strokeColor="rgba(37,99,235,0.4)"
            strokeWidth={5}
            geodesic lineCap="round" lineJoin="round"
            zIndex={1}
          />
        )}

        {/* Bright leading edge */}
        {formattedPath.length > 5 && (
          <Polyline
            coordinates={formattedPath.slice(Math.max(formattedPath.length - 6, 0))}
            strokeColor="#2563EB"
            strokeWidth={6}
            geodesic lineCap="round" lineJoin="round"
            zIndex={2}
          />
        )}

        {/* Green start pin */}
        {startPos && (
          <Marker coordinate={startPos} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={5}>
            <View style={s.startPin}>
              <View style={s.startPinInner} />
            </View>
          </Marker>
        )}

        {/* Direction arrows every 5th point */}
        {arrowPoints.map((item, i) => (
          <Marker key={`arrow-${i}`} coordinate={item.coord}
            anchor={{ x: 0.5, y: 0.5 }} flat tracksViewChanges={false} zIndex={3}>
            <DirectionArrow rotation={item.bearing} />
          </Marker>
        ))}

        {/* Breadcrumb dots every 10th point */}
        {crumbPoints.map((point, i) => (
          <Marker key={`crumb-${i}`} coordinate={point}
            anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={3}>
            <View style={s.crumbDot} />
          </Marker>
        ))}

        {/* Animated live position marker */}
        {latestPos && (
          <Marker coordinate={latestPos}
            anchor={{ x: 0.5, y: 0.5 }} flat tracksViewChanges zIndex={10}>
            <View style={s.markerWrapper}>
              <Animated.View style={[s.pulseRing, {
                transform: [{ scale: pulseScale }], opacity: pulseOpacity,
              }]} />
              <View style={s.accuracyRing} />
              <Animated.View style={[s.markerDot, {
                transform: [{ scale: Animated.multiply(markerScale, markerBeat) }],
              }]}>
                <View style={s.markerCore} />
              </Animated.View>
            </View>
          </Marker>
        )}

        {/* School / visit markers */}
        {shiftData.notes.map((note, index) => (
          <Marker
            key={note._id ?? `note-${index}`}
            coordinate={{
              latitude: parseFloat(note.latitude as any),
              longitude: parseFloat(note.longitude as any),
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={8}
            onPress={() => { setSelectedNote(note); setTaskListVisible(true); }}
          >
            <View style={s.notePin}>
              <Ionicons name="business" size={14} color="white" />
            </View>
          </Marker>
        ))}

      </MapView>

      {/* ── Header / Back ── */}
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#1e293b" />
        <View style={{ marginLeft: 10 }}>
          <Text style={s.headerTitle}>{shiftData.date} Activity</Text>
          <View style={s.liveBadge}>
            <Animated.View style={[s.liveDot, { backgroundColor: badge.color, opacity: liveDotAnim }]} />
            <Text style={[s.liveText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Recenter ── */}
      <TouchableOpacity
        style={s.recenterBtn}
        onPress={() => {
          cameraFollowRef.current = true;
          if (latestPos) animateToLocation(latestPos.latitude, latestPos.longitude);
        }}
      >
        <Ionicons name="navigate" size={20} color="#2563EB" />
      </TouchableOpacity>

      {/* ── Visit Detail Modal ── */}
      <Modal
        animationType="slide" transparent
        visible={isTaskListVisible}
        onRequestClose={() => setTaskListVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTypeLabel}>VISIT DETAILS</Text>
              <TouchableOpacity onPress={() => setTaskListVisible(false)}>
                <Ionicons name="close-circle" size={30} color="#cbd5e1" />
              </TouchableOpacity>
            </View>

            {selectedNote && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                <Text style={s.classNameText}>{selectedNote.className}</Text>

                <View style={s.countsRow}>
                  <View style={s.countBadge}>
                    <Ionicons name="people" size={15} color="#2563EB" />
                    <Text style={s.countBadgeText}>{selectedNote.studentCount ?? 0} Students</Text>
                  </View>
                  <View style={[s.countBadge, { backgroundColor: '#f0fdf4' }]}>
                    <Ionicons name="school" size={15} color="#16a34a" />
                    <Text style={[s.countBadgeText, { color: '#16a34a' }]}>{selectedNote.classCount ?? 0} Classes</Text>
                  </View>
                </View>

                <View style={s.divider} />

                <InfoRow icon="person" iconBg="#eff6ff" iconColor="#2563EB"
                  label="Director / Owner" main={selectedNote.directorName}
                  phone={selectedNote.directorNumber} onCall={callNumber} />

                <InfoRow icon="call" iconBg="#f0fdf4" iconColor="#16a34a"
                  label="Contact Person" main={selectedNote.contactPersonName}
                  phone={selectedNote.contactPersonNumber} onCall={callNumber} />

                <InfoRow icon="location" iconBg="#fefce8" iconColor="#ca8a04"
                  label="Address" main={selectedNote.address} />

                {selectedNote.remark ? (
                  <InfoRow icon="chatbubble-ellipses" iconBg="#f5f3ff" iconColor="#7c3aed"
                    label="Remark" main={selectedNote.remark} />
                ) : null}

                <InfoRow icon="time" iconBg="#f8fafc" iconColor="#94a3b8"
                  label="Logged At"
                  main={new Date(selectedNote.createdAt ?? Date.now())
                    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Summary bar ── */}
      <View style={s.summaryBox}>
        <View style={s.statRow}>
          <StatBox label="Distance" value={`${totalKm.toFixed(2)} km`} />
          <View style={s.statDivider} />
          <StatBox label="Visits" value={String(shiftData.notes.length)} valueColor="#2563EB" />
          <View style={s.statDivider} />
          <StatBox label="Students" value={String(totals.students)} valueColor="#2563EB" />
          <View style={s.statDivider} />
          <StatBox label="Classes" value={String(totals.classes)} valueColor="#16a34a" />
        </View>
      </View>

    </View>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function InfoRow({
  icon, iconBg, iconColor, label, main, phone, onCall,
}: {
  icon: any; iconBg: string; iconColor: string; label: string;
  main?: string; phone?: string; onCall?: (n?: string) => void;
}) {
  return (
    <View style={s.infoSection}>
      <View style={[s.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <View style={s.infoTextContainer}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoMainText}>{main || 'N/A'}</Text>
        {phone && onCall && (
          <TouchableOpacity onPress={() => onCall(phone)}>
            <Text style={s.phoneLink}>{phone}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function StatBox({ label, value, valueColor }: {
  label: string; value: string; valueColor?: string;
}) {
  return (
    <View style={s.statBox}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 15, fontWeight: '600' },

  // Header
  backBtn: {
    position: 'absolute', top: 50, left: 16, zIndex: 10,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.97)',
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20,
    elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  headerTitle: { fontWeight: '800', fontSize: 15, color: '#0f172a' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 5 },
  liveText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },

  // Recenter
  recenterBtn: {
    position: 'absolute', right: 14, bottom: 220,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6,
    borderWidth: 1, borderColor: '#e2e8f0',
  },

  // Map markers
  startPin: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#16a34a',
    borderWidth: 2.5, borderColor: '#ffffff', elevation: 5,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#16a34a', shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 6,
  },
  startPinInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffffff' },
  crumbDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB',
    borderWidth: 1.5, borderColor: '#ffffff', elevation: 2,
  },
  markerWrapper: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute', width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(37,99,235,0.18)',
    borderWidth: 1, borderColor: 'rgba(37,99,235,0.35)',
  },
  accuracyRing: {
    position: 'absolute', width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#2563EB', backgroundColor: 'transparent',
  },
  markerDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#2563EB',
    borderWidth: 3, borderColor: '#ffffff', elevation: 8,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  markerCore: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' },
  notePin: {
    backgroundColor: '#f59e0b', padding: 8,
    borderRadius: 20, borderWidth: 2.5, borderColor: 'white', elevation: 5,
    shadowColor: '#f59e0b', shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: '80%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 16,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1',
    alignSelf: 'center', marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTypeLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '800', letterSpacing: 1 },
  classNameText: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  countsRow: { flexDirection: 'row', marginTop: 12, gap: 10 },
  countBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, gap: 6,
  },
  countBadgeText: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 18 },
  infoSection: { flexDirection: 'row', marginBottom: 18 },
  iconCircle: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  infoTextContainer: { flex: 1 },
  infoLabel: {
    fontSize: 10, color: '#94a3b8', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  infoMainText: { fontSize: 15, color: '#0f172a', fontWeight: '600', marginTop: 2 },
  phoneLink: { fontSize: 14, color: '#2563EB', fontWeight: '700', marginTop: 4 },

  // Summary
  summaryBox: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36,
    elevation: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 16,
    borderTopWidth: 1, borderColor: '#e2e8f0',
  },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  statBox: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: '700', letterSpacing: 0.4 },
  statValue: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  statDivider: { width: 1, height: 36, backgroundColor: '#e2e8f0' },
});