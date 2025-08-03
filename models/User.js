const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  role: { type: String, required: true , enum: ['Safety-Officer', 'Moderator', 'Department-In-Charge', 'Supervisor'],},
  name: { type: String }, // ✅ New field for user-friendly name
});

module.exports = mongoose.model('User', userSchema);
