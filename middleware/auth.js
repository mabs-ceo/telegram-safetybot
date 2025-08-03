const User = require('../models/User');

const authMiddleware = (roles = []) => async (ctx, next) => {
  const telegramId = String(ctx.from.id);
  const user = await User.findOne({ telegramId });
console.log('id:', telegramId);
  console.log('User found:', user);
  console.log('Required roles:', roles);

  if (!user || (roles.length && !roles.includes(user.role))) {
    return ctx.reply('❌ Unauthorized access.');
  }

  ctx.user = user; // Attach user to context
  return next();
};

module.exports = authMiddleware;
