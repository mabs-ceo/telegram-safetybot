const { Markup } = require('telegraf');

exports.safetyOfficerMenu = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('📸 Upload Finding', 'upload_finding')],
    [Markup.button.callback('🔍 My Findings', 'my_findings')],
     [Markup.button.callback('📝 Review Findings', 'review_findings')],  // <-- new button

    
  ]);
  exports.moderatorMenu = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('📝 View Pending Findings', 'view_pending')],
  ]);

  exports.inChargeMenu = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('📥 My Assigned Findings', 'my_assigned_findings')],
  ]);
  exports.supervisorMenu = () => Markup.inlineKeyboard([
  [Markup.button.callback('📋 All Findings', 'view_all_findings')],
  [Markup.button.callback('🔎 Filter by Status', 'filter_findings')],
   [Markup.button.callback('📊 View Stats', 'view_stats')],
]);