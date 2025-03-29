let dataSheet = null;
const DELAY_SECONDS = 30; // Wait time before sending updates
const TIMESTAMP_KEY = "lastUpdateTime";

function autoRunTask() {
    PropertiesService.getDocumentProperties().deleteProperty('isInitialized');
    setSheet();

    if (!PropertiesService.getDocumentProperties().getProperty('isInitialized')) {
        sendEntireData();
        setInitialState();
        PropertiesService.getDocumentProperties().setProperty('isInitialized', 'true');
    }
}

function onEdit(e) {
    setSheet();
    Logger.log("Edit detected!");

    const now = new Date().getTime();
    PropertiesService.getScriptProperties().setProperty(TIMESTAMP_KEY, now.toString());

    cleanUpTriggers();

    ScriptApp.newTrigger("delayedDataPush")
        .timeBased()
        .after(DELAY_SECONDS * 1000)
        .create();
}

function delayedDataPush() {
    setSheet();
    
    const lastUpdate = PropertiesService.getScriptProperties().getProperty(TIMESTAMP_KEY);
    const now = new Date().getTime();

    if (lastUpdate && now - parseInt(lastUpdate) < DELAY_SECONDS * 1000) {
        Logger.log("Edit detected, but waiting for stability.");
        return;
    }

    Logger.log("Sending entire dataset after edit.");
    sendEntireData();
    cleanUpTriggers();
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
    const url = "https://anysite.com/google-sheet-webhook";
    const payload = JSON.stringify({
        event: eventType,
        stones: jsonData,
        token: '9jksdhfklsjhflsuiowrehw2o3u43p2ipo'
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

function cleanUpTriggers() {
    const allTriggers = ScriptApp.getProjectTriggers();
    allTriggers.forEach(trigger => {
        if (trigger.getHandlerFunction() === "delayedDataPush") {
            ScriptApp.deleteTrigger(trigger);
        }
    });
}

function setSheet() {
    if (!dataSheet) {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        dataSheet = ss.getSheetByName("data") || ss.getActiveSheet();
    }
}
