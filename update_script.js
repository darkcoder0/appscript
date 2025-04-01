let dataSheet = null;
const DELAY_SECONDS = 30 * 1000; // 30 seconds in milliseconds
const TIMESTAMP_KEY = "lastUpdateTime";

function autoRunTask() {
    PropertiesService.getDocumentProperties().deleteProperty('isInitialized');
    setSheet();

    if (!PropertiesService.getDocumentProperties().getProperty('isInitialized')) {
        sendEntireData();
        PropertiesService.getDocumentProperties().setProperty('isInitialized', 'true');
    }
}

function onFileOpen() {
    Logger.log("File opened!");
    setSheet();
    autoRunTask();
}

function onDataChange() {
    Logger.log("Data changed!");
    onEdit();
}

function onEdit(e) {
    setSheet();
    Logger.log("Edit detected!");

    const now = new Date().getTime();
    PropertiesService.getScriptProperties().setProperty(TIMESTAMP_KEY, now.toString());

    Logger.log("Waiting for 30 seconds...");
    Utilities.sleep(DELAY_SECONDS); // Wait for stability

    delayedDataPush(); // Call function directly after wait
}

function delayedDataPush() {
    setSheet();
    
    const lastUpdate = PropertiesService.getScriptProperties().getProperty(TIMESTAMP_KEY);
    const now = new Date().getTime();

    if (lastUpdate && now - parseInt(lastUpdate) < DELAY_SECONDS) {
        Logger.log("Edit detected, but waiting for stability.");
        return;
    }

    Logger.log("Sending entire dataset after edit.");
    sendEntireData();
}

function sendEntireData() {
    setSheet();
    const values = dataSheet.getDataRange().getValues();
    const keys = getColumnName();
    const parsedData = EntireParseData(keys, values);

    postDataToAPI('initialLoad', parsedData);
}

function EntireParseData(keys, values) {
    return values.slice(1).map(row => {
        let rowObject = {};
        keys.forEach((key, j) => {
            rowObject[key] = row[j];
        });
        return rowObject;
    });
}

function getColumnName() {
    return dataSheet.getRange(1, 1, 1, dataSheet.getLastColumn()).getValues()[0];
}

function postDataToAPI(eventType, jsonData) {
    const url = "https://any.com/google-sheet-webhook";
    const payload = JSON.stringify({
        event: eventType,
        stones: jsonData,
        token: '123435457654576854877468768'
    });

    Logger.log(`Posting data for event: ${eventType}`);
    const options = {
        method: "post",
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
