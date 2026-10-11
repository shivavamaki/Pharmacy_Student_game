/** Run in the original bound Apps Script. Logs metadata only, never cell records. */
function inventoryGuildSheets() {
  const inventory = SpreadsheetApp.getActive().getSheets().map(sheet => ({
    name: sheet.getName(),
    dataRows: Math.max(0, sheet.getLastRow() - 1),
    headers: sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] : []
  }));
  console.log(JSON.stringify(inventory, null, 2));
}
