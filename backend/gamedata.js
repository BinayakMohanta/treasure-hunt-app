const { GoogleSpreadsheet } = require('google-spreadsheet');
let gameLocations = {};

async function loadGameDataFromSheets() {
    try {
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID);
        await doc.useServiceAccountAuth({
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
        await doc.loadInfo();

        const locationsSheet = doc.sheetsByTitle['Locations'];
        const riddlesSheet = doc.sheetsByTitle['Riddles'];
        const locationRows = await locationsSheet.getRows();
        const riddleRows = await riddlesSheet.getRows();

        const locationsMap = new Map();
        locationRows.forEach(row => {
            locationsMap.set(row.locationID, {
                id: row.locationID, name: row.locationName,
                qrIdentifier: row.qrIdentifier, riddles: [],
            });
        });

        riddleRows.forEach(row => {
            if (locationsMap.has(row.locationID)) {
                locationsMap.get(row.locationID).riddles.push(row.riddleText);
            }
        });

        gameLocations = Object.fromEntries(locationsMap);
        console.log('✅ Game data loaded successfully from Google Sheets!');
    } catch (error) { console.error('❌ Error loading game data:', error); }
}

module.exports = { loadGameDataFromSheets };
