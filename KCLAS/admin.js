const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const PORT = 4000;
const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/KCLAS')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

const departmentSchema = new mongoose.Schema({
    value: String,
    label: String
});

const detailSchema = new mongoose.Schema({
    department: String,
    batches: [String],
    semesters: [String],
    exams: [String],
    subjects: Object
});

const spellPeriodSchema = new mongoose.Schema({
    examType: String,
    startDate: Date,
    endDate: Date,
    active: Boolean
});

const Department = mongoose.model('Department', departmentSchema);
const Detail = mongoose.model('Detail', detailSchema);
const SpellPeriod = mongoose.model('SpellPeriod', spellPeriodSchema);

// Serve static files from the "public" and "files" directories
app.use(express.static(path.join(__dirname, 'public')));
app.use('/files', express.static(path.join(__dirname, 'files')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Admin.html'));
});

app.get('/departments', async (req, res) => {
    try {
        const departments = await Department.find({});
        res.json(departments);
    } catch (error) {
        res.status(500).send('Error retrieving departments');
    }
});

app.get('/details', async (req, res) => {
    try {
        const department = req.query.department;
        const details = await Detail.findOne({ department: department });
        res.json(details || {});
    } catch (error) {
        res.status(500).send('Error retrieving details');
    }
});

// Endpoint to add a new department
app.post('/addDepartment', async (req, res) => {
    const { departmentName, batches, semesters, exams, subjects } = req.body;
    try {
        await Department.create({ value: departmentName, label: departmentName });
        await Detail.create({ department: departmentName, batches, semesters, exams, subjects });
        res.json({ success: true });
    } catch (err) {
        res.status(500).send('Error adding department');
    }
});

// Endpoint to remove a department
app.post('/removeDepartment', async (req, res) => {
    const { department } = req.body;
    try {
        await Department.deleteOne({ value: department });
        await Detail.deleteOne({ department });
        res.json({ success: true });
    } catch (err) {
        res.status(500).send('Error removing department');
    }
});

// Endpoint to set the Spell Period
// Endpoint to set the Spell Period
app.post('/setSpellPeriod', async (req, res) => {
    const { examType, startDate, endDate } = req.body;

    try {
        // Clear existing spell periods data
        const result = await SpellPeriod.deleteMany({});
        console.log(`Removed ${result.deletedCount} old spell periods.`);

        // Create a new spell period
        const newSpellPeriod = new SpellPeriod({
            examType,
            startDate,
            endDate,
            active: true
        });

        await newSpellPeriod.save();
        res.json({ success: true, message: 'Spell Period set successfully and old spell periods cleared.' });
    } catch (err) {
        console.error('Error setting Spell Period:', err);
        res.status(500).send('Error setting Spell Period');
    }
});

// Endpoint to check if the Spell Period is active
app.get('/checkSpellPeriod', async (req, res) => {
    try {
        const currentDate = new Date();
        const spellPeriod = await SpellPeriod.findOne({
            active: true,
            startDate: { $lte: currentDate },
            endDate: { $gte: currentDate }
        });

        if (spellPeriod) {
            res.json({
                active: true,
                examType: spellPeriod.examType
            });
        } else {
            res.json({ active: false });
        }
    } catch (err) {
        res.status(500).send('Error checking Spell Period');
    }
});

// Endpoint to get Excel file URL with proper capitalization
app.get('/getExcelFile', (req, res) => {
    try {
        const department = req.query.department;
        const batch = req.query.batch;
        const year = batch.split(" - ")[0];

        // Capitalize the first letter of each word in the department name
        const departmentCapitalized = department
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');

        // Ensure full capitalization where needed
        const departmentFileName = `${departmentCapitalized}_${year}_dept.xlsx`;
        const filePath = path.join(__dirname, 'files', departmentFileName);
        
        // Check if file exists and respond accordingly
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                res.status(404).json({ error: 'File not found' });
            } else {
                res.json({ fileUrl: `/files/${departmentFileName}` });
            }
        });
    } catch (error) {
        res.status(500).send(error);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
