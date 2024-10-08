const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');

const PORT = 3000;
const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/KCLAS')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Schemas
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

// New schema for Spell Period
const spellPeriodSchema = new mongoose.Schema({
    startDate: Date,
    endDate: Date
});

const Department = mongoose.model('Department', departmentSchema);
const Detail = mongoose.model('Detail', detailSchema);
const SpellPeriod = mongoose.model('SpellPeriod', spellPeriodSchema);

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/files', express.static(path.join(__dirname, 'files')));

// Serve HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Faculty.html'));
});

// Get departments
app.get('/departments', async (req, res) => {
    try {
        const departments = await Department.find({});
        res.json(departments);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Get details based on department
app.get('/details', async (req, res) => {
    try {
        const department = req.query.department;
        const details = await Detail.findOne({ department });
        res.json(details || {});
    } catch (error) {
        res.status(500).send(error);
    }
});

// Fetch spell period
app.get('/getSpellPeriod', async (req, res) => {
    try {
        const spellPeriod = await SpellPeriod.findOne({});
        res.json(spellPeriod || {});
    } catch (error) {
        res.status(500).send(error);
    }
});

// Fetch student data based on provided parameters
app.get('/getStudents', async (req, res) => {
    try {
        const { department, batch, semester, subject, exam } = req.query;

        const collectionName = `${department.replace(/[^a-zA-Z]/g, '').toLowerCase()}_${batch.split(" - ")[0]}_${semester.split(" ")[1].toLowerCase()}_${subject.replace(/[^a-zA-Z]/g, '').toLowerCase()}_${exam.toLowerCase()}`;
        
        const db = mongoose.connection.db;
        const collection = db.collection(collectionName);
        const data = await collection.find({}).toArray();

        if (data.length === 0) {
            return res.status(404).send("No data found for the selected parameters.");
        }

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

// Save entered marks
app.post('/saveMarks', async (req, res) => {
    try {
        const { department, batch, semester, subject, exam, marksData } = req.body;

        const collectionName = `${department.replace(/[^a-zA-Z]/g, '').toLowerCase()}_${batch.split(" - ")[0]}_${semester.split(" ")[1].toLowerCase()}_${subject.replace(/[^a-zA-Z]/g, '').toLowerCase()}_${exam.toLowerCase()}`;
        
        const db = mongoose.connection.db;
        const collection = db.collection(collectionName);

        for (const student of marksData) {
            await collection.updateOne(
                { regno: student.regno },
                { $set: { cia: student.cia, cia_converted: student.cia_converted } }
            );
        }

        res.send("Marks updated successfully!");
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred while saving the marks.");
    }
});

// Start the server
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// Modal functionality for Enter Marks
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('marksModal');
    const openModalBtn = document.getElementById('openModal');
    const closeModalBtn = document.getElementById('closeModal');
    const saveMarksBtn = document.getElementById('saveMarks');

    openModalBtn.addEventListener('click', () => {
        modal.style.display = 'block';
    });

    closeModalBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    saveMarksBtn.addEventListener('click', async () => {
        const marksData = collectMarksData();
        const response = await saveMarksToServer(marksData);
        if (response.success) {
            modal.style.display = 'none';
            alert('Marks saved successfully!');
        } else {
            alert('Failed to save marks. Please try again.');
        }
    });
});

function collectMarksData() {
    // Initialize an empty array to store the collected marks data
    const marksData = [];

    // Assuming each student's data is in a row within a table or form
    const rows = document.querySelectorAll('.marks-row'); // Adjust the selector based on your form structure

    rows.forEach(row => {
        const regno = row.querySelector('.regno-input').value; // Replace with actual selector
        const cia = parseFloat(row.querySelector('.cia-input').value); // Replace with actual selector
        const cia_converted = parseFloat(row.querySelector('.cia-converted-input').value); // Replace with actual selector

        // Push the collected data into the marksData array
        marksData.push({
            regno,
            cia,
            cia_converted
        });
    });

    return marksData; // Return the collected data
}

async function saveMarksToServer(marksData) {
    // Function to send the collected marks data to the server
    try {
        const response = await fetch('/saveMarks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(marksData),
        });

        return await response.json();
    } catch (error) {
        console.error('Error saving marks:', error);
        return { success: false };
    }
}
