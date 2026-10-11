/** Run manually in the ORIGINAL bound Apps Script editor as its owner.
 * Creates a sanitized JSON export in your own Drive. Does not change any sheets.
 * Download it and run the offline importer; do not commit student exports to GitHub.
 */
function exportGuildForCloudflare() {
  const ss = SpreadsheetApp.getActive();
  const names = ['Users','Parties','Quests','QuestAssignments','DailyProgress','Evidence','XPLog','Badges','AcademicAssessment','Settings','AdventureRecapResponses'];
  const result = {};
  names.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) { result[name] = []; return; }
    const rows = sheet.getDataRange().getValues(); const headers = rows.shift();
    result[name] = rows.filter(row => row.some(value => value !== '')).map(row => {
      const record = {};
      headers.forEach((key, index) => {
        if (/password|session.?token|refresh.?token|access.?token|credential|private.?key/i.test(key)) return;
        const value = row[index];
        if (key === 'Raw JSON') {
          try { const payload = JSON.parse(value); record[key] = JSON.stringify({response: payload.response, submittedAtClient: payload.submittedAtClient}); }
          catch (_) { throw new Error('Invalid recap JSON: fix source before export'); }
        } else record[key] = value instanceof Date ? value.toISOString() : value;
      });
      return record;
    });
    if (name === 'Settings') result[name] = result[name].filter(r => !/password|token|secret|credential|private.?key|api.?key/i.test(String(r.Key)));
  });
  const file = DriveApp.createFile('pharmacy-guild-sanitized-export.json', JSON.stringify(result), MimeType.PLAIN_TEXT);
  console.log(file.getUrl());
}
