const { GoogleSpreadsheet } = require('google-spreadsheet');
let gameData = {
    locations: {},
    routes: {}
};

async function loadGameDataFromSheets() {
    try {
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID);
        await doc.useServiceAccountAuth({
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
        await doc.loadInfo();

        // Load Locations
        const locationsSheet = doc.sheetsByTitle['Locations'];
        const locationRows = await locationsSheet.getRows();
        const locationsMap = {};
        locationRows.forEach(row => {
            locationsMap[row.locationID] = {
                id: row.locationID,
                name: row.locationName,
                qrIdentifier: row.qrIdentifier,
                riddles: [],
            };
        });

        // Load Riddles and add them to locations
        const riddlesSheet = doc.sheetsByTitle['Riddles'];
        const riddleRows = await riddlesSheet.getRows();
        riddleRows.forEach(row => {
            if (locationsMap[row.locationID]) {
                locationsMap[row.locationID].riddles.push(row.riddleText);
            }
        });

        // Load Routes
        const routesSheet = doc.sheetsByTitle['Routes'];
        const routeRows = await routesSheet.getRows();
        const routesMap = {};
        routeRows.forEach(row => {
            const locationsInRoute = [];
            // Dynamically read all location columns
            for (let i = 1; row[`location_${i}`]; i++) {
                locationsInRoute.push(row[`location_${i}`]);
            }
            routesMap[row.routeName] = {
                name: row.routeName,
                locations: locationsInRoute
            };
        });

        gameData = { locations: locationsMap, routes: routesMap };
        console.log('✅ Game data loaded successfully from Google Sheets!');
    } catch (error) {
        console.error('❌ Error loading game data from Google Sheets:', error);
    }
}

// THIS IS THE CORRECTED PART
const getGameData = () => gameData;

// We must export BOTH functions
module.exports = { loadGameDataFromSheets, getGameData };
