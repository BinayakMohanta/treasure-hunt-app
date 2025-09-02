require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const { loadGameDataFromSheets, getGameData } = require('./gameData');

const app = express();
app.use(cors());
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

io.on('connection', (socket) => { console.log('A user connected:', socket.id); });

// API endpoint to get all teams for the admin view
app.get('/api/teams/all', async (req, res) => {
    try {
        const teams = await teamsCollection.find({}).toArray();
        res.status(200).json(teams);
    } catch (error) { res.status(500).json({ message: "Error fetching teams." }); }
});

// API endpoint for participant login
app.post('/api/teams/login', async (req, res) => {
    const { teamCode } = req.body;
    try {
        const team = await teamsCollection.findOne({ teamCode });
        if (team) res.status(200).json(team);
        else res.status(404).json({ message: 'Team code not found.' });
    } catch (error) { res.status(500).json({ message: 'Server error.' }); }
});

// API endpoint for uploading selfies
app.post('/api/teams/upload-selfie', async (req, res) => {
    const { teamCode, imageSrc } = req.body;
    try {
        const result = await teamsCollection.findOneAndUpdate(
            { teamCode },
            { $set: { "selfie.url": imageSrc, "selfie.isVerified": false } },
            { returnDocument: 'after' }
        );
        if (result) {
            io.emit('newSelfieForVerification', result);
            res.status(200).json({ message: 'Selfie uploaded.' });
        } else {
            res.status(404).json({ message: 'Team not found.' });
        }
    } catch (error) { res.status(500).json({ message: 'Server error.' }); }
});

// API endpoint for admin to verify selfies
app.post('/api/teams/verify-selfie', async (req, res) => {
    const { teamCode, isApproved } = req.body;
    try {
        const update = isApproved ? 
            { $set: { "selfie.isVerified": true, startTime: new Date() } } :
            { $set: { "selfie.url": "REJECTED", "selfie.isVerified": false } };

        const result = await teamsCollection.findOneAndUpdate(
            { teamCode },
            update,
            { returnDocument: 'after' }
        );
        
        if (result) {
            if (isApproved) {
                io.emit(`selfieApproved_${teamCode}`);
            }
            io.emit('teamUpdate', result);
            res.status(200).json({ message: 'Verification status updated.' });
        } else {
            res.status(404).json({ message: 'Team not found.' });
        }
    } catch (error) { res.status(500).json({ message: 'Server error.' }); }
});

// API endpoint for handling QR code scans
app.post('/api/teams/scan-qr', async (req, res) => {
    const { teamCode, qrIdentifier } = req.body;
    const { locations, routes } = getGameData();

    try {
        const team = await teamsCollection.findOne({ teamCode });
        if (!team) return res.status(404).json({ message: "Team not found." });
        if (!team.selfie.isVerified) return res.status(403).json({ message: "Selfie not verified yet." });

        const teamRoute = routes[team.routeId];
        if (!teamRoute) return res.status(404).json({ message: "Route not found for team." });

        const currentIndex = team.currentLocationIndex || 0;
        const nextLocationId = teamRoute.locations[currentIndex];
        const nextLocationDetails = locations[nextLocationId];

        if (qrIdentifier === nextLocationDetails.qrIdentifier) {
            const newLocationIndex = currentIndex + 1;
            const isFinished = newLocationIndex >= teamRoute.locations.length;

            let updateData = {
                $set: { currentLocationIndex: newLocationIndex },
                $push: { riddlesSolved: { location: nextLocationDetails.name, riddle: team.currentRiddle || "First Location Scan" } }
            };
            
            let responseData = {};

            if (isFinished) {
                updateData.$set.endTime = new Date();
                responseData = { finished: true, message: "Congratulations! You have completed the hunt!" };
            } else {
                const newRiddleLocationId = teamRoute.locations[newLocationIndex];
                const newRiddleLocation = locations[newRiddleLocationId];
                
                // *** NEW LOGIC TO HANDLE LOCATIONS WITH NO RIDDLES ***
                const riddles = newRiddleLocation.riddles;
                let newRiddle;

                if (riddles && riddles.length > 0) {
                    // If riddles exist, pick a random one
                    newRiddle = riddles[Math.floor(Math.random() * riddles.length)];
                } else {
                    // If no riddles exist (e.g., for LOC49, LOC50, LOC51), provide a generic message
                    newRiddle = `You've reached ${newRiddleLocation.name}. Proceed to your next checkpoint!`;
                }
                
                updateData.$set.currentRiddle = newRiddle;
                responseData = { correct: true, newRiddle, locationName: newRiddleLocation.name };
            }

            const updatedTeam = await teamsCollection.findOneAndUpdate(
                { teamCode },
                updateData,
                { returnDocument: 'after' }
            );
            io.emit('teamUpdate', updatedTeam);
            res.status(200).json(responseData);

        } else {
            res.status(400).json({ correct: false, message: "Wrong location! Keep searching." });
        }

    } catch (error) {
        console.error("QR Scan Error:", error);
        res.status(500).json({ message: "Server error during QR scan." });
    }
});

startServer();
