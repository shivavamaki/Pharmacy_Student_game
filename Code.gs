const CFG = {
  APP_TITLE: 'The Pharmacy Guild',
  SHEETS: {
    USERS: 'Users',
    PARTIES: 'Parties',
    QUESTS: 'Quests',
    ASSIGNMENTS: 'QuestAssignments',
    DAILY: 'DailyProgress',
    EVIDENCE: 'Evidence',
    XP: 'XPLog',
    BADGES: 'Badges',
    ASSESSMENTS: 'AcademicAssessment',
    SETTINGS: 'Settings'
  },
  SESSION_HOURS: 8
};

function doGet(e) {
  ensureDatabase_();
  const page = String(e && e.parameter && e.parameter.page || '').toLowerCase();
  const fileName = page === 'recap' ? 'AdventureRecap' : 'Index';
  const t = HtmlService.createTemplateFromFile(fileName);
  t.webAppUrl = ScriptApp.getService().getUrl() || '';
  return t.evaluate()
    .setTitle(page === 'recap' ? 'Adventure Recape' : CFG.APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Only an authenticated GM can request schema initialization through the web app.
// Initial provisioning must be done by a trusted script editor, not a public page.
function setupDatabase(token) {
  requireGM_(requireSession_(token));
  ensureDatabase_();
  return { ok: true, message: 'Database initialized', sheets: Object.values(CFG.SHEETS) };
}

function ensureDatabase_() {
  const ss = SpreadsheetApp.getActive();
  const defs = getSheetDefinitions_();

  Object.keys(defs).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);

    const headers = defs[name];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#4d365c')
        .setFontColor('#fff5cf');
      sh.autoResizeColumns(1, headers.length);
    }
  });

}

function getSheetDefinitions_() {
  return {
    [CFG.SHEETS.USERS]: [
      'UserID','Username','PasswordHash','DisplayName','University','Rotation',
      'Role','CharacterClass','PartyID','Level','XP','Status','MustChangePassword',
      'CreatedAt','UpdatedAt'
    ],
    [CFG.SHEETS.PARTIES]: [
      'PartyID','PartyName','Rotation','GMUserID','MemberUserIDs','CurrentQuestID',
      'PartyXP','Risk','Status','CreatedAt','UpdatedAt'
    ],
    [CFG.SHEETS.QUESTS]: [
      'QuestID','QuestName','QuestType','Chapter','Category','Objective',
      'Competencies','RequiredEvidence','XPReward','BadgeReward','DefaultDeadlineDays',
      'Status','CreatedBy','CreatedAt','UpdatedAt'
    ],
    [CFG.SHEETS.ASSIGNMENTS]: [
      'AssignmentID','QuestID','PartyID','AssignedGMUserID','AcceptedAt',
      'MemberConfirmations','PartyRolesJSON','Progress','Risk','Status','Deadline',
      'GMComment','CreatedAt','UpdatedAt'
    ],
    [CFG.SHEETS.DAILY]: [
      'ProgressID','AssignmentID','PartyID','ProgressDate','PreviousTurn',
      'CurrentTurn','Obstacle','NeedGMSupport','Risk','ProgressPercent',
      'SubmittedBy','GMComment','GMReviewedAt','CreatedAt'
    ],
    [CFG.SHEETS.EVIDENCE]: [
      'EvidenceID','AssignmentID','QuestID','PartyID','SubmittedBy','EvidenceType',
      'Title','URL','ReflectionNote','ReviewStatus','GMFeedback','CompetencyResult',
      'ReviewedBy','SubmittedAt','ReviewedAt'
    ],
    [CFG.SHEETS.XP]: [
      'XPLogID','UserID','PartyID','QuestID','XP','Reason','ApprovedBy','CreatedAt'
    ],
    [CFG.SHEETS.BADGES]: [
      'BadgeLogID','UserID','PartyID','QuestID','BadgeName','EvidenceID',
      'ApprovedBy','CreatedAt'
    ],
    [CFG.SHEETS.ASSESSMENTS]: [
      'AssessmentID','UserID','Rotation','AssessmentType','Score','MaxScore',
      'RubricJSON','Feedback','PreceptorUserID','CreatedAt','UpdatedAt'
    ],
    [CFG.SHEETS.SETTINGS]: ['Key','Value','UpdatedAt']
  };
}

// Do not seed real users or predictable credentials from a public repository.
// Create/import accounts securely during deployment; rotate any historical passwords.

function seedParties_() {
  const sh = sheet_(CFG.SHEETS.PARTIES);
  if (sh.getLastRow() > 1) return;
  const now = new Date();
  sh.appendRow([
    'PTY-001','The Safety Shields','Rotation 1','USR-ADMIN',
    JSON.stringify(['USR-001','USR-002','USR-003']),
    '',0,'green','active',now,now
  ]);
}

function seedQuestTemplates_() {
  const sh = sheet_(CFG.SHEETS.QUESTS);
  if (sh.getLastRow() > 1) return;
  const now = new Date();
  const quests = [
    ['Q-MAIN-001','Orientation of the Pharmacy Guild','main',1,'foundation',
     'เรียนรู้โครงสร้างแผนก กติกา Campaign และบทบาทในโรงพยาบาล',
     JSON.stringify(['Professional behavior']),
     JSON.stringify(['Reflection','Checklist']),30,'Guild Member',2,'available','USR-ADMIN',now,now],
    ['Q-MAIN-002','Medication Safety Shield','main',1,'safety',
     'วิเคราะห์ medication error และสร้างแนวทางป้องกันความเสี่ยง',
     JSON.stringify(['Medication Safety','Root Cause Analysis']),
     JSON.stringify(['Report','Reflection']),50,'Safety Shield',3,'available','USR-ADMIN',now,now],
    ['Q-MAIN-003','ADR Hunter','main',1,'clinical',
     'ประเมิน ADR และวาง monitoring plan',
     JSON.stringify(['ADR Evaluation']),
     JSON.stringify(['Case Summary','Reflection']),50,'ADR Hunter',3,'available','USR-ADMIN',now,now],
    ['Q-BOSS-001','The Knowledge Gatekeeper','boss',1,'integration',
     'Mini case, quiz และ reflection เพื่อผ่าน Chapter 1',
     JSON.stringify(['Integrated Knowledge']),
     JSON.stringify(['Quiz Result','Reflection']),100,'Academy Cleared',1,'locked','USR-ADMIN',now,now],
    ['Q-SIDE-001','Medication Error Investigation','side',1,'safety',
     'วิเคราะห์เหตุการณ์ medication error จริงและเสนอแนวทางป้องกัน',
     JSON.stringify(['Medication Safety']),
     JSON.stringify(['Report']),35,'Safety Investigator',3,'available','USR-ADMIN',now,now]
  ];
  sh.getRange(2,1,quests.length,quests[0].length).setValues(quests);
}

/* ---------- Authentication ---------- */

function login(username, password) {
  ensureDatabase_();
  const rows = readObjects_(CFG.SHEETS.USERS);
  const user = rows.find(r =>
    String(r.Username).trim().toLowerCase() === String(username).trim().toLowerCase() &&
    String(r.Status).toLowerCase() === 'active'
  );
  if (!user || !passwordMatches_(user, password)) {
    throw new Error('Username or password is incorrect');
  }

  const token = Utilities.getUuid();
  const payload = {
    userId: user.UserID,
    createdAt: Date.now(),
    expiresAt: Date.now() + CFG.SESSION_HOURS * 3600000
  };
  CacheService.getScriptCache().put('SESSION_' + token, JSON.stringify(payload), CFG.SESSION_HOURS * 3600);
  return { ok: true, token, user: sanitizeUser_(user) };
}

function getCurrentUser(token) {
  const s = requireSession_(token);
  const user = findBy_(CFG.SHEETS.USERS, 'UserID', s.userId);
  return sanitizeUser_(user);
}

function logout(token) {
  CacheService.getScriptCache().remove('SESSION_' + token);
  return { ok: true };
}

/* ---------- Dashboard / Bootstrap ---------- */

function getAppBootstrap(token) {
  const s = requireSession_(token);
  const user = sanitizeUser_(findBy_(CFG.SHEETS.USERS, 'UserID', s.userId));
  const party = user.PartyID ? findBy_(CFG.SHEETS.PARTIES, 'PartyID', user.PartyID) : null;

  return {
    ok: true,
    user,
    party,
    quests: readObjects_(CFG.SHEETS.QUESTS),
    assignments: s.role === 'admin'
      ? readObjects_(CFG.SHEETS.ASSIGNMENTS)
      : readObjects_(CFG.SHEETS.ASSIGNMENTS).filter(x => x.PartyID === user.PartyID),
    xpLog: readObjects_(CFG.SHEETS.XP).filter(x => x.UserID === user.UserID),
    badges: readObjects_(CFG.SHEETS.BADGES).filter(x => x.UserID === user.UserID)
  };
}

/* ---------- Party / Quest ---------- */

function acceptQuest(token, questId, partyId, partyRoles) {
  const s = requireSession_(token);
  const user = findBy_(CFG.SHEETS.USERS, 'UserID', s.userId);
  if (s.role !== 'admin' && user.PartyID !== partyId) throw new Error('Not allowed');

  const quest = findBy_(CFG.SHEETS.QUESTS, 'QuestID', questId);
  const party = findBy_(CFG.SHEETS.PARTIES, 'PartyID', partyId);
  if (!quest || !party) throw new Error('Quest or party not found');
  if (String(quest.Status).toLowerCase() !== 'available') throw new Error('Quest is locked');
  if (readObjects_(CFG.SHEETS.ASSIGNMENTS).some(a =>
    a.PartyID === partyId && a.QuestID === questId &&
    !['completed', 'archived'].includes(String(a.Status))
  )) throw new Error('Quest is already assigned to this party');

  const now = new Date();
  const id = 'ASN-' + Utilities.getUuid().slice(0,8);
  appendObject_(CFG.SHEETS.ASSIGNMENTS, {
    AssignmentID:id, QuestID:questId, PartyID:partyId,
    AssignedGMUserID:party.GMUserID, AcceptedAt:now,
    MemberConfirmations:JSON.stringify([]),
    PartyRolesJSON:JSON.stringify(partyRoles || {}),
    Progress:10, Risk:'green', Status:'waiting_gm_approval',
    Deadline:new Date(now.getTime() + Number(quest.DefaultDeadlineDays || 3)*86400000),
    GMComment:'', CreatedAt:now, UpdatedAt:now
  });
  return { ok:true, assignmentId:id };
}

function approveQuestAcceptance(token, assignmentId) {
  const s = requireSession_(token);
  requireGM_(s);
  updateBy_(CFG.SHEETS.ASSIGNMENTS,'AssignmentID',assignmentId,{
    Status:'in_progress',UpdatedAt:new Date()
  });
  return {ok:true};
}

function saveDailyProgress(token, data) {
  const s = requireSession_(token);
  const now = new Date();
  const assignment = findBy_(CFG.SHEETS.ASSIGNMENTS,'AssignmentID',data.assignmentId);
  if (!assignment) throw new Error('Assignment not found');
  requirePartyAccess_(s, assignment.PartyID);
  const progress = Number(data.progressPercent);
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) throw new Error('Progress must be 0-100');
  if (!['green','yellow','red'].includes(String(data.risk))) throw new Error('Invalid risk');

  appendObject_(CFG.SHEETS.DAILY,{
    ProgressID:'DLY-'+Utilities.getUuid().slice(0,8),
    AssignmentID:data.assignmentId,
    PartyID:assignment.PartyID,
    ProgressDate:data.progressDate || now,
    PreviousTurn:data.previousTurn || '',
    CurrentTurn:data.currentTurn || '',
    Obstacle:data.obstacle || '',
    NeedGMSupport:data.needGMSupport || '',
    Risk:data.risk || 'green',
    ProgressPercent:progress,
    SubmittedBy:s.userId,
    GMComment:'',
    GMReviewedAt:'',
    CreatedAt:now
  });

  updateBy_(CFG.SHEETS.ASSIGNMENTS,'AssignmentID',data.assignmentId,{
    Progress:progress,
    Risk:data.risk || 'green',
    UpdatedAt:now
  });
  return {ok:true};
}

/* ---------- Evidence / Completion ---------- */

function submitEvidence(token, data) {
  const s = requireSession_(token);
  const assignment = findBy_(CFG.SHEETS.ASSIGNMENTS,'AssignmentID',data.assignmentId);
  if (!assignment) throw new Error('Assignment not found');
  requirePartyAccess_(s, assignment.PartyID);

  const id='EVD-'+Utilities.getUuid().slice(0,8);
  appendObject_(CFG.SHEETS.EVIDENCE,{
    EvidenceID:id,
    AssignmentID:data.assignmentId,
    QuestID:assignment.QuestID,
    PartyID:assignment.PartyID,
    SubmittedBy:s.userId,
    EvidenceType:data.evidenceType || 'Link',
    Title:data.title || 'Untitled',
    URL:data.url || '',
    ReflectionNote:data.reflectionNote || '',
    ReviewStatus:'waiting_review',
    GMFeedback:'',
    CompetencyResult:'',
    ReviewedBy:'',
    SubmittedAt:new Date(),
    ReviewedAt:''
  });
  updateBy_(CFG.SHEETS.ASSIGNMENTS,'AssignmentID',data.assignmentId,{
    Status:'waiting_gm_review',Progress:80,UpdatedAt:new Date()
  });
  return {ok:true,evidenceId:id};
}

function reviewEvidence(token, evidenceId, decision) {
  const s = requireSession_(token);
  requireGM_(s);
  const status = decision.approved ? 'approved' : 'revision_required';
  updateBy_(CFG.SHEETS.EVIDENCE,'EvidenceID',evidenceId,{
    ReviewStatus:status,
    GMFeedback:decision.feedback || '',
    CompetencyResult:decision.competencyResult || '',
    ReviewedBy:s.userId,
    ReviewedAt:new Date()
  });
  return {ok:true,status};
}

function completeQuest(token, assignmentId) {
  const s = requireSession_(token);
  requireGM_(s);
  const assignment = findBy_(CFG.SHEETS.ASSIGNMENTS,'AssignmentID',assignmentId);
  if (!assignment) throw new Error('Assignment not found');
  if (String(assignment.Status) === 'completed') throw new Error('Quest already completed');
  const quest = findBy_(CFG.SHEETS.QUESTS,'QuestID',assignment.QuestID);
  const party = findBy_(CFG.SHEETS.PARTIES,'PartyID',assignment.PartyID);
  if (!quest || !party) throw new Error('Data not found');
  const approved = readObjects_(CFG.SHEETS.EVIDENCE).some(e =>
    e.AssignmentID === assignmentId && e.ReviewStatus === 'approved');
  if (!approved) throw new Error('Approved evidence required');

  updateBy_(CFG.SHEETS.ASSIGNMENTS,'AssignmentID',assignmentId,{
    Status:'completed',Progress:100,UpdatedAt:new Date()
  });

  const members = JSON.parse(party.MemberUserIDs || '[]');
  members.forEach(userId => {
    appendObject_(CFG.SHEETS.XP,{
      XPLogID:'XP-'+Utilities.getUuid().slice(0,8),
      UserID:userId,PartyID:party.PartyID,QuestID:quest.QuestID,
      XP:Number(quest.XPReward || 0),Reason:'Quest completed',
      ApprovedBy:s.userId,CreatedAt:new Date()
    });

    if (quest.BadgeReward) {
      appendObject_(CFG.SHEETS.BADGES,{
        BadgeLogID:'BDG-'+Utilities.getUuid().slice(0,8),
        UserID:userId,PartyID:party.PartyID,QuestID:quest.QuestID,
        BadgeName:quest.BadgeReward,EvidenceID:'',
        ApprovedBy:s.userId,CreatedAt:new Date()
      });
    }
  });

  return {ok:true,xp:Number(quest.XPReward || 0),badge:quest.BadgeReward};
}

/* ---------- Academic Assessment ---------- */

function saveAssessment(token, data) {
  const s = requireSession_(token);
  requireGM_(s);
  const id='ASM-'+Utilities.getUuid().slice(0,8);
  appendObject_(CFG.SHEETS.ASSESSMENTS,{
    AssessmentID:id,
    UserID:data.userId,
    Rotation:data.rotation || '',
    AssessmentType:data.assessmentType || 'Final',
    Score:Number(data.score || 0),
    MaxScore:Number(data.maxScore || 100),
    RubricJSON:JSON.stringify(data.rubric || {}),
    Feedback:data.feedback || '',
    PreceptorUserID:s.userId,
    CreatedAt:new Date(),
    UpdatedAt:new Date()
  });
  return {ok:true,assessmentId:id};
}

/* ---------- Helpers ---------- */

function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name);
  return sh;
}

function readObjects_(name) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter(r => r.some(v => v !== ''))
    .map(r => Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
}

function appendObject_(name,obj) {
  const sh=sheet_(name);
  const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  sh.appendRow(headers.map(h => obj[h] !== undefined ? obj[h] : ''));
}

function findBy_(name,key,value) {
  return readObjects_(name).find(r => String(r[key]) === String(value)) || null;
}

function updateBy_(name,key,value,patch) {
  const sh=sheet_(name);
  const data=sh.getDataRange().getValues();
  if(data.length<2) throw new Error('No data');
  const headers=data[0];
  const keyCol=headers.indexOf(key);
  if(keyCol<0) throw new Error('Missing key column');
  const rowIndex=data.findIndex((r,i)=>i>0 && String(r[keyCol])===String(value));
  if(rowIndex<0) throw new Error('Record not found');
  Object.keys(patch).forEach(k=>{
    const c=headers.indexOf(k);
    if(c>=0) sh.getRange(rowIndex+1,c+1).setValue(patch[k]);
  });
}

function normalizePassword_(value) {
  return String(value == null ? '' : value).replace(/\u00a0/g, ' ').trim();
}

function sha256Hex_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

// Transitional salted SHA-256 hashing for the legacy Apps Script app.
// Prefer a managed identity provider (such as Firebase Auth) for production.
function hashPassword_(password) {
  const salt = Utilities.getUuid().replace(/-/g, '');
  return 'sha256$' + salt + '$' + sha256Hex_(salt + ':' + normalizePassword_(password));
}

function passwordMatches_(user, password) {
  const input = normalizePassword_(password);
  const stored = String(user.PasswordHash || '');
  if (!input || !stored) return false;
  if (stored.indexOf('sha256$') === 0) {
    const fields = stored.split('$');
    if (fields.length !== 3 || !/^[a-f0-9]{32}$/i.test(fields[1]) ||
        !/^[a-f0-9]{64}$/i.test(fields[2])) return false;
    return sha256Hex_(fields[1] + ':' + input) === fields[2];
  }
  // One-time migration for existing plaintext accounts; never infer a default
  // password from username or accept old unknown SHA-256 values as a bypass.
  if (/^[a-f0-9]{64}$/i.test(stored) || stored !== input) return false;
  updateBy_(CFG.SHEETS.USERS, 'UserID', user.UserID, {
    PasswordHash: hashPassword_(input),
    MustChangePassword: true,
    UpdatedAt: new Date()
  });
  user.MustChangePassword = true;
  return true;
}

function sanitizeUser_(u) {
  if (!u) return null;
  const out = Object.assign({}, u);
  delete out.PasswordHash;
  return out;
}

function requireSession_(token) {
  if (!token) throw new Error('Session required');
  const raw = CacheService.getScriptCache().get('SESSION_' + token);
  if (!raw) throw new Error('Session expired');
  const session = JSON.parse(raw);
  if (Date.now() > session.expiresAt) throw new Error('Session expired');
  const user = findBy_(CFG.SHEETS.USERS, 'UserID', session.userId);
  if (!user || String(user.Status).toLowerCase() !== 'active') {
    throw new Error('Account is no longer active');
  }
  // The current role is read from the database, not trusted from an old token.
  return { userId: user.UserID, role: String(user.Role).toLowerCase(), expiresAt: session.expiresAt };
}

function requirePartyAccess_(session, partyId) {
  if (['admin', 'gm', 'preceptor'].includes(session.role)) return;
  const user = findBy_(CFG.SHEETS.USERS, 'UserID', session.userId);
  if (!user || String(user.PartyID) !== String(partyId)) {
    throw new Error('Not allowed to modify another party');
  }
}

function requireGM_(session) {
  if (!['admin','gm','preceptor'].includes(String(session.role).toLowerCase())) {
    throw new Error('GM permission required');
  }
}



/* ---------- STEP 12 CONNECTED MVP API ---------- */

function listAvailableQuests(token) {
  const s = requireSession_(token);
  const user = findBy_(CFG.SHEETS.USERS, 'UserID', s.userId);
  const assignments = readObjects_(CFG.SHEETS.ASSIGNMENTS);
  const activeQuestIds = new Set(
    assignments
      .filter(a => a.PartyID === user.PartyID && !['completed','archived'].includes(String(a.Status)))
      .map(a => String(a.QuestID))
  );

  return readObjects_(CFG.SHEETS.QUESTS)
    .filter(q => String(q.Status).toLowerCase() === 'available')
    .map(q => Object.assign({}, q, { alreadyAssigned: activeQuestIds.has(String(q.QuestID)) }));
}

function getPartyDashboard(token) {
  const s = requireSession_(token);
  const user = findBy_(CFG.SHEETS.USERS, 'UserID', s.userId);
  const party = user.PartyID ? findBy_(CFG.SHEETS.PARTIES, 'PartyID', user.PartyID) : null;
  if (!party) return { user: sanitizeUser_(user), party: null, assignments: [] };

  const quests = readObjects_(CFG.SHEETS.QUESTS);
  const assignments = readObjects_(CFG.SHEETS.ASSIGNMENTS)
    .filter(a => a.PartyID === party.PartyID)
    .map(a => Object.assign({}, a, {
      quest: quests.find(q => q.QuestID === a.QuestID) || null
    }));

  return {
    user: sanitizeUser_(user),
    party,
    assignments,
    daily: readObjects_(CFG.SHEETS.DAILY).filter(d => d.PartyID === party.PartyID),
    evidence: readObjects_(CFG.SHEETS.EVIDENCE).filter(e => e.PartyID === party.PartyID)
  };
}

function getGMQueue(token) {
  const s = requireSession_(token);
  requireGM_(s);

  const users = readObjects_(CFG.SHEETS.USERS);
  const parties = readObjects_(CFG.SHEETS.PARTIES);
  const quests = readObjects_(CFG.SHEETS.QUESTS);
  const assignments = readObjects_(CFG.SHEETS.ASSIGNMENTS);
  const evidence = readObjects_(CFG.SHEETS.EVIDENCE);

  return {
    assignments: assignments
      .filter(a => ['waiting_gm_approval','waiting_gm_review','revision_required','in_progress'].includes(String(a.Status)))
      .map(a => Object.assign({}, a, {
        quest: quests.find(q => q.QuestID === a.QuestID) || null,
        party: parties.find(p => p.PartyID === a.PartyID) || null
      })),
    evidence: evidence
      .filter(e => ['waiting_review','revision_required','approved'].includes(String(e.ReviewStatus)))
      .map(e => Object.assign({}, e, {
        quest: quests.find(q => q.QuestID === e.QuestID) || null,
        party: parties.find(p => p.PartyID === e.PartyID) || null,
        submitter: sanitizeUser_(users.find(u => u.UserID === e.SubmittedBy))
      }))
  };
}

function reviewDailyProgress(token, progressId, comment) {
  const s = requireSession_(token);
  requireGM_(s);
  updateBy_(CFG.SHEETS.DAILY, 'ProgressID', progressId, {
    GMComment: comment || '',
    GMReviewedAt: new Date()
  });
  return { ok: true };
}

function changePassword(token, currentPassword, newPassword) {
  const s = requireSession_(token);
  const user = findBy_(CFG.SHEETS.USERS, 'UserID', s.userId);
  if (!passwordMatches_(user, currentPassword)) throw new Error('Current password is incorrect');
  const normalized = normalizePassword_(newPassword);
  if (normalized.length < 10) throw new Error('New password must have at least 10 characters');
  if (normalized === normalizePassword_(currentPassword)) throw new Error('Choose a different password');
  updateBy_(CFG.SHEETS.USERS, 'UserID', s.userId, {
    PasswordHash: hashPassword_(normalized),
    MustChangePassword: false,
    UpdatedAt: new Date()
  });
  CacheService.getScriptCache().remove('SESSION_' + token);
  return { ok: true, message: 'Password changed. Sign in again.' };
}


/* ---------- STEP 13: ADVENTURE RECAPE ---------- */

function getAdventureRecapSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('AdventureRecapResponses');
  const headers = [
    'Response ID','Submitted At (Bangkok)','Client Timestamp',
    'User ID','Username','Student Name','University','Rotation',
    'Character','Why Character','Game Title','Game Genre','First Feeling',
    'What Helped Initially','Hardest Missions','Growth Mission','Growth Reason',
    'Preceptor Character','Negative Preceptor Characters','Preceptor Shadow Debuffs',
    'Negative Reflection','Teaching Clarity','Comfort to Ask','Helpful Feedback',
    'Appropriate Workload','Not Left Alone','Wanted Preceptor Skill','Rating Reflection',
    'Department City','Welcome Factors','Stress Factors','Memorable Moment',
    'One Thing to Fix','Unlocked Skills','Proudest Skill','Skill to Improve',
    'Hardest Boss','How Survived','What Would Help','Treasure','One Word',
    'Final Emotion','Overall Score','Requested Patches','Message to Junior',
    'Secret Message','Quest Score','Ending Rank','Ending Title','Ending Text','Raw JSON'
  ];
  if (!sh) sh = ss.insertSheet('AdventureRecapResponses');
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.getRange(1,1,1,headers.length)
      .setFontWeight('bold').setBackground('#a98cff').setFontColor('#ffffff').setWrap(true);
    sh.setFrozenRows(1);
  }
  return sh;
}

/* Compatibility API used by the previous evaluation quest UI. */
function loginUser(username, password) {
  try {
    const r = login(username, password);
    return {ok:true, token:r.token, user:recapSafeUser_(r.user)};
  } catch (e) {
    return {ok:false, message:String(e.message || e)};
  }
}

function validateSession(token) {
  try {
    return {ok:true, user:recapSafeUser_(getCurrentUser(token))};
  } catch (e) {
    return {ok:false, message:String(e.message || e)};
  }
}

function logoutUser(token) {
  try { return logout(token); }
  catch (e) { return {ok:false, message:String(e.message || e)}; }
}

function recapSafeUser_(u) {
  return {
    id:u.UserID, username:u.Username, displayName:u.DisplayName,
    role:u.Role, university:u.University, rotation:u.Rotation
  };
}

function saveQuestResponse(payload) {
  try {
    if (!payload || payload.action !== 'submitResponse' || !payload.response) {
      throw new Error('Invalid Adventure Recape payload');
    }
    const session = requireSession_(payload.sessionToken);
    const rawUser = findBy_(CFG.SHEETS.USERS, 'UserID', session.userId);
    const user = recapSafeUser_(rawUser);
    const state = payload.response || {};
    const profile = state.profile || {};
    const answers = state.answers || {};
    const tutorial = answers.tutorial || {};
    const road = answers.road || {};
    const preceptor = answers.preceptor || {};
    const ratings = preceptor.ratings || {};
    const department = answers.department || {};
    const skill = answers.skill || {};
    const boss = answers.boss || {};
    const treasure = answers.treasure || {};
    const patch = answers.patch || {};
    const results = state.results || {};
    const now = new Date();
    const responseId = Utilities.getUuid();

    const join = v => Array.isArray(v) ? v.join(' | ') : (v || '');
    const row = [
      responseId,
      Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'),
      payload.submittedAtClient || '',
      user.id,user.username,user.displayName,user.university,user.rotation,
      profile.characterLabel || profile.character || '',
      ((answers.character || {}).why) || '',
      tutorial.gameTitle || '',tutorial.gameGenre || '',
      tutorial.firstFeelingLabel || tutorial.firstFeeling || '',
      tutorial.firstHelp || '',
      join(road.hardestMission),road.growthMission || '',road.growthReason || '',
      preceptor.roleLabel || preceptor.role || '',
      join(preceptor.negativeRoles || preceptor.shadowRoles),
      join(preceptor.negativeFactors || preceptor.shadowDebuffs),
      preceptor.negativeReflection || preceptor.shadowReflection || '',
      ratings.teachingClarity || '',ratings.comfortToAsk || '',
      ratings.helpfulFeedback || '',ratings.workload || '',ratings.notLeftAlone || '',
      preceptor.wantedSkill || '',preceptor.bestWorstReason || '',
      department.cityLabel || department.cityType || '',
      join(department.welcomeFactors),join(department.stressFactors),
      department.memorableMoment || '',department.oneThingToFix || '',
      join(skill.unlockedSkills),skill.proudestSkill || '',skill.skillToImprove || '',
      boss.bossLabel || boss.hardestBoss || '',boss.howSurvived || '',
      boss.whatWouldHelp || '',treasure.treasure || '',treasure.oneWord || '',
      treasure.finalEmojiLabel || treasure.finalEmoji || '',
      treasure.overallScore || '',join(patch.patchRequests),
      patch.messageToJunior || '',patch.secretMessage || '',
      results.questScore || '',results.rank || '',
      results.endingTitle || '',results.endingText || '',
      JSON.stringify({action:payload.action, app:payload.app, version:payload.version, response:payload.response})
    ];
    const sh = getAdventureRecapSheet_();
    sh.appendRow(row);
    return {ok:true, message:'Adventure Recape saved', responseId, row:sh.getLastRow()};
  } catch (e) {
    return {ok:false, message:String(e.message || e)};
  }
}

function getAdventureRecapStatus(token) {
  const s = requireSession_(token);
  const sh = getAdventureRecapSheet_();
  return {
    ok:true,
    userId:s.userId,
    responseCount:Math.max(0, sh.getLastRow()-1),
    sheetName:sh.getName()
  };
}
