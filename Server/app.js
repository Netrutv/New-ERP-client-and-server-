const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const ExcelJS = require('exceljs');

const User = require('./models/User');
const Shift = require('./models/Shift');
const Note = require('./models/Note');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─────────────────────────────────────────────
//  MongoDB Connection
// ─────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://netrutvainternational_db_user:Netrutv123@ac-ngtnwas-shard-00-00.e0z5ypt.mongodb.net:27017,ac-ngtnwas-shard-00-01.e0z5ypt.mongodb.net:27017,ac-ngtnwas-shard-00-02.e0z5ypt.mongodb.net:27017/myNewDB?ssl=true&replicaSet=atlas-oeix4a-shard-0&authSource=admin&retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    });

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/**
 * Safely parse and validate a MongoDB ObjectId from a raw string.
 * Returns a new ObjectId or null if invalid.
 */
const cleanId = (id) => {
    if (!id) return null;
    const cleaned = id.toString().replace(/['"]+/g, '').trim();
    if (!mongoose.Types.ObjectId.isValid(cleaned)) return null;
    return new mongoose.Types.ObjectId(cleaned);
};

/**
 * Format a Date as HH:MM AM/PM in Indian locale.
 * Always returns a string — never throws.
 */
const fmtTime = (d) => {
    if (!d) return 'N/A';
    try {
        return new Date(d).toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', hour12: true,
            timeZone: 'Asia/Kolkata',
        });
    } catch {
        return 'N/A';
    }
};

/**
 * Format a Date as DD/MM/YYYY HH:MM AM/PM in Indian locale.
 * Always returns a string — never throws.
 */
const fmtNoteTime = (d) => {
    if (!d) return 'N/A';
    try {
        const dt = new Date(d);
        const dd = String(dt.getDate()).padStart(2, '0');
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const yy = dt.getFullYear();
        const tm = dt.toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', hour12: true,
            timeZone: 'Asia/Kolkata',
        });
        return `${dd}/${mm}/${yy}  ${tm}`;
    } catch {
        return 'N/A';
    }
};

/**
 * Return today's date string in DD/MM/YYYY format (IST).
 */
const todayIST = () => {
    return new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
};

/**
 * Convert a profile image buffer to a base64 data URI, or null.
 */
const imageToDataUri = (profileImage) => {
    if (!profileImage || !profileImage.data) return null;
    return `data:${profileImage.contentType};base64,`
        + Buffer.from(profileImage.data).toString('base64');
};

/**
 * Build the shiftStart / shiftEnd strings consistently across all routes.
 */
const shiftTimes = (shift) => {
    const shiftStart = fmtTime(shift.startTime);
    const shiftEnd = (shift.logoutTime && shift.logoutTime !== 'Ongoing')
        ? (shift.endTime ? fmtTime(shift.endTime) : shift.logoutTime)
        : 'Ongoing';
    return { shiftStart, shiftEnd };
};

// ─────────────────────────────────────────────
//  SOCKET.IO — REAL-TIME TRACKING
// ─────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log('🔌 Socket connected:', socket.id);

    socket.on('join_shift', ({ shiftId }) => {
        if (!shiftId) return;
        socket.join(`shift_${shiftId}`);
        console.log(`👷 Worker joined shift room: shift_${shiftId}`);
    });

    socket.on('watch_shift', ({ shiftId }) => {
        if (!shiftId) return;
        socket.join(`shift_${shiftId}`);
        console.log(`👁️ Admin watching shift: ${shiftId}`);
    });

    socket.on('location_update', async ({ userId, latitude, longitude, shiftId, accuracy, speed }) => {
        try {
            const lat = parseFloat(latitude);
            const lng = parseFloat(longitude);
            if (!isFinite(lat) || !isFinite(lng)) return;
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

            const uid = cleanId(userId);
            if (!uid) return;

            const shift = await Shift.findOneAndUpdate(
                { userId: uid, logoutTime: 'Ongoing' },
                { $push: { path: { latitude: lat, longitude: lng, timestamp: new Date() } } },
                { new: true }
            );
            if (!shift) return;

            io.to(`shift_${shift._id.toString()}`).emit('location_updated', {
                latitude: lat,
                longitude: lng,
                accuracy: accuracy != null ? parseFloat(accuracy) : null,
                speed: speed != null ? parseFloat(speed) : null,
                shiftId: shift._id.toString(),
                totalPoints: shift.path.length,
            });
        } catch (err) {
            console.error('Socket location_update error:', err.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ Socket disconnected:', socket.id);
    });
});

// ─────────────────────────────────────────────
//  AUTH ROUTES
// ─────────────────────────────────────────────

app.get('/api/auth/profile/:userId', async (req, res) => {
    try {
        const id = req.params.userId.replace(/['"]+/g, '').trim();
        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ message: 'Invalid ID format' });

        const user = await User.findById(id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const userObj = user.toObject();
        if (user.profileImage && user.profileImage.data)
            userObj.profileImage.data = user.profileImage.data.toString('base64');

        res.json(userObj);
    } catch (err) {
        console.error('Profile fetch error:', err.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).json({ message: 'Email and password are required' });

        // NOTE: Passwords should be hashed (bcrypt) — this compares plaintext
        // until the model is migrated.  Replace with bcrypt.compare() once hashes exist.
        const user = await User.findOne({ email: email.trim().toLowerCase(), password });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const activeShift = await Shift.findOne({ userId: user._id, logoutTime: 'Ongoing' });

        res.json({
            userId: user._id.toString(),
            name: user.name,
            role: user.role,
            isShiftActive: !!activeShift,
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password, profileImage, role, adminKey } = req.body;

        if (!name || !email || !password)
            return res.status(400).json({ message: 'Name, email, and password are required' });

        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) return res.status(409).json({ message: 'Email already in use' });

        let finalRole = 'worker';
        if (role === 'admin') {
            const ADMIN_KEY = process.env.ADMIN_KEY || 'admin';
            if (adminKey !== ADMIN_KEY)
                return res.status(403).json({ message: 'Invalid Admin Key.' });
            finalRole = 'admin';
        }

        const newUser = new User({ name: name.trim(), email: normalizedEmail, password, role: finalRole });

        if (profileImage) {
            newUser.profileImage = {
                data: Buffer.from(profileImage, 'base64'),
                contentType: 'image/jpeg',
            };
        }

        await newUser.save();
        res.status(201).json({ userId: newUser._id });
    } catch (err) {
        console.error('Signup error:', err.message);
        res.status(500).json({ message: 'Signup failed: ' + err.message });
    }
});

// ─────────────────────────────────────────────
//  SHIFT ROUTES
// ─────────────────────────────────────────────

app.post('/api/shift/start', async (req, res) => {
    try {
        const userId = cleanId(req.body.userId);
        if (!userId) return res.status(400).json({ message: 'Invalid userId' });

        const existing = await Shift.findOne({ userId, logoutTime: 'Ongoing' });
        if (existing)
            return res.status(200).json({ startTime: existing.startTime, shiftId: existing._id });

        const shift = await Shift.create({
            userId,
            startTime: new Date(),
            date: todayIST(),
            logoutTime: 'Ongoing',
            path: [],
            notes: [],
        });

        await User.findByIdAndUpdate(userId, { isShiftActive: true });
        res.status(201).json({ startTime: shift.startTime, shiftId: shift._id });
    } catch (err) {
        console.error('Shift start error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/shift/end', async (req, res) => {
    try {
        const userId = cleanId(req.body.userId);
        if (!userId) return res.status(400).json({ message: 'Invalid userId' });

        const now = new Date();
        const logoutTimeStr = fmtTime(now);

        const shift = await Shift.findOneAndUpdate(
            { userId, logoutTime: 'Ongoing' },
            { endTime: now, logoutTime: logoutTimeStr },
            { new: true }
        );

        await User.findByIdAndUpdate(userId, { isShiftActive: false });

        if (!shift) return res.status(200).json({ message: 'No active shift to end' });

        res.json({
            message: 'Shift ended',
            summary: {
                pointsTracked: shift.path.length,
                notesCaptured: shift.notes.length,
            },
        });
    } catch (err) {
        console.error('Shift end error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/shift/active/:userId', async (req, res) => {
    try {
        const userId = cleanId(req.params.userId);
        if (!userId) return res.status(400).json({ message: 'Invalid userId' });

        const shift = await Shift.findOne({ userId, logoutTime: 'Ongoing' }).lean();
        if (!shift) return res.status(404).json({ message: 'No active shift' });

        res.json(shift);
    } catch (err) {
        console.error('Active shift error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/shift-details/:shiftId', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.shiftId))
            return res.status(400).json({ message: 'Invalid shiftId' });

        const shift = await Shift.findById(req.params.shiftId).populate('notes').lean();
        if (!shift) return res.status(404).json({ message: 'Shift not found' });

        res.status(200).json({ date: shift.date, path: shift.path || [], notes: shift.notes || [] });
    } catch (err) {
        console.error('Shift details error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
//  TRACKING ROUTE (HTTP fallback)
// ─────────────────────────────────────────────

app.post('/api/track', async (req, res) => {
    try {
        const userId = cleanId(req.body.userId);
        if (!userId) return res.status(400).json({ message: 'Invalid userId' });

        const lat = parseFloat(req.body.latitude);
        const lng = parseFloat(req.body.longitude);
        if (!isFinite(lat) || !isFinite(lng))
            return res.status(400).json({ message: 'Invalid coordinates' });
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
            return res.status(400).json({ message: 'Coordinates out of valid range' });

        const shift = await Shift.findOneAndUpdate(
            { userId, logoutTime: 'Ongoing' },
            { $push: { path: { latitude: lat, longitude: lng, timestamp: new Date() } } },
            { new: true }
        );
        if (!shift) return res.status(404).json({ message: 'No active shift' });

        io.to(`shift_${shift._id.toString()}`).emit('location_updated', {
            latitude: lat,
            longitude: lng,
            accuracy: req.body.accuracy != null ? parseFloat(req.body.accuracy) : null,
            speed: null,
            shiftId: shift._id.toString(),
            totalPoints: shift.path.length,
        });

        res.status(200).json({ count: shift.path.length });
    } catch (err) {
        console.error('Track error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────
//  NOTES ROUTES
// ─────────────────────────────────────────────

app.post('/api/notes', async (req, res) => {
    try {
        const {
            userId, className, directorName, directorNumber, address,
            contactPersonName, contactPersonNumber, studentCount, classCount, remark,
            latitude, longitude,
        } = req.body;

        if (!userId) return res.status(400).json({ message: 'userId is required' });

        const uid = cleanId(userId);
        if (!uid) return res.status(400).json({ message: 'Invalid userId' });

        // Validate optional coordinates if provided
        let lat = null, lng = null;
        if (latitude != null && longitude != null) {
            lat = parseFloat(latitude);
            lng = parseFloat(longitude);
            if (!isFinite(lat) || !isFinite(lng)) {
                lat = null;
                lng = null;
            }
        }

        const newNote = new Note({
            userId: uid,
            className: className?.trim() || '',
            directorName: directorName?.trim() || '',
            directorNumber: directorNumber?.trim() || '',
            address: address?.trim() || '',
            contactPersonName: contactPersonName?.trim() || '',
            contactPersonNumber: contactPersonNumber?.trim() || '',
            studentCount: parseInt(studentCount) || 0,
            classCount: parseInt(classCount) || 0,
            remark: remark?.trim() || '',
            latitude: lat,
            longitude: lng,
            createdAt: new Date(),
        });
        await newNote.save();

        const shift = await Shift.findOneAndUpdate(
            { userId: uid, logoutTime: 'Ongoing' },
            { $push: { notes: newNote._id } },
            { new: true }
        );
        if (!shift) return res.status(404).json({ message: 'No active shift found' });

        io.to(`shift_${shift._id.toString()}`).emit('note_added', {
            _id: newNote._id.toString(),
            className: newNote.className,
            directorName: newNote.directorName,
            directorNumber: newNote.directorNumber,
            address: newNote.address,
            contactPersonName: newNote.contactPersonName,
            contactPersonNumber: newNote.contactPersonNumber,
            studentCount: newNote.studentCount,
            classCount: newNote.classCount,
            remark: newNote.remark,
            latitude: newNote.latitude,
            longitude: newNote.longitude,
            createdAt: newNote.createdAt,
        });

        console.log(`📝 Note saved + emitted to shift_${shift._id}: ${newNote.className}`);
        res.status(201).json({ message: 'Note recorded and linked to shift' });
    } catch (err) {
        console.error('Note save error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────
//  ADMIN NOTES DASHBOARD ROUTES
// ─────────────────────────────────────────────

/**
 * GET /api/admin/notes
 * All notes across all workers with worker + shift context.
 * Query params:
 *   ?date=DD/MM/YYYY        — filter by date
 *   ?workerId=<objectId>    — filter by worker
 *   ?search=<text>          — search className, directorName, address
 *   ?page=1&limit=20        — pagination
 */
app.get('/api/admin/notes', async (req, res) => {
    try {
        const { date, workerId, search, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const shiftFilter = {};
        if (date) shiftFilter.date = date.trim();
        if (workerId) {
            const wid = cleanId(workerId);
            if (!wid) return res.status(400).json({ message: 'Invalid workerId' });
            shiftFilter.userId = wid;
        }

        const shifts = await Shift.find(shiftFilter)
            .populate('userId', 'name email profileImage')
            .populate('notes')
            .sort({ startTime: -1 })
            .lean();

        let allNotes = [];

        for (const shift of shifts) {
            if (!shift.notes || shift.notes.length === 0) continue;

            const workerImage = imageToDataUri(shift.userId?.profileImage);
            const { shiftStart, shiftEnd } = shiftTimes(shift);

            for (const note of shift.notes) {
                allNotes.push({
                    _id: note._id,
                    className: note.className,
                    directorName: note.directorName,
                    directorNumber: note.directorNumber,
                    address: note.address,
                    contactPersonName: note.contactPersonName,
                    contactPersonNumber: note.contactPersonNumber,
                    studentCount: note.studentCount,
                    classCount: note.classCount,
                    remark: note.remark,
                    latitude: note.latitude,
                    longitude: note.longitude,
                    createdAt: note.createdAt,
                    shiftId: shift._id,
                    shiftDate: shift.date,
                    shiftStart,
                    shiftEnd,
                    shiftStatus: shift.logoutTime === 'Ongoing' ? 'ongoing' : 'completed',
                    worker: {
                        _id: shift.userId?._id,
                        name: shift.userId?.name || 'Unknown',
                        email: shift.userId?.email || '',
                        profileImage: workerImage,
                    },
                });
            }
        }

        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            allNotes = allNotes.filter(n =>
                (n.className || '').toLowerCase().includes(q) ||
                (n.directorName || '').toLowerCase().includes(q) ||
                (n.address || '').toLowerCase().includes(q)
            );
        }

        allNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const total = allNotes.length;
        const paginated = allNotes.slice(skip, skip + parseInt(limit));

        res.status(200).json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
            notes: paginated,
        });
    } catch (err) {
        console.error('Admin notes error:', err);
        res.status(500).json({ message: err.message });
    }
});

/**
 * GET /api/admin/notes/today
 * Summary of today's notes grouped by worker.
 */
app.get('/api/admin/notes/today', async (req, res) => {
    try {
        const todayStr = todayIST();

        const shifts = await Shift.find({ date: todayStr })
            .populate('userId', 'name profileImage')
            .populate('notes')
            .lean();

        const summary = shifts
            .filter(s => s.notes && s.notes.length > 0)
            .map(shift => {
                const workerImage = imageToDataUri(shift.userId?.profileImage);
                const { shiftStart, shiftEnd } = shiftTimes(shift);

                return {
                    shiftId: shift._id,
                    shiftDate: shift.date,
                    shiftStart,
                    shiftEnd,
                    shiftStatus: shift.logoutTime === 'Ongoing' ? 'ongoing' : 'completed',
                    worker: {
                        _id: shift.userId?._id,
                        name: shift.userId?.name || 'Unknown',
                        profileImage: workerImage,
                    },
                    totalNotes: shift.notes.length,
                    notes: shift.notes.map(n => ({
                        _id: n._id,
                        className: n.className,
                        directorName: n.directorName,
                        directorNumber: n.directorNumber,
                        address: n.address,
                        contactPersonName: n.contactPersonName,
                        contactPersonNumber: n.contactPersonNumber,
                        studentCount: n.studentCount,
                        classCount: n.classCount,
                        remark: n.remark,
                        latitude: n.latitude,
                        longitude: n.longitude,
                        createdAt: n.createdAt,
                    })),
                };
            });

        const totalNotes = summary.reduce((acc, s) => acc + s.totalNotes, 0);

        res.status(200).json({
            date: todayStr,
            totalNotes,
            totalWorkers: summary.length,
            workers: summary,
        });
    } catch (err) {
        console.error('Today notes error:', err);
        res.status(500).json({ message: err.message });
    }
});

/**
 * GET /api/admin/notes/worker/:workerId
 * All notes for a specific worker, newest first, with shift context.
 */
app.get('/api/admin/notes/worker/:workerId', async (req, res) => {
    try {
        const userId = cleanId(req.params.workerId);
        if (!userId) return res.status(400).json({ message: 'Invalid worker ID' });

        const user = await User.findById(userId).select('name email profileImage');
        if (!user) return res.status(404).json({ message: 'Worker not found' });

        const shifts = await Shift.find({ userId })
            .populate('notes')
            .sort({ startTime: -1 })
            .lean();

        const allNotes = [];

        for (const shift of shifts) {
            if (!shift.notes || shift.notes.length === 0) continue;

            const { shiftStart, shiftEnd } = shiftTimes(shift);

            for (const note of shift.notes) {
                allNotes.push({
                    _id: note._id,
                    className: note.className,
                    directorName: note.directorName,
                    directorNumber: note.directorNumber,
                    address: note.address,
                    contactPersonName: note.contactPersonName,
                    contactPersonNumber: note.contactPersonNumber,
                    studentCount: note.studentCount,
                    classCount: note.classCount,
                    remark: note.remark,
                    latitude: note.latitude,
                    longitude: note.longitude,
                    createdAt: note.createdAt,
                    shiftId: shift._id,
                    shiftDate: shift.date,
                    shiftStart,
                    shiftEnd,
                    shiftStatus: shift.logoutTime === 'Ongoing' ? 'ongoing' : 'completed',
                });
            }
        }

        allNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.status(200).json({
            worker: {
                _id: user._id,
                name: user.name,
                email: user.email,
                profileImage: imageToDataUri(user.profileImage),
            },
            totalNotes: allNotes.length,
            notes: allNotes,
        });
    } catch (err) {
        console.error('Worker notes error:', err);
        res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────
//  HISTORY ROUTE
// ─────────────────────────────────────────────

app.get('/api/history/:userId', async (req, res) => {
    try {
        const userId = cleanId(req.params.userId);
        if (!userId) return res.status(400).json({ message: 'Invalid User ID format' });

        const archivedShifts = await Shift.find({ userId })
            .sort({ startTime: -1 })
            .populate('notes');

        const historyLog = archivedShifts.map(s => {
            const { shiftStart: loginTime, shiftEnd: logoutTime } = shiftTimes(s);
            return {
                _id: s._id,
                date: s.date,
                loginTime,
                logoutTime,
                path: s.path || [],
                notes: s.notes || [],
            };
        });

        res.status(200).json(historyLog);
    } catch (err) {
        console.error('History error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
//  ADMIN ROUTES
// ─────────────────────────────────────────────

app.get('/api/admin/ongoing-shifts', async (req, res) => {
    try {
        const shifts = await Shift.find({ logoutTime: 'Ongoing' })
            .populate('userId', 'name profileImage')
            .sort({ startTime: -1 });
        res.json(shifts);
    } catch (err) {
        console.error('Ongoing shifts error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/admin/shift/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ message: 'Invalid shift ID' });

        const shift = await Shift.findById(req.params.id).populate('notes');
        if (!shift) return res.status(404).json({ message: 'Shift not found' });

        res.json(shift);
    } catch (err) {
        console.error('Admin shift error:', err.message);
        res.status(500).json({ message: 'Error fetching shift' });
    }
});

app.get('/api/admin/all-workers', async (req, res) => {
    try {
        const workers = await User.find({ role: 'worker' })
            .select('name email profileImage role')
            .sort({ name: 1 });

        const formatted = workers.map(worker => {
            const obj = worker.toObject();
            obj.profileImage = imageToDataUri(worker.profileImage) || null;
            return obj;
        });

        res.status(200).json(formatted);
    } catch (err) {
        console.error('All workers error:', err.message);
        res.status(500).json({ message: 'Error fetching worker data' });
    }
});

// ═════════════════════════════════════════════════════════════════════════════
//  EXCEL WORKSHEET BUILDER
//
//  Columns A–M:
//  A  Visit #
//  B  Class / School Name       ← bold dark blue
//  C  Note Saved At             ← amber highlight, italic
//  D  Director / Owner
//  E  Director Phone
//  F  Address
//  G  Contact Person
//  H  Contact Phone
//  I  Students
//  J  Classes
//  K  Remark
//  L  Shift Start               ← green highlight
//  M  Shift End                 ← red highlight
// ═════════════════════════════════════════════════════════════════════════════

const C = {
    TITLE_BG: 'FF1E40AF',
    TITLE_FG: 'FFFFFFFF',
    HDR_BG: 'FF1E3A5F',
    HDR_FG: 'FFFFFFFF',
    SHIFT_BG: 'FFE8F5E9',
    SHIFT_FG: 'FF14532D',
    SHIFT_BORD: 'FF16A34A',
    NOTE_TIME: 'FFFFF8E1',
    NOTE_FG: 'FFB45309',
    ALT_ROW: 'FFF0F4FF',
    WHITE: 'FFFFFFFF',
    NO_VISIT: 'FFFFF3F3',
    NO_VISIT_FG: 'FFDC2626',
    SEP: 'FFF8FAFC',
    CLASS_FG: 'FF1E3A5F',
    SSTART_BG: 'FFE8F5E9',
    SSTART_FG: 'FF14532D',
    SEND_BG: 'FFFFF0F0',
    SEND_FG: 'FFDC2626',
};

const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const color = (argb) => ({ argb });

const THIN_BORDER = {
    top: { style: 'thin', color: color('FFD1D5DB') },
    left: { style: 'thin', color: color('FFD1D5DB') },
    bottom: { style: 'thin', color: color('FFD1D5DB') },
    right: { style: 'thin', color: color('FFD1D5DB') },
};
const SHIFT_BORDER = {
    top: { style: 'medium', color: color(C.SHIFT_BORD) },
    left: { style: 'medium', color: color(C.SHIFT_BORD) },
    bottom: { style: 'medium', color: color(C.SHIFT_BORD) },
    right: { style: 'medium', color: color(C.SHIFT_BORD) },
};

const NUM_COLS = 13;
const LAST_COL = 'M';

const buildWorksheet = (ws, titleValue, shifts) => {
    ws.columns = [
        { key: 'visitNo', width: 9 },  // A
        { key: 'className', width: 28 },  // B
        { key: 'noteTime', width: 22 },  // C
        { key: 'directorName', width: 22 },  // D
        { key: 'directorPhone', width: 16 },  // E
        { key: 'address', width: 36 },  // F
        { key: 'contactPerson', width: 22 },  // G
        { key: 'contactPhone', width: 16 },  // H
        { key: 'students', width: 11 },  // I
        { key: 'classes', width: 10 },  // J
        { key: 'remark', width: 28 },  // K
        { key: 'shiftStart', width: 16 },  // L
        { key: 'shiftEnd', width: 16 },  // M
    ];

    // ── ROW 1: Report title ───────────────────────────────────────────────
    ws.mergeCells(`A1:${LAST_COL}1`);
    Object.assign(ws.getCell('A1'), {
        value: titleValue,
        font: { bold: true, size: 15, color: color(C.TITLE_FG) },
        alignment: { horizontal: 'center', vertical: 'middle' },
        fill: fill(C.TITLE_BG),
    });
    ws.getRow(1).height = 38;

    // ── ROW 2: Column headers ─────────────────────────────────────────────
    const hdr = ws.addRow([
        'Visit #',
        'Class / School Name',
        '🕐 Note Saved At',
        'Director / Owner',
        'Director Phone',
        'Address',
        'Contact Person',
        'Contact Phone',
        'Students',
        'Classes',
        'Remark',
        '🟢 Shift Start',
        '🔴 Shift End',
    ]);
    hdr.height = 30;
    hdr.eachCell(cell => {
        cell.font = { bold: true, size: 11, color: color(C.HDR_FG) };
        cell.fill = fill(C.HDR_BG);
        cell.border = THIN_BORDER;
        cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    });

    ws.views = [{ state: 'frozen', ySplit: 2 }];

    // ── DATA ROWS ─────────────────────────────────────────────────────────
    let noteRowIdx = 0;

    shifts.forEach((shift, shiftIdx) => {
        const { shiftStart: loginTime, shiftEnd: endTime } = shiftTimes(shift);
        const totalVisits = shift.notes ? shift.notes.length : 0;

        // ── Shift header row ──────────────────────────────────────────────
        const shiftHdrRow = ws.addRow(Array(NUM_COLS).fill(''));
        shiftHdrRow.height = 24;
        const r = shiftHdrRow.number;

        ws.mergeCells(`A${r}:B${r}`);
        ws.mergeCells(`C${r}:F${r}`);
        ws.mergeCells(`G${r}:I${r}`);
        ws.mergeCells(`J${r}:${LAST_COL}${r}`);

        const shiftCellStyle = {
            fill: fill(C.SHIFT_BG),
            border: SHIFT_BORDER,
            font: { bold: true, size: 11, color: color(C.SHIFT_FG) },
            alignment: { vertical: 'middle', wrapText: false },
        };

        const setShiftCell = (addr, value, extraAlign = {}) => {
            const cell = ws.getCell(addr);
            Object.assign(cell, shiftCellStyle);
            cell.value = value;
            cell.alignment = { ...shiftCellStyle.alignment, ...extraAlign };
        };

        setShiftCell(`A${r}`, `📅  ${shift.date || 'N/A'}`);
        setShiftCell(`C${r}`, `🟢  Login: ${loginTime}`);
        setShiftCell(`G${r}`, `🔴  End: ${endTime}`);
        setShiftCell(`J${r}`, `${totalVisits} visit${totalVisits !== 1 ? 's' : ''}`, { horizontal: 'right' });

        // ── Note rows ─────────────────────────────────────────────────────
        if (totalVisits > 0) {
            shift.notes.forEach((note, idx) => {
                noteRowIdx++;
                const rowFill = noteRowIdx % 2 === 0 ? fill(C.ALT_ROW) : fill(C.WHITE);

                const noteRow = ws.addRow([
                    idx + 1,
                    note.className || '',
                    fmtNoteTime(note.createdAt),
                    note.directorName || '',
                    note.directorNumber || '',
                    note.address || '',
                    note.contactPersonName || '',
                    note.contactPersonNumber || '',
                    note.studentCount ?? 0,
                    note.classCount ?? 0,
                    note.remark || '',
                    loginTime,
                    endTime,
                ]);
                noteRow.height = 22;

                noteRow.eachCell({ includeEmpty: true }, (cell, col) => {
                    cell.border = THIN_BORDER;
                    cell.alignment = { wrapText: true, vertical: 'top' };

                    switch (col) {
                        case 1:   // A — Visit #
                            cell.fill = rowFill;
                            cell.alignment = { horizontal: 'center', vertical: 'top' };
                            cell.font = { bold: true, color: color('FF64748B') };
                            break;
                        case 2:   // B — Class name
                            cell.fill = rowFill;
                            cell.font = { bold: true, size: 11, color: color(C.CLASS_FG) };
                            break;
                        case 3:   // C — Note Saved At
                            cell.fill = fill(C.NOTE_TIME);
                            cell.font = { italic: true, size: 10, color: color(C.NOTE_FG) };
                            break;
                        case 9:   // I — Students
                        case 10:  // J — Classes
                            cell.fill = rowFill;
                            cell.alignment = { horizontal: 'center', vertical: 'top' };
                            cell.font = { bold: true };
                            break;
                        case 12:  // L — Shift Start
                            cell.fill = fill(C.SSTART_BG);
                            cell.font = { bold: true, color: color(C.SSTART_FG) };
                            cell.alignment = { horizontal: 'center', vertical: 'top' };
                            break;
                        case 13:  // M — Shift End
                            cell.fill = fill(C.SEND_BG);
                            cell.font = { bold: true, color: color(C.SEND_FG) };
                            cell.alignment = { horizontal: 'center', vertical: 'top' };
                            break;
                        default:
                            cell.fill = rowFill;
                    }
                });
            });
        } else {
            // No visits for this shift — fill all 13 columns correctly
            const noRow = ws.addRow([
                '—', 'No visits recorded',
                '—', '', '', '', '', '',
                0, 0, '',
                loginTime,
                endTime,
            ]);
            noRow.height = 20;
            noRow.eachCell({ includeEmpty: true }, cell => {
                cell.fill = fill(C.NO_VISIT);
                cell.border = THIN_BORDER;
                cell.font = { italic: true, color: color(C.NO_VISIT_FG) };
                cell.alignment = { wrapText: true, vertical: 'middle' };
            });
        }

        // ── Thin separator between shifts ─────────────────────────────────
        if (shiftIdx < shifts.length - 1) {
            const sep = ws.addRow(Array(NUM_COLS).fill(''));
            sep.height = 6;
            sep.eachCell({ includeEmpty: true }, cell => {
                cell.fill = fill(C.SEP);
                cell.border = { bottom: { style: 'dotted', color: color('FFE2E8F0') } };
            });
        }
    });

    ws.autoFilter = { from: 'A2', to: `${LAST_COL}2` };
};

// ═════════════════════════════════════════════════════════════════════════════
//  EXCEL EXPORT ROUTES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Parse "DD/MM/YYYY" → JS Date (midnight local).
 * Returns null on invalid input instead of throwing.
 */
const parseDMY = (str) => {
    if (!str) return null;
    const parts = str.trim().replace(/-/g, '/').split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts.map(Number);
    if (!d || !m || !y || isNaN(d) || isNaN(m) || isNaN(y)) return null;
    const dt = new Date(y, m - 1, d);
    if (isNaN(dt.getTime())) return null;
    return dt;
};

// ── Monthly report ────────────────────────────────────────────────────────────
app.get('/api/export-monthly-notes', async (req, res) => {
    try {
        const { month, year } = req.query;

        if (!month || !year)
            return res.status(400).json({ message: 'month and year query params are required' });

        // Pad month to 2 digits so "4/2025" and "04/2025" both match
        const mm = String(parseInt(month)).padStart(2, '0');
        const yy = String(parseInt(year));

        // Match DD/MM/YYYY where MM and YYYY are exact
        const datePattern = new RegExp(`^\\d{2}\\/${mm}\\/${yy}$`);

        const shifts = await Shift.find({ date: { $regex: datePattern } })
            .select('date startTime endTime logoutTime notes userId')  // ✅ ADD THIS LINE
            .populate('notes')
            .populate('userId', 'name')
            .sort({ startTime: 1 });

        const wb = new ExcelJS.Workbook();
        buildWorksheet(
            wb.addWorksheet('Monthly Report'),
            `Monthly Report — ${mm}/${yy}`,
            shifts
        );

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Report_${mm}_${yy}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Monthly export error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Single-shift report ───────────────────────────────────────────────────────
app.get('/api/download-shift-report/:shiftId', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.shiftId))
            return res.status(400).json({ message: 'Invalid shiftId' });

        const shift = await Shift.findById(req.params.shiftId)
            .select('date startTime endTime logoutTime notes userId')
            .populate('notes')
            .populate('userId', 'name');
        if (!shift) return res.status(404).json({ message: 'Shift not found' });

        const workerName = shift.userId?.name || 'Worker';
        const wb = new ExcelJS.Workbook();
        buildWorksheet(
            wb.addWorksheet('Shift Report'),
            `${workerName} (Sales Executive)  —  ${shift.date}`,
            [shift]
        );

        const safeDate = (shift.date || 'unknown').replace(/\//g, '-');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Report_${safeDate}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Shift report error:', err.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// ── Date-range report (per worker) ───────────────────────────────────────────
app.get('/api/export-range/:userId', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate)
            return res.status(400).json({ message: 'startDate and endDate query params are required' });

        const userId = cleanId(req.params.userId);
        if (!userId) return res.status(400).json({ message: 'Invalid user ID' });

        const start = parseDMY(startDate);
        const end = parseDMY(endDate);
        if (!start || !end)
            return res.status(400).json({ message: 'Invalid date format — use DD/MM/YYYY' });

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        if (start > end)
            return res.status(400).json({ message: 'startDate must not be after endDate' });

        const user = await User.findById(userId).select('name');
        if (!user) return res.status(404).json({ message: 'Worker not found' });

        const allShifts = await Shift.find({ userId })
            .select('date startTime endTime logoutTime notes userId')
            .populate('notes')
            .sort({ startTime: 1 });

        const filtered = allShifts.filter(s => {
            const d = parseDMY(s.date);
            return d && d >= start && d <= end;
        });

        if (filtered.length === 0)
            return res.status(404).json({ message: 'No shifts found in the given date range' });

        const workerName = user.name || 'Worker';
        const wb = new ExcelJS.Workbook();
        buildWorksheet(
            wb.addWorksheet('Shift Report'),
            `${workerName} (Sales Executive)   ${startDate}  →  ${endDate}`,
            filtered
        );

        const safeStart = startDate.replace(/\//g, '-');
        const safeEnd = endDate.replace(/\//g, '-');
        const fileName = `${workerName.replace(/\s+/g, '_')}_${safeStart}_to_${safeEnd}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Range export error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
//  GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────
const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down gracefully…`);
    server.close(async () => {
        await mongoose.connection.close();
        console.log('✅ Server and DB connection closed');
        process.exit(0);
    });
    // Force-exit after 10 s if still hanging
    setTimeout(() => {
        console.error('❌ Forced exit after timeout');
        process.exit(1);
    }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─────────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));