require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const { loadGameDataFromSheets } = require('./gameData');

const app = express();
app.use(cors());
app.use(express.json());

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
        server.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });
    } catch (e) { console.error("❌ Could not start server", e); }
}

io.on('connection', (socket) => { console.log('A user connected:', socket.id); });

app.post('/api/teams/login', async (req, res) => {
    const { teamCode } = req.body;
    try {
        const team = await teamsCollection.findOne({ teamCode });
        if (team) { res.status(200).json(team); }
        else { res.status(404).json({ message: 'Team code not found.' }); }
    } catch (error) { res.status(500).json({ message: 'Server error.' }); }
});

startServer();
