const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  className: { type: String, required: true },
  directorName: { type: String },
  directorNumber: { type: String },
  address: { type: String },
  contactPersonName: { type: String },
  contactPersonNumber: { type: String },
  studentCount: { type: Number, default: 0 },
  classCount: { type: Number, default: 0 },
  remark: { type: String, default: '' },
  latitude: { type: Number, default: null },   // ✅ not required (matches server logic)
  longitude: { type: Number, default: null },  // ✅ not required (matches server logic)
  shiftStart: { type: String, default: '' },   // ✅ NEW — e.g. "09:30 AM"
  shiftEnd: { type: String, default: '' },     // ✅ NEW — e.g. "06:00 PM" or "Ongoing"
}, { timestamps: true });

module.exports = mongoose.model('Note', NoteSchema);
