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

app.get('/api/teams/all', async (req, res) => {
    try {
        const teams = await teamsCollection.find({}).toArray();
        res.status(200).json(teams);
    } catch (error) { res.status(500).json({ message: "Error fetching teams." }); }
});

app.post('/api/teams/login', async (req, res) => {
    const { teamCode } = req.body;
    try {
        const team = await teamsCollection.findOne({ teamCode });
        if (team) res.status(200).json(team);
        else res.status(404).json({ message: 'Team code not found.' });
    } catch (error) { res.status(500).json({ message: 'Server error.' }); }
});

app.post('/api/teams/upload-selfie', async (req, res) => {
    const { teamCode, imageSrc } = req.body;
    try {
        const existingTeam = await teamsCollection.findOne({ teamCode });
        if (existingTeam.selfie && existingTeam.selfie.url && !existingTeam.selfie.isVerified) {
            return res.status(429).json({ message: 'A selfie is already pending verification.' });
        }

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

app.post('/api/teams/verify-selfie', async (req, res) => {
    const { teamCode, isApproved } = req.body;
    try {
        const { routes } = getGameData();
        const team = await teamsCollection.findOne({ teamCode });
        const teamRoute = routes[team.routeId];
        const totalLocations = teamRoute ? teamRoute.locations.length : 0;

        let update = { $set: {} };
        if (isApproved) {
            update.$set["selfie.isVerified"] = true;
            // Only set the start time if it doesn't already exist
            if (!team.startTime) {
                update.$set.startTime = new Date();
            }
            update.$set.totalLocations = totalLocations;
        } else {
            update.$set["selfie.url"] = "";
            update.$set["selfie.isVerified"] = false;
        }

        const result = await teamsCollection.findOneAndUpdate(
            { teamCode },
            update,
            { returnDocument: 'after' }
        );
        
        if (result) {
            // Use the general teamUpdate for approvals to keep frontend simple
            if (isApproved) {
                io.emit('teamUpdate', result);
            } else {
                io.emit(`selfieRejected_${teamCode}`);
            }
            io.emit('teamUpdate', result); // Also emit for admin dashboard consistency
            res.status(200).json({ message: 'Verification status updated.' });
        } else {
            res.status(404).json({ message: 'Team not found.' });
        }
    } catch (error) { res.status(500).json({ message: 'Server error.' }); }
});

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
        const currentLocationId = teamRoute.locations[currentIndex];
        const currentLocationDetails = locations[currentLocationId];

        if (qrIdentifier === currentLocationDetails.qrIdentifier) {
            const newLocationIndex = currentIndex + 1;
            const isFinished = newLocationIndex >= teamRoute.locations.length;
            const isAtPenultimateLocation = newLocationIndex === teamRoute.locations.length - 1;

            let updateData = {
                $set: { currentLocationIndex: newLocationIndex },
                $push: { riddlesSolved: { location: currentLocationDetails.name, riddle: team.currentRiddle || "First Location Scan" } }
            };
            
            let responseData = {};

            if (isFinished) {
                updateData.$set.endTime = new Date();
                responseData = { finished: true, message: "Congratulations! You have completed the hunt!" };
            } else if (isAtPenultimateLocation && teamRoute.locations.length > 4) {
                const finalClue = "You're almost there! Go back to TP to finish the hunt!";
                updateData.$set.currentRiddle = finalClue;
                responseData = { correct: true, newRiddle: finalClue };
            } else {
                const nextRiddleLocationId = teamRoute.locations[newLocationIndex];
                const nextRiddleLocation = locations[nextRiddleLocationId];
                
                const riddles = nextRiddleLocation.riddles;
                let newRiddle;

                if (riddles && riddles.length > 0) {
                    newRiddle = riddles[Math.floor(Math.random() * riddles.length)];
                } else {
                    newRiddle = `You've reached ${nextRiddleLocation.name}. Proceed to your next checkpoint!`;
                }
                
                updateData.$set.currentRiddle = newRiddle;
                responseData = { correct: true, newRiddle };
            }

            const updatedTeam = await teamsCollection.findOneAndUpdate(
                { teamCode },
                updateData,
                { returnDocument: 'after' }
            );
            io.emit('teamUpdate', updatedTeam); // Use the general update for everything
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
