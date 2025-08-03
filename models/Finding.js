const mongoose = require('mongoose');

const FindingSchema = new mongoose.Schema({
  photo: String,
  location: String,
  createdBy: String, // Telegram ID
  assignedTo: String, // Telegram ID
  assignedByName: String, // Telegram Name
  rectificationImage: String,
  status: {
    type: String,
    enum: ['Pending', 'Assigned', 'Closed', 'Completed', 'Flagged'],
    default: 'Pending',
  },
  timestamps: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date,
  }
});

module.exports = mongoose.model('Finding', FindingSchema);
