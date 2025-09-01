require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb'); // Import ObjectId
const { loadGameDataFromSheets, getGameData } = require('./gameData');

const app = express();
app.use(cors());
// Increase the limit to allow for base64 image data
app.use(express.json({ limit: '5mb' }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

let teamsCollection;

async function startServer() {
    try {
        const client = new MongoClient(process.env.MONGO_URI);
        await client.connect();
        const db = client.db('treasureHuntDB');
        teamsCollection = db.collection('teams');
        console.log('✅ Connected to MongoDB');

        await loadGameDataFromSheets();
        
        const PORT = process.env.PORT || 4000;
        server.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
    } catch (e) { console.error("❌ Could not start server", e); }
}

io.on('connection', (socket) => console.log('A user connected:', socket.id));

// --- API Endpoints ---

// Participant Login
app.post('/api/teams/login', async (req, res) => {
    try {
        const team = await teamsCollection.findOne({ teamCode: req.body.teamCode });
        if (team) res.status(200).json(team);
        else res.status(404).json({ message: 'Team code not found.' });
    } catch (error) { res.status(500).json({ message: 'Server error.' }); }
});

// Get all teams for Admin Dashboard
app.get('/api/teams/all', async (req, res) => {
    try {
        const teams = await teamsCollection.find({}).toArray();
        res.status(200).json(teams);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching teams.' });
    }
});

// Participant uploads a selfie
app.post('/api/teams/upload-selfie', async (req, res) => {
    const { teamCode, imageSrc } = req.body;
    if (!teamCode || !imageSrc) {
        return res.status(400).json({ message: 'Team code and image are required.' });
    }
    try {
        const result = await teamsCollection.findOneAndUpdate(
            { teamCode: teamCode },
            { $set: { "selfie.url": imageSrc, "selfie.isVerified": false } },
            { returnDocument: 'after' }
        );
        
        if (result) {
            // Real-time magic: Notify all connected admins
            io.emit('newSelfieForVerification', result);
            res.status(200).json({ message: 'Selfie uploaded successfully.' });
        } else {
            res.status(404).json({ message: 'Team not found.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error uploading selfie.' });
    }
});

// Admin verifies a selfie
app.post('/api/teams/verify-selfie', async (req, res) => {
    const { teamCode, isApproved } = req.body;
    try {
        const updateData = isApproved
            ? { $set: { "selfie.isVerified": true, startTime: new Date() } } // Start timer on approval
            : { $set: { "selfie.url": "", "selfie.isVerified": false } }; // Clear selfie on rejection

        const result = await teamsCollection.findOneAndUpdate(
            { teamCode: teamCode },
            updateData,
            { returnDocument: 'after' }
        );

        if (result) {
            // Real-time magic: Notify admins and the specific participant
            io.emit('selfieVerified', result); // Notify all admins to remove from queue
            if(isApproved) {
                io.emit(`selfieApproved_${teamCode}`); // Notify only the specific team
            }
            res.status(200).json({ message: 'Verification status updated.' });
        } else {
            res.status(404).json({ message: 'Team not found.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error during verification.' });
    }
});


startServer();
