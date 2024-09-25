
let dataSheet = null;

function onFileOpen(e) {
    PropertiesService.getDocumentProperties().deleteProperty('isInitialized');
    setSheet();

    // Check if the initial state has already been set
    if (!PropertiesService.getDocumentProperties().getProperty('isInitialized')) {
        sendEntireData(); // Send entire dataset if it's the first time
        setInitialState(); // Set initial state after sending the data
        PropertiesService.getDocumentProperties().setProperty('isInitialized', 'true'); // Mark as initialized
    }
}

function onDataChange(e) {
    setSheet();

    const lock = LockService.getDocumentLock();

    try {
        Logger.log("Attempting to acquire lock...");
        lock.waitLock(30000); // Wait for up to 30 seconds to acquire the lock
        Logger.log("Lock acquired!");

        const initialState = getInitialState();
        const changes = prepareAndPush(initialState); // Process changes

        if (changes) {
            setInitialState(); // Update the initial state if there are changes
        }

    } catch (error) {
        Logger.log(`Error during onDataChange: ${error.message}`);
    } finally {
        lock.releaseLock(); // Always release the lock
        Logger.log("Lock released.");
    }
}

function sendEntireData() {
    setSheet();
    const values = dataSheet.getDataRange().getValues();
    const keys = getColumnName();
    const parsedData = EntireParseData(keys, values);

    postDataToAPI('initialLoad', parsedData);
}

function EntireParseData(keys, values) {
    const rowsData = values.slice(1).map(row => {
        let rowObject = {};
        keys.forEach((key, j) => {
            rowObject[key] = row[j]; // Map each value to the column header
        });
        return rowObject;
    });
    return rowsData; // Return an array of objects representing the rows
}

function setInitialState() {
    setSheet();
    const values = dataSheet.getDataRange().getValues();
    const serializedData = JSON.stringify(values);
    PropertiesService.getDocumentProperties().setProperty('initial-state', serializedData);
}

function getInitialState() {
    const serializedData = PropertiesService.getDocumentProperties().getProperty('initial-state');
    return serializedData ? JSON.parse(serializedData) : [];
}

function prepareAndPush(initialState) {
    const currentState = getCurrentState();
    const changes = compareArrays(initialState, currentState);

    // Check for changes and send corresponding event types
    if (Object.keys(changes).some(type => changes[type].length > 0)) {
        const keys = getColumnName();
        const parsedData = parseData(keys, changes);

        Object.keys(parsedData).forEach(eventType => {
            if (parsedData[eventType].length > 0) {
                postDataToAPI(eventType, parsedData[eventType]);
            }
        });

        return true; // Changes exist
    }

    Logger.log("No data to push");
    return false; // No changes
}

function compareArrays(initialState, currentState) {
    const initialIds = new Set(initialState.map(row => row[0]));
    const currentIds = new Set(currentState.map(row => row[0]));

    const deletedRows = initialState.filter(row => row[0] && !currentIds.has(row[0]));
    const addedRows = currentState.filter(row => row[0] && !initialIds.has(row[0]));
    const updatedRows = currentState.filter(row2 => {
        const row1 = initialState.find(row => row[0] === row2[0]);
        return row1 && JSON.stringify(row1) !== JSON.stringify(row2); // Comparing serialized data for changes
    });

    return { add: addedRows, delete: deletedRows, update: updatedRows };
}

function getCurrentState() {
    const values = dataSheet.getDataRange().getValues();
    const serializedState = JSON.stringify(values);
    PropertiesService.getDocumentProperties().setProperty('current-state', serializedState);
    return JSON.parse(serializedState);
}

function getColumnName() {
    return dataSheet.getRange(1, 1, 1, dataSheet.getLastColumn()).getValues()[0];
}

function parseData(keys, dataOriginal) {
    return Object.fromEntries(Object.entries(dataOriginal).map(([eventType, rows]) => [
        eventType,
        rows.map(row => Object.fromEntries(keys.map((key, i) => [key, row[i]])))
    ]));
}

function postDataToAPI(eventType, jsonData) {
    const url = "https://anysite.com/google-sheet-webhook";
    // const secretKey = "01ee694e34ed924cf32cd432996fb2211901d48aeaf2f118870c3f9b5ebb9286";
    const payload = JSON.stringify({
        event: eventType,
        stones: jsonData,
        token: 'token' // Replace with your actual token
    });

    // const signature = Utilities.computeHmacSha256Signature(payload, secretKey);
    // const encodedSignature = Utilities.base64Encode(signature);

    Logger.log(`Posting data for event: ${eventType}`);
    const options = {
        method: "post",
        // headers: {
        //   "X-Signature": encodedSignature
        // },
        muteHttpExceptions: true,
        contentType: "application/json",
        payload: payload
    };

    try {
        const response = UrlFetchApp.fetch(url, options);
        Logger.log(`Response: ${response.getContentText()}`);
    } catch (error) {
        Logger.log(`Error posting data: ${error.message}`);
    }
}

function setSheet() {
    if (!dataSheet) {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        dataSheet = ss.getSheetByName("data") || ss.getActiveSheet();
    }
}
