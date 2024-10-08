const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');

const app = express();
const port = 5000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/KCLAS')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// User schema
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    match: [/^\S+@\S+\.\S+$/, 'Email is invalid']
  },
  password: {
    type: String,
    required: [true, 'Password is required']
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: ['admin', 'faculty']
  },
  passwordResetToken: String,
  passwordResetExpires: Date
});

const User = mongoose.model('User', userSchema);

// Authentication route
app.post('/login', async (req, res) => {
  const { email, password, role } = req.body;

  try {
    const user = await User.findOne({ email, role });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or role' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    res.json({ success: true, role: user.role });
  } catch (err) {
    console.error('Error during authentication:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Password change request route
app.post('/request-password-change', async (req, res) => {
  const { email, currentPassword, newPassword, role } = req.body;

  try {
    const user = await User.findOne({ email, role });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid email or role' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ success: false, message: 'Invalid current password' });
    }

    // Generate password reset token
    const token = crypto.randomBytes(20).toString('hex');
    user.passwordResetToken = token;
    user.passwordResetExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'Outlook',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Send email with token
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Change Verification',
      text: `You requested a password change. Please verify this change by clicking the link below within 1 hour:\n\nhttp://localhost:5000/verify-password-change/${token}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, message: 'Error sending email' });
      } else {
        res.json({ success: true, message: 'Verification email sent' });
      }
    });
  } catch (err) {
    console.error('Error during password change request:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Password change verification route
app.get('/verify-password-change/:token', async (req, res) => {
  try {
    const user = await User.findOne({ passwordResetToken: req.params.token, passwordResetExpires: { $gt: Date.now() } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Password reset token is invalid or has expired' });
    }
    // Password change form
    res.send(`
      <form action="/confirm-password-change/${user.passwordResetToken}" method="POST">
        <input type="password" name="newPassword" placeholder="New Password" required>
        <input type="submit" value="Change Password">
      </form>
    `);
  } catch (err) {
    console.error('Error during password change verification:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Password change confirmation route
app.post('/confirm-password-change/:token', async (req, res) => {
  try {
    const user = await User.findOne({ passwordResetToken: req.params.token, passwordResetExpires: { $gt: Date.now() } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Password reset token is invalid or has expired' });
    }

    const hashedNewPassword = await bcrypt.hash(req.body.newPassword, 10);
    user.password = hashedNewPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Error during password change confirmation:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
