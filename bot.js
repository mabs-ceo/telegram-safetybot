require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const {session} = require('telegraf/session');

const connectDB = require('./config/db');
const User = require('./models/User');
const roles = require('./utils/roles');
const authMiddleware = require('./middleware/auth');

const { safetyOfficerMenu, moderatorMenu, inChargeMenu, supervisorMenu } = require('./keyboards');
const Finding = require('./models/Finding');

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

// Connect to MongoDB
connectDB();

// Log incoming text messages
bot.on('text', (ctx, next) => {
  console.log('User sent text:', ctx.message.text);
  return next();
});

// Admin-only /register command
bot.command('register', async (ctx) => {
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  const fromId = String(ctx.from.id);
  if (fromId !== adminId) {
    return ctx.reply('❌ Only the admin can register users.');
  }

  const parts = ctx.message.text.split(' ');
  if (parts.length < 3) {
    return ctx.reply('Usage: /register <telegramId> <role> [name]');
  }

  const [_, telegramId, role, ...nameParts] = parts;
  const name = nameParts.join(' ');
  const validRoles = Object.values(roles);

  if (!validRoles.includes(role)) {
    return ctx.reply(`❌ Invalid role. Choose from: ${validRoles.join(', ')}`);
  }

  try {
    const existing = await User.findOne({ telegramId });
    if (existing) return ctx.reply('⚠️ User already registered.');

    await User.create({ telegramId, role, name });
    ctx.reply(`✅ Registered ${telegramId} as ${role}${name ? ` (${name})` : ''}`);
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Error registering user.');
  }
});

// Global start command
bot.start(async (ctx) => {
  const telegramId = String(ctx.from.id);
  const user = await User.findOne({ telegramId });

  console.log('id:', telegramId);
  console.log('User found:', user);

  if (!user) {
    return ctx.reply(`❌ You are not authorized. Ask the admin to register you. Here is your Id: ${telegramId}`);
  }

  const role = user.role;
  console.log('User role:', role);

  if (role === roles.SAFETY_OFFICER) {
    return ctx.reply('Welcome Safety Officer!', safetyOfficerMenu());
  } else if (role === roles.MODERATOR) {
    return ctx.reply('Welcome Moderator!', moderatorMenu());
  } else if (role === roles.IN_CHARGE) {
    return ctx.reply('Welcome Department In-Charge!', inChargeMenu());
  } else if (role === roles.SUPERVISOR) {
   return ctx.reply('Welcome Supervisor! Use the dashboard view.', supervisorMenu());
  } else {
    return ctx.reply('Role not recognized.');
  }
});

// Upload finding flow
bot.action('upload_finding', authMiddleware([roles.SAFETY_OFFICER]), async (ctx) => {
  ctx.session = { step: 'awaiting_photo' };
  ctx.reply('Please send a photo with the location.');
});

// Handle location after photo
bot.on('message', authMiddleware([roles.SAFETY_OFFICER]), async (ctx) => {
  if (ctx.session?.step !== 'awaiting_location') return;

  const locationText = ctx.message.text || `Latitude: ${ctx.message.location.latitude}, Longitude: ${ctx.message.location.longitude}`;
  const { photo } = ctx.session.finding;

  await Finding.create({
    photo,
    location: locationText,
    createdBy: String(ctx.from.id),
    status: 'Pending',
    timestamps: { createdAt: new Date(), updatedAt: new Date() },
  });

  ctx.session = null;
  ctx.reply('✅ Safety finding submitted successfully!', safetyOfficerMenu());
});

// View pending findings (merged handler)
bot.action('view_pending', authMiddleware([roles.MODERATOR]), async (ctx) => {
  await ctx.answerCbQuery();

  const pendingFindings = await Finding.find({ status: 'Pending' }).sort({ 'timestamps.createdAt': -1 });

  if (pendingFindings.length === 0) {
    return ctx.reply('🎉 No pending findings at the moment.');
  }

  const inCharges = await User.find({ role: roles.IN_CHARGE });

  for (const finding of pendingFindings) {
    const caption = `📍 Location: ${finding.location || 'N/A'}\n🆔 ID: ${finding._id}`;

    const assignButtons = inCharges.length > 0
      ? inCharges.map((user) => [Markup.button.callback(`Assign to ${user.name || user.telegramId}`, `confirmAssign_${finding._id}_${user.telegramId}`)])
      : [];

    await ctx.replyWithPhoto(finding.photo, {
      caption,
      ...Markup.inlineKeyboard([
        ...assignButtons,
        [Markup.button.callback('❌ Close', `close_${finding._id}`)],
      ]),
    });
  }
});

// Confirm assignment
bot.action(/confirmAssign_(.+)_(.+)/, authMiddleware([roles.MODERATOR]), async (ctx) => {
  await ctx.answerCbQuery();
  const [findingId, userId] = [ctx.match[1], ctx.match[2]];
  console.log(ctx.match);
  await Finding.findByIdAndUpdate(findingId, {
    assignedTo: userId,
    status: 'Assigned',
    'timestamps.updatedAt': new Date(),
  });

  ctx.reply(`✅ Finding assigned to ${userId}`);
});

// Close finding flow
bot.action(/close_(.+)/, authMiddleware([roles.MODERATOR]), async (ctx) => {
  await ctx.answerCbQuery();

  const findingId = ctx.match[1];
  ctx.session = {
    step: 'awaiting_close_photo',
    findingId,
  };

  ctx.reply('📷 Please upload a photo before closing this finding.');
});

// Handle photo uploads
bot.on('photo', authMiddleware(), async (ctx) => {
  const telegramId = String(ctx.from.id);
  const user = await User.findOne({ telegramId });
  if (!ctx.session?.step) return;

  const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

  switch (ctx.session.step) {
    case 'awaiting_photo':
      if (user.role !== roles.SAFETY_OFFICER) return ctx.reply('❌ Only Safety Officers can upload findings.');
      ctx.session.finding = { photo: fileId };
      ctx.session.step = 'awaiting_location';
      return ctx.reply('📍 Now send the location or a short description.');

    case 'awaiting_close_photo':
      if (user.role !== roles.MODERATOR) return ctx.reply('❌ Only Moderators can close findings.');
      await Finding.findByIdAndUpdate(ctx.session.findingId, {
        rectificationImage: fileId,
        status: 'Closed',
        'timestamps.updatedAt': new Date(),
      });
      ctx.session = null;
      return ctx.reply('✅ Finding closed successfully with a photo.');

    case 'awaiting_rectification_photo':
      if (user.role !== roles.IN_CHARGE) return ctx.reply('❌ Only In-Charge users can upload rectifications.');
      await Finding.findByIdAndUpdate(ctx.session.findingId, {
        rectificationImage: fileId,
        status: 'Rectified',
        'timestamps.updatedAt': new Date(),
      });
      ctx.session = null;
      return ctx.reply('✅ Rectification uploaded successfully.');

    default:
      return ctx.reply('⚠️ Unexpected photo. No action in progress.');
  }
});

// View assigned findings
bot.action('my_assigned_findings', authMiddleware([roles.IN_CHARGE]), async (ctx) => {
  const assignedFindings = await Finding.find({
    assignedTo: String(ctx.from.id),
    status: 'Assigned',
  });

  if (assignedFindings.length === 0) {
    return ctx.reply('📭 No assigned findings to rectify.');
  }

  for (const finding of assignedFindings) {
    const caption = `📍 ${finding.location || 'N/A'}\n🆔 ${finding._id}`;
    await ctx.replyWithPhoto(finding.photo, {
      caption,
      ...Markup.inlineKeyboard([
        Markup.button.callback('📤 Upload Rectification', `rectify_${finding._id}`),
      ]),
    });
  }
});

// Rectification flow
bot.action(/rectify_(.+)/, authMiddleware([roles.IN_CHARGE]), async (ctx) => {
  await ctx.answerCbQuery();

  const findingId = ctx.match[1];
  ctx.session = {
    step: 'awaiting_rectification_photo',
    findingId,
  };

  ctx.reply('📷 Please upload the rectification photo.');
});

bot.action('review_findings', authMiddleware([roles.SAFETY_OFFICER]), async (ctx) => {
  await ctx.answerCbQuery();

  // Show findings assigned to safety officer that need review
  const findings = await Finding.find({ 
    status: { $in: ['Assigned', 'Rectified'] }
  }).sort({ 'timestamps.createdAt': -1 });

  if (findings.length === 0) {
    return ctx.reply('🎉 No findings to review right now.');
  }

  for (const finding of findings) {
    let caption = `📍 Location: ${finding.location || 'N/A'}\n` +
                  `🆔 ID: ${finding._id}\n` +
                  `Status: ${finding.status}`;

    if (finding.rectificationImage) {
      caption += `\n🖼 Rectification Image attached.`;
    }

    await ctx.replyWithPhoto(finding.photo, {
      caption,
      ...Markup.inlineKeyboard([
        Markup.button.callback('✅ Mark Complete', `markComplete_${finding._id}`),
        Markup.button.callback('🚩 Flag as Incomplete', `flagIncomplete_${finding._id}`),
      ]),
    });
  }
});


bot.action(/markComplete_(.+)/, authMiddleware([roles.SAFETY_OFFICER]), async (ctx) => {
  const findingId = ctx.match[1];
  await Finding.findByIdAndUpdate(findingId, {
    status: 'Complete',
    'timestamps.updatedAt': new Date(),
  });

  await ctx.answerCbQuery('Marked as Complete ✅');
  await ctx.editMessageCaption(ctx.update.callback_query.message.message_id, '✅ Marked as Complete');
});

bot.action(/flagIncomplete_(.+)/, authMiddleware([roles.SAFETY_OFFICER]), async (ctx) => {
  const findingId = ctx.match[1];
  await Finding.findByIdAndUpdate(findingId, {
    status: 'Flagged',
    'timestamps.updatedAt': new Date(),
  });

  await ctx.answerCbQuery('Flagged as Incomplete 🚩');
  await ctx.editMessageCaption(ctx.update.callback_query.message.message_id, '🚩 Flagged as Incomplete');
});

bot.action('view_all_findings', authMiddleware([roles.SUPERVISOR]), async (ctx) => {
  await ctx.answerCbQuery();

  const findings = await Finding.find().sort({ 'timestamps.createdAt': -1 });

  if (findings.length === 0) {
    return ctx.reply('📭 No findings available.');
  }

  for (const finding of findings) {
    console.log(finding)
    const caption = 
      `📍 Location: ${finding.location || 'N/A'}\n` +
      `📸 Submitted: ${finding.photo ? 'Yes' : 'No'}\n` +
      `🔧 Rectified: ${finding.rectificationImage ? 'Yes' : 'No'}\n` +
      `📌 Status: ${finding.status}\n` +
      `🧑‍💼 Assigned To: ${finding.name || 'Not assigned'}\n` +
      `🆔 ID: ${finding._id}`;

    await ctx.replyWithPhoto(finding.photo, { caption });
  }
});

bot.action('filter_findings', authMiddleware([roles.SUPERVISOR]), async (ctx) => {
  await ctx.answerCbQuery();

  const buttons = [
    ['Pending', 'Assigned'].map(status =>
      Markup.button.callback(status, `filter_status_${status}`)
    ),
    ['Rectified', 'Complete', 'Flagged'].map(status =>
      Markup.button.callback(status, `filter_status_${status}`)
    ),
  ];

  await ctx.reply('Select status to filter by:', Markup.inlineKeyboard(buttons));
});

bot.action(/filter_status_(.+)/, authMiddleware([roles.SUPERVISOR]), async (ctx) => {
  await ctx.answerCbQuery();
  const status = ctx.match[1];

  const findings = await Finding.find({ status }).sort({ 'timestamps.createdAt': -1 });

  if (findings.length === 0) {
    return ctx.reply(`📭 No findings with status "${status}"`);
  }

  for (const finding of findings) {
    const caption = 
      `📍 Location: ${finding.location || 'N/A'}\n` +
      `📌 Status: ${finding.status}\n` +
      `🧑‍💼 Assigned To: ${finding.assignedTo || 'Not assigned'}\n` +
      `🆔 ID: ${finding._id}`;

    await ctx.replyWithPhoto(finding.photo, { caption });
  }
});
bot.action('view_stats', authMiddleware([roles.SUPERVISOR]), async (ctx) => {
  await ctx.answerCbQuery();

  const statuses = ['Pending', 'Assigned', 'Rectified', 'Complete', 'Flagged', 'Closed'];
  const counts = await Promise.all(
    statuses.map(status => Finding.countDocuments({ status }))
  );

  const total = await Finding.countDocuments();
  const statusStats = statuses.map((status, i) => `- ${status}: ${counts[i]}`).join('\n');

  const assigned = await Finding.countDocuments({ assignedTo: { $ne: null } });
  const unassigned = total - assigned;

  const msg = `📊 *Safety Findings Summary:*\n\n` +
              `🗂 Total Findings: ${total}\n` +
              `${statusStats}\n\n` +
              `👷 Assigned: ${assigned}\n🚫 Unassigned: ${unassigned}`;

  await ctx.replyWithMarkdown(msg);
});

// Launch bot
bot.launch();
console.log('🚀 Bot is running...');

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));