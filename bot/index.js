require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
//  Config
// ═══════════════════════════════════════

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_URL = process.env.API_URL || 'http://localhost:5001/api';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'tradyx-internal-secret';
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');

if (!BOT_TOKEN) { console.error('❌ BOT_TOKEN not set in .env'); process.exit(1); }

let ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || null;

const https = require('https');
const agent = new https.Agent({ keepAlive: false, timeout: 30000 });
const bot = new Telegraf(BOT_TOKEN, {
  telegram: { agent }
});

// ═══════════════════════════════════════
//  Session Management (persist to file)
// ═══════════════════════════════════════

let sessions = {};
try { if (fs.existsSync(SESSIONS_FILE)) sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')); } catch { }
const saveSessions = () => { try { fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2)); } catch { } };
const getSession = (chatId) => sessions[String(chatId)] || null;
const setSession = (chatId, data) => { sessions[String(chatId)] = data; saveSessions(); };
const deleteSession = (chatId) => { delete sessions[String(chatId)]; saveSessions(); };

// ═══════════════════════════════════════
//  API Client
// ═══════════════════════════════════════

function apiClient(token) {
  const instance = axios.create({
    baseURL: API_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });
  if (token) instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  return instance;
}

async function autoAuth(chatId, from) {
  const existing = getSession(chatId);
  if (existing?.token) {
    // Verify token still valid
    try {
      await apiClient(existing.token).get('/user/me/dashboard');
      return existing;
    } catch (e) {
      // Token expired, user deleted, or server error — clear session and re-auth
      console.log(`[autoAuth] Session invalid for chat ${chatId} (${e.response?.status || e.message}), re-authenticating...`);
      deleteSession(chatId);
    }
  }

  const tgId = from.id;
  const email = `tg_${tgId}@tradyx.bot`;
  const password = `TgX!${tgId}#Secure`;
  const username = (from.first_name || `user_${tgId}`).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || `tg_${tgId}`;

  const api = apiClient();

  // Try login first
  try {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.success && data.token) {
      const session = { token: data.token, email, userId: data.user?.id, username: data.user?.username };
      setSession(chatId, session);
      return session;
    }
  } catch { }

  // Register
  try {
    const { data } = await api.post('/auth/register', { username, email, password });
    if (data.success && data.token) {
      const session = { token: data.token, email, userId: data.user?.id, username: data.user?.username };
      setSession(chatId, session);

      // Notify admin about new registration
      await notifyAdmin(`👤 *Новый пользователь* (Telegram)\n\n` +
        `Имя: ${escMd(from.first_name || '')} ${escMd(from.last_name || '')}\n` +
        `Username: @${escMd(from.username || 'N/A')}\n` +
        `Аккаунт: \`${username}\``);

      return session;
    }
    // Username taken — retry with tg_id suffix
    const fallbackUsername = `tg_${tgId}`;
    const { data: d2 } = await api.post('/auth/register', { username: fallbackUsername, email, password });
    if (d2.success && d2.token) {
      const session = { token: d2.token, email, userId: d2.user?.id, username: d2.user?.username };
      setSession(chatId, session);
      await notifyAdmin(`👤 *Новый пользователь* (Telegram)\nUsername: \`${fallbackUsername}\``);
      return session;
    }
    return null;
  } catch (e) {
    console.error('Auth error:', e.response?.data || e.message);
    return null;
  }
}

// ═══════════════════════════════════════
//  Admin Notifications
// ═══════════════════════════════════════

const escMd = (s) => String(s || '').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');

async function notifyAdmin(text) {
  if (!ADMIN_CHAT_ID) return;
  try {
    await bot.telegram.sendMessage(ADMIN_CHAT_ID, text, { parse_mode: 'MarkdownV2' });
  } catch (e) {
    console.error('Admin notify error:', e.message);
    // Fallback without markdown
    try {
      await bot.telegram.sendMessage(ADMIN_CHAT_ID, text.replace(/[\\*_`\[\]]/g, ''), { parse_mode: undefined });
    } catch { }
  }
}

// Public function for backend webhook
async function sendAdminNotification(message) {
  await notifyAdmin(message);
}

// ═══════════════════════════════════════
//  Middleware: Auto-auth
// ═══════════════════════════════════════

bot.use(async (ctx, next) => {
  if (ctx.chat?.type !== 'private') return next();
  ctx.session = getSession(ctx.chat.id);
  return next();
});

// ═══════════════════════════════════════
//  /start — handles normal, auth_, ref_
// ═══════════════════════════════════════

bot.start(async (ctx) => {
  const payload = ctx.startPayload || '';

  // ── Web Auth Flow: /start auth_<token>[_ref_<code>] ──
  if (payload.startsWith('auth_')) {
    const parts = payload.split('_ref_');
    const authToken = parts[0].replace('auth_', '');
    const refCode = parts[1] || null;

    const loading = await ctx.reply('🔐 Авторизация через Telegram...');

    try {
      const api = apiClient();
      const { data } = await api.post('/auth/telegram/confirm', {
        token: authToken,
        telegramId: ctx.from.id,
        telegramUsername: ctx.from.username || null,
        firstName: ctx.from.first_name || null,
        lastName: ctx.from.last_name || null,
        referrerCode: refCode,
        secret: INTERNAL_SECRET,
      });

      if (data.success) {
        await ctx.telegram.editMessageText(ctx.chat.id, loading.message_id, undefined,
          `✅ *Авторизация успешна\\!*\n\nВернитесь на сайт Tradyx — вход выполнен автоматически\\.\n\n_Также можете пользоваться ботом\\._`,
          { parse_mode: 'MarkdownV2', ...mainKeyboard() }
        );

        // Also auto-auth for bot usage
        const session = await autoAuth(ctx.chat.id, ctx.from);
        if (session) {
          await notifyAdmin(
            `🔐 *Telegram Login*\n\n` +
            `Пользователь: @${escMd(ctx.from.username || 'N/A')}\n` +
            `Имя: ${escMd(ctx.from.first_name || '')} ${escMd(ctx.from.last_name || '')}\n` +
            `TG ID: \`${ctx.from.id}\``
          );
        }
      } else {
        await ctx.telegram.editMessageText(ctx.chat.id, loading.message_id, undefined,
          '❌ Ссылка для входа недействительна или истекла. Попробуйте снова на сайте.');
      }
    } catch (e) {
      console.error('Auth confirm error:', e.response?.data || e.message);
      await ctx.telegram.editMessageText(ctx.chat.id, loading.message_id, undefined,
        '❌ Ошибка авторизации. Попробуйте снова.');
    }
    return;
  }

  // ── Referral Flow: /start ref_<code> ──
  if (payload.startsWith('ref_')) {
    const code = payload.replace('ref_', '');
    const s = getSession(ctx.chat.id) || {};
    s._refCode = code;
    setSession(ctx.chat.id, s);
  }

  // ── Normal /start ──
  const loading = await ctx.reply('⏳ Подключаюсь к Tradyx...');

  const session = await autoAuth(ctx.chat.id, ctx.from);
  if (!session) {
    return ctx.telegram.editMessageText(ctx.chat.id, loading.message_id, undefined,
      '❌ Ошибка подключения к серверу. Попробуйте позже.');
  }

  try {
    const { data } = await apiClient(session.token).get('/user/me/dashboard');
    await ctx.telegram.editMessageText(ctx.chat.id, loading.message_id, undefined,
      `🚀 *Добро пожаловать в Tradyx\\!*\n\n` +
      `👤 Аккаунт: \`${escMd(session.username)}\`\n` +
      `💰 Баланс: *$${escMd(data.balance?.toFixed(2))}*\n` +
      `📈 Активные инвестиции: *$${escMd(data.activeInvestmentsAmount?.toFixed(2))}*\n\n` +
      `Используйте меню ниже для управления:`,
      { parse_mode: 'MarkdownV2', ...mainKeyboard() }
    );
  } catch {
    await ctx.telegram.editMessageText(ctx.chat.id, loading.message_id, undefined,
      `✅ Аккаунт подключен!\n\nИспользуйте /menu для управления.`
    );
  }
});

// ═══════════════════════════════════════
//  Main Menu Keyboard
// ═══════════════════════════════════════

function mainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💰 Баланс', 'balance'), Markup.button.callback('📈 Инвестировать', 'invest')],
    [Markup.button.callback('💳 Пополнить', 'deposit_menu'), Markup.button.callback('💸 Вывести', 'withdraw_menu')],
    [Markup.button.callback('👥 Рефералы', 'referrals'), Markup.button.callback('📊 Статистика', 'stats')],
    [Markup.button.callback('🔗 Реф. ссылка', 'ref_link'), Markup.button.callback('📋 Планы', 'plans')],
  ]);
}

bot.command('menu', (ctx) => ctx.reply('📋 *Главное меню Tradyx*', { parse_mode: 'MarkdownV2', ...mainKeyboard() }));
bot.command('help', (ctx) => ctx.reply(
  '📋 *Команды Tradyx Bot*\n\n' +
  '/menu — Главное меню\n' +
  '/balance — Проверить баланс\n' +
  '/deposit \\<сумма\\> — Пополнить баланс\n' +
  '/invest — Посмотреть планы\n' +
  '/withdraw \\<сумма\\> — Вывести средства\n' +
  '/ref — Реферальная ссылка\n' +
  '/stats — Статистика\n' +
  '/chatid — ID этого чата \\(для админки\\)',
  { parse_mode: 'MarkdownV2' }
));

// ═══════════════════════════════════════
//  /balance
// ═══════════════════════════════════════

async function showBalance(ctx) {
  const session = await autoAuth(ctx.chat.id, ctx.from);
  if (!session) return ctx.reply('❌ Ошибка авторизации. Используйте /start');

  try {
    const { data } = await apiClient(session.token).get('/user/me/dashboard');
    const rankNames = { 0: 'Bronze 🥉', 1: 'Silver 🥈', 2: 'Gold 🥇', 3: 'Platinum 💎' };
    const rank = data.rankProgress ? rankNames[data.rankProgress.currentRank] || 'Bronze 🥉' : 'Bronze 🥉';

    return ctx.reply(
      `💰 *Ваш баланс*\n\n` +
      `┌ Баланс: *$${escMd(data.balance?.toFixed(2))}*\n` +
      `├ Активные инвестиции: *$${escMd(data.activeInvestmentsAmount?.toFixed(2))}*\n` +
      `├ Заработано всего: *$${escMd(data.totalEarned?.toFixed(2))}*\n` +
      `├ Профит сегодня: *$${escMd(data.todayProfit?.toFixed(2))}*\n` +
      `├ Реф\\. бонусы сегодня: *$${escMd(data.todayReferralBonus?.toFixed(2))}*\n` +
      `├ Рефералов: *${data.referralsCount || 0}*\n` +
      `└ Статус: *${escMd(rank)}*\n\n` +
      (data.nextPayoutAt ? `⏰ След\\. выплата: \`${escMd(new Date(data.nextPayoutAt).toLocaleString())}\`` : ''),
      { parse_mode: 'MarkdownV2', ...mainKeyboard() }
    );
  } catch (e) {
    return ctx.reply('❌ Ошибка загрузки данных. Попробуйте /start');
  }
}

bot.command('balance', showBalance);
bot.action('balance', async (ctx) => { await ctx.answerCbQuery(); await showBalance(ctx); });

// ═══════════════════════════════════════
//  /deposit
// ═══════════════════════════════════════

bot.action('deposit_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    '💳 *Пополнение баланса*\n\nВыберите сумму или введите свою:',
    { parse_mode: 'MarkdownV2',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('$50', 'dep_50'), Markup.button.callback('$100', 'dep_100'), Markup.button.callback('$250', 'dep_250')],
        [Markup.button.callback('$500', 'dep_500'), Markup.button.callback('$1000', 'dep_1000')],
        [Markup.button.callback('◀️ Назад', 'back_menu')],
      ])
    }
  );
});

async function processDeposit(ctx, amount) {
  const session = await autoAuth(ctx.chat.id, ctx.from);
  if (!session) return ctx.reply('❌ Ошибка авторизации. Используйте /start');

  try {
    await apiClient(session.token).post('/user/me/deposit', { amount });
    const { data } = await apiClient(session.token).get('/user/me/dashboard');

    await notifyAdmin(
      `💳 *Депозит*\n\n` +
      `Пользователь: \`${escMd(session.username)}\`\n` +
      `Сумма: *\\+$${escMd(amount.toFixed(2))}*\n` +
      `Новый баланс: *$${escMd(data.balance?.toFixed(2))}*`
    );

    return ctx.reply(
      `✅ *Баланс пополнен\\!*\n\n` +
      `Сумма: *\\+$${escMd(amount.toFixed(2))}*\n` +
      `Новый баланс: *$${escMd(data.balance?.toFixed(2))}*`,
      { parse_mode: 'MarkdownV2', ...mainKeyboard() }
    );
  } catch (e) {
    const msg = e.response?.data?.message || e.response?.data?.Message || 'Ошибка пополнения';
    return ctx.reply(`❌ ${msg}`);
  }
}

['50', '100', '250', '500', '1000'].forEach(a => {
  bot.action(`dep_${a}`, async (ctx) => { await ctx.answerCbQuery(); await processDeposit(ctx, parseFloat(a)); });
});

bot.command('deposit', async (ctx) => {
  const amount = parseFloat(ctx.message.text.split(' ')[1]);
  if (isNaN(amount) || amount <= 0) return ctx.reply('❌ Использование: /deposit <сумма>\nПример: /deposit 100');
  await processDeposit(ctx, amount);
});

// ═══════════════════════════════════════
//  /invest — Plans + Purchase
// ═══════════════════════════════════════

async function showPlans(ctx) {
  const session = await autoAuth(ctx.chat.id, ctx.from);
  if (!session) return ctx.reply('❌ Ошибка авторизации. Используйте /start');

  try {
    const { data: plans } = await apiClient(session.token).get('/investment/plans');
    const { data: dashboard } = await apiClient(session.token).get('/user/me/dashboard');

    const emoji = { blue: '🔵', purple: '🟣', cyan: '🔷', green: '🟢', orange: '🟠', red: '🔴' };
    let text = `📈 *Инвестиционные планы*\n\n💰 Ваш баланс: *$${escMd(dashboard.balance?.toFixed(2))}*\n\n`;

    plans.forEach(p => {
      const e = emoji[p.color] || '📊';
      const dailyReturn = (p.dailyRate * 100).toFixed(1);
      const monthlyRoi = (p.dailyRate * p.durationDays * 100).toFixed(0);
      text += `${e} *${escMd(p.name)}*\n`;
      text += `   Ставка: *${escMd(dailyReturn)}%* / день\n`;
      text += `   Срок: ${p.durationDays} дней \\(ROI ${escMd(monthlyRoi)}%\\)\n`;
      text += `   Диапазон: $${escMd(p.minAmount.toFixed(0))} — ${p.maxAmount >= 999999 ? '∞' : '$' + escMd(p.maxAmount.toFixed(0))}\n\n`;
    });

    text += `_Для инвестирования введите:_\n\`/buy <сумма>\`\n_Пример: /buy 100_`;

    const buttons = plans.map(p => [Markup.button.callback(`${emoji[p.color] || '📊'} ${p.name} — ${(p.dailyRate * 100).toFixed(1)}%`, `buy_plan_${p.id}`)]);
    buttons.push([Markup.button.callback('◀️ Назад', 'back_menu')]);

    return ctx.reply(text, { parse_mode: 'MarkdownV2', ...Markup.inlineKeyboard(buttons) });
  } catch (e) {
    return ctx.reply('❌ Ошибка загрузки планов');
  }
}

bot.command('invest', showPlans);
bot.action('invest', async (ctx) => { await ctx.answerCbQuery(); await showPlans(ctx); });
bot.action('plans', async (ctx) => { await ctx.answerCbQuery(); await showPlans(ctx); });

// Plan selection — ask amount
bot.action(/^buy_plan_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const planId = ctx.match[1];

  const session = await autoAuth(ctx.chat.id, ctx.from);
  if (!session) return ctx.reply('❌ Ошибка');

  try {
    const { data: plans } = await apiClient(session.token).get('/investment/plans');
    const plan = plans.find(p => p.id === planId);
    if (!plan) return ctx.reply('❌ План не найден');

    // Store selected plan for next text message
    const s = getSession(ctx.chat.id);
    s._pendingPlan = planId;
    setSession(ctx.chat.id, s);

    const presets = [plan.minAmount, Math.round((plan.minAmount + plan.maxAmount) / 2), plan.maxAmount >= 999999 ? plan.minAmount * 5 : plan.maxAmount]
      .filter(a => a <= 999999);

    return ctx.reply(
      `📈 *${escMd(plan.name)}* — ${escMd((plan.dailyRate * 100).toFixed(1))}% / день\n\n` +
      `Введите сумму инвестиции \\($${escMd(plan.minAmount.toFixed(0))} — ${plan.maxAmount >= 999999 ? '∞' : '$' + escMd(plan.maxAmount.toFixed(0))}\\):\n\n` +
      `Или выберите:`,
      {
        parse_mode: 'MarkdownV2',
        ...Markup.inlineKeyboard([
          presets.map(a => Markup.button.callback(`$${a}`, `invest_${a}`)),
          [Markup.button.callback('◀️ Отмена', 'back_menu')],
        ])
      }
    );
  } catch { return ctx.reply('❌ Ошибка'); }
});

async function purchaseInvestment(ctx, amount) {
  const session = await autoAuth(ctx.chat.id, ctx.from);
  if (!session) return ctx.reply('❌ Ошибка авторизации');

  try {
    const { data } = await apiClient(session.token).post('/investment/purchase', { amount });
    if (!data.success) return ctx.reply(`❌ ${data.message || 'Ошибка покупки'}`);

    const { data: dashboard } = await apiClient(session.token).get('/user/me/dashboard');

    await notifyAdmin(
      `📈 *Новая инвестиция*\n\n` +
      `Пользователь: \`${escMd(session.username)}\`\n` +
      `Сумма: *$${escMd(amount.toFixed(2))}*\n` +
      `Ставка: *${escMd((data.dailyRate * 100).toFixed(1))}%* / день\n` +
      `Доход/день: *$${escMd((amount * data.dailyRate).toFixed(2))}*\n` +
      `Выплат: *${data.remainingPayouts}*`
    );

    return ctx.reply(
      `✅ *Инвестиция активирована\\!*\n\n` +
      `💵 Сумма: *$${escMd(amount.toFixed(2))}*\n` +
      `📊 Ставка: *${escMd((data.dailyRate * 100).toFixed(1))}%* / день\n` +
      `💰 Доход/день: *$${escMd((amount * data.dailyRate).toFixed(2))}*\n` +
      `📅 Выплат осталось: *${data.remainingPayouts}*\n\n` +
      `Баланс: *$${escMd(dashboard.balance?.toFixed(2))}*`,
      { parse_mode: 'MarkdownV2', ...mainKeyboard() }
    );
  } catch (e) {
    const msg = e.response?.data?.message || e.response?.data?.Message || 'Ошибка покупки инвестиции';
    return ctx.reply(`❌ ${msg}`);
  }
}

// Preset amount buttons
bot.action(/^invest_(\d+(?:\.\d+)?)$/, async (ctx) => {
  await ctx.answerCbQuery();
  await purchaseInvestment(ctx, parseFloat(ctx.match[1]));
});

bot.command('buy', async (ctx) => {
  const amount = parseFloat(ctx.message.text.split(' ')[1]);
  if (isNaN(amount) || amount <= 0) return ctx.reply('❌ Использование: /buy <сумма>\nПример: /buy 100');
  await purchaseInvestment(ctx, amount);
});

// ═══════════════════════════════════════
//  /withdraw
// ═══════════════════════════════════════

bot.action('withdraw_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const session = await autoAuth(ctx.chat.id, ctx.from);
  if (!session) return ctx.reply('❌ Ошибка авторизации');

  try {
    const { data: info } = await apiClient(session.token).get('/user/me/withdrawal-info');
    const { data: dashboard } = await apiClient(session.token).get('/user/me/dashboard');

    return ctx.reply(
      `💸 *Вывод средств*\n\n` +
      `💰 Баланс: *$${escMd(dashboard.balance?.toFixed(2))}*\n` +
      `📋 Мин\\. сумма: *$${escMd(info.minAmount?.toFixed(0) || '10')}*\n` +
      `⚡ Комиссия Instant: *${escMd((info.feeRate * 100).toFixed(0))}%*\n` +
      `🔝 Макс\\. Instant: *$${escMd(info.maxInstant?.toFixed(0))}*\n\n` +
      `_Введите:_ \`/withdraw <сумма>\`\n_Или выберите тип:_`,
      {
        parse_mode: 'MarkdownV2',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🐢 Regular (0%)', 'wd_type_regular'), Markup.button.callback('⚡ Instant (-' + (info.feeRate * 100).toFixed(0) + '%)', 'wd_type_instant')],
          [Markup.button.callback('◀️ Назад', 'back_menu')],
        ])
      }
    );
  } catch { return ctx.reply('❌ Ошибка загрузки информации о выводе'); }
});

bot.action(/^wd_type_(regular|instant)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const isInstant = ctx.match[1] === 'instant';
  const s = getSession(ctx.chat.id);
  if (s) { s._withdrawInstant = isInstant; setSession(ctx.chat.id, s); }

  return ctx.reply(
    `${isInstant ? '⚡' : '🐢'} *Вывод \\(${isInstant ? 'Instant' : 'Regular'}\\)*\n\nВведите сумму:\n\`/withdraw <сумма>\``,
    { parse_mode: 'MarkdownV2' }
  );
});

bot.command('withdraw', async (ctx) => {
  const amount = parseFloat(ctx.message.text.split(' ')[1]);
  if (isNaN(amount) || amount <= 0) return ctx.reply('❌ Использование: /withdraw <сумма>\nПример: /withdraw 50');

  const session = await autoAuth(ctx.chat.id, ctx.from);
  if (!session) return ctx.reply('❌ Ошибка авторизации');

  const s = getSession(ctx.chat.id);
  const isInstant = s?._withdrawInstant || false;

  try {
    const { data } = await apiClient(session.token).post('/user/me/withdraw', { amount, isInstant });
    const { data: dashboard } = await apiClient(session.token).get('/user/me/dashboard');

    await notifyAdmin(
      `💸 *Заявка на вывод*\n\n` +
      `Пользователь: \`${escMd(session.username)}\`\n` +
      `Сумма: *$${escMd(amount.toFixed(2))}*\n` +
      `Тип: *${isInstant ? '⚡ Instant' : '🐢 Regular'}*\n` +
      `Баланс: *$${escMd(dashboard.balance?.toFixed(2))}*`
    );

    return ctx.reply(
      `✅ *Заявка на вывод создана\\!*\n\n` +
      `💵 Сумма: *$${escMd(amount.toFixed(2))}*\n` +
      `📋 Тип: *${isInstant ? '⚡ Instant' : '🐢 Regular \\(1\\-3 дня\\)'}*\n` +
      `💰 Остаток: *$${escMd(dashboard.balance?.toFixed(2))}*`,
      { parse_mode: 'MarkdownV2', ...mainKeyboard() }
    );
  } catch (e) {
    const msg = e.response?.data?.message || e.response?.data?.Message || 'Ошибка вывода';
    return ctx.reply(`❌ ${msg}`);
  }
});

// ═══════════════════════════════════════
//  /ref — Referral Link
// ═══════════════════════════════════════

async function showRef(ctx) {
  const session = await autoAuth(ctx.chat.id, ctx.from);
  if (!session) return ctx.reply('❌ Ошибка авторизации');

  try {
    const { data } = await apiClient(session.token).get('/user/me/dashboard');
    const code = data.inviteCode;
    const botInfo = await bot.telegram.getMe();
    const refLink = `https://t.me/${botInfo.username}?start=ref_${code}`;

    return ctx.reply(
      `🔗 *Ваша реферальная ссылка*\n\n` +
      `\`${escMd(refLink)}\`\n\n` +
      `📋 Код приглашения: \`${escMd(code)}\`\n` +
      `👥 Рефералов: *${data.referralsCount || 0}*\n` +
      `💰 Заработано с рефералов: *$${escMd(data.totalReferralEarned?.toFixed(2))}*\n\n` +
      `_Поделитесь ссылкой\\. Вы получаете:_\n` +
      `├ L1: *10%* от инвестиций реферала\n` +
      `├ L2: *5%* от суб\\-рефералов\n` +
      `└ L3: *2%* от суб\\-суб\\-рефералов`,
      { parse_mode: 'MarkdownV2' }
    );
  } catch { return ctx.reply('❌ Ошибка загрузки данных'); }
}

bot.command('ref', showRef);
bot.action('ref_link', async (ctx) => { await ctx.answerCbQuery(); await showRef(ctx); });

// (Referral start links are handled inside bot.start above)

// ═══════════════════════════════════════
//  /stats
// ═══════════════════════════════════════

async function showStats(ctx) {
  const session = await autoAuth(ctx.chat.id, ctx.from);
  if (!session) return ctx.reply('❌ Ошибка авторизации');

  try {
    const { data: dash } = await apiClient(session.token).get('/user/me/dashboard');
    const { data: investments } = await apiClient(session.token).get('/investment/my');

    const active = Array.isArray(investments) ? investments.filter(i => i.isActive) : [];
    const totalDailyIncome = active.reduce((s, i) => s + i.amount * i.dailyRate, 0);

    return ctx.reply(
      `📊 *Статистика*\n\n` +
      `┌ 💰 Баланс: *$${escMd(dash.balance?.toFixed(2))}*\n` +
      `├ 📈 Активных инвестиций: *${active.length}*\n` +
      `├ 💵 Сумма инвестиций: *$${escMd(dash.activeInvestmentsAmount?.toFixed(2))}*\n` +
      `├ 💎 Доход/день: *$${escMd(totalDailyIncome.toFixed(2))}*\n` +
      `├ 🏆 Всего заработано: *$${escMd(dash.totalEarned?.toFixed(2))}*\n` +
      `├ 📅 Профит сегодня: *$${escMd(dash.todayProfit?.toFixed(2))}*\n` +
      `├ 👥 Рефералов: *${dash.referralsCount || 0}*\n` +
      `└ 🎯 Реф\\. бонусы: *$${escMd(dash.totalReferralEarned?.toFixed(2))}*`,
      { parse_mode: 'MarkdownV2', ...mainKeyboard() }
    );
  } catch { return ctx.reply('❌ Ошибка загрузки статистики'); }
}

bot.command('stats', showStats);
bot.action('stats', async (ctx) => { await ctx.answerCbQuery(); await showStats(ctx); });
bot.action('referrals', async (ctx) => { await ctx.answerCbQuery(); await showStats(ctx); });

// ═══════════════════════════════════════
//  /chatid — Utility
// ═══════════════════════════════════════

bot.command('chatid', (ctx) => {
  ctx.reply(`📋 Chat ID: \`${ctx.chat.id}\`\n\nДобавьте это значение в \`.env\` как \`ADMIN_CHAT_ID\` для получения уведомлений.`, { parse_mode: 'MarkdownV2' });
});

// ═══════════════════════════════════════
//  /setadmin — Set admin chat from bot
// ═══════════════════════════════════════

bot.command('setadmin', (ctx) => {
  ADMIN_CHAT_ID = String(ctx.chat.id);
  // Also save to .env for persistence
  const envPath = path.join(__dirname, '.env');
  try {
    let env = fs.readFileSync(envPath, 'utf8');
    env = env.replace(/^ADMIN_CHAT_ID=.*$/m, `ADMIN_CHAT_ID=${ADMIN_CHAT_ID}`);
    fs.writeFileSync(envPath, env);
  } catch { }
  ctx.reply(`✅ Этот чат установлен как канал уведомлений!\n\nChat ID: ${ADMIN_CHAT_ID}\n\nСюда будут приходить уведомления о:\n• Новых депозитах\n• Инвестициях\n• Заявках на вывод\n• Новых пользователях`);
});

// ═══════════════════════════════════════
//  Back to menu
// ═══════════════════════════════════════

bot.action('back_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('📋 *Главное меню*', { parse_mode: 'MarkdownV2', ...mainKeyboard() });
});

// ═══════════════════════════════════════
//  Handle text messages (amount input)
// ═══════════════════════════════════════

bot.on('text', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  const text = ctx.message.text.trim();

  // If it starts with /, it's an unknown command
  if (text.startsWith('/')) return ctx.reply('❓ Неизвестная команда. Используйте /help');

  // Check if there's a pending plan purchase
  const s = getSession(ctx.chat.id);
  if (s?._pendingPlan) {
    const amount = parseFloat(text);
    if (!isNaN(amount) && amount > 0) {
      delete s._pendingPlan;
      setSession(ctx.chat.id, s);
      return purchaseInvestment(ctx, amount);
    }
  }

  // Fallback — show menu
  return ctx.reply('📋 Используйте /menu или кнопки ниже:', mainKeyboard());
});

// ═══════════════════════════════════════
//  Internal HTTP server for backend notifications
// ═══════════════════════════════════════

const http = require('http');
const NOTIFY_PORT = 3333;

const notifyServer = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/notify') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { message, chatId } = JSON.parse(body);
        const target = chatId || ADMIN_CHAT_ID;
        if (target && message) {
          await bot.telegram.sendMessage(target, message, { parse_mode: 'HTML' });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

// ═══════════════════════════════════════
//  Global Error Handler
// ═══════════════════════════════════════

bot.catch((err, ctx) => {
  console.error(`[Bot Error] ${ctx.updateType}:`, err.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason?.message || reason);
});

// ═══════════════════════════════════════
//  Launch
// ═══════════════════════════════════════

async function startBot() {
  console.log('  🔄 Connecting to Telegram...');
  try {
    // Test connection first
    const me = await bot.telegram.getMe();
    console.log(`  ✅ Bot: @${me.username} (${me.first_name})`);
    
    // Start polling
    bot.launch({ dropPendingUpdates: true });
    console.log('');
    console.log('══════════════════════════════════════════');
    console.log('  🤖 Tradyx Bot STARTED (polling mode)');
    console.log('══════════════════════════════════════════');
    console.log(`  API: ${API_URL}`);
    console.log(`  Admin Chat: ${ADMIN_CHAT_ID || 'NOT SET (use /setadmin)'}`);
    console.log(`  Notify endpoint: http://localhost:${NOTIFY_PORT}/notify`);
    console.log('══════════════════════════════════════════');
    console.log('');
  } catch (e) {
    console.error(`  ❌ Telegram connection failed: ${e.message}`);
    console.error('  Retrying in 5s...');
    setTimeout(() => startBot(), 5000);
  }
}

notifyServer.listen(NOTIFY_PORT, () => {
  console.log(`  📡 Notification server on port ${NOTIFY_PORT}`);
  startBot();
});

// Graceful shutdown
process.once('SIGINT', () => { try { bot.stop('SIGINT'); } catch {} process.exit(0); });
process.once('SIGTERM', () => { try { bot.stop('SIGTERM'); } catch {} process.exit(0); });
