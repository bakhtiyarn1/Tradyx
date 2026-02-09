require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
//  Config
// ═══════════════════════════════════════

const BOT_TOKEN = process.env.ADMIN_BOT_TOKEN;
const API_URL = process.env.API_URL || 'http://localhost:5001/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'superadmin@tradyx.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'SeedPass123!';
const NOTIFY_PORT = 3334;

if (!BOT_TOKEN) { console.error('❌ ADMIN_BOT_TOKEN not set in .env'); process.exit(1); }

// ═══════════════════════════════════════
//  Admin Chat IDs — persisted to file
// ═══════════════════════════════════════

const ADMIN_IDS_FILE = path.join(__dirname, 'admin_ids.json');

function loadAdminIds() {
  // Start with IDs from .env (if any)
  const envIds = (process.env.ADMIN_TG_IDS || '').split(',').filter(Boolean).map(Number);
  try {
    if (fs.existsSync(ADMIN_IDS_FILE)) {
      const fileIds = JSON.parse(fs.readFileSync(ADMIN_IDS_FILE, 'utf-8'));
      if (Array.isArray(fileIds)) {
        // Merge: env IDs + file IDs, deduplicated
        const merged = [...new Set([...envIds, ...fileIds])];
        return merged;
      }
    }
  } catch {}
  return envIds;
}

function saveAdminIds(ids) {
  try {
    fs.writeFileSync(ADMIN_IDS_FILE, JSON.stringify(ids), 'utf-8');
  } catch (e) {
    console.error('[Admin IDs] Save error:', e.message);
  }
}

let AUTHORIZED_IDS = loadAdminIds();

function addAdminId(chatId) {
  if (!AUTHORIZED_IDS.includes(chatId)) {
    AUTHORIZED_IDS.push(chatId);
    saveAdminIds(AUTHORIZED_IDS);
    console.log(`[Admin IDs] Added ${chatId}. Total: ${AUTHORIZED_IDS.length}`);
    return true;
  }
  return false;
}

const agent = new https.Agent({ keepAlive: false, timeout: 30000 });
const bot = new Telegraf(BOT_TOKEN, { telegram: { agent } });

// ═══════════════════════════════════════
//  Admin API Client (auto-auth)
// ═══════════════════════════════════════

let adminToken = null;

async function getAdminToken() {
  if (adminToken) {
    try {
      await axios.get(`${API_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` }, timeout: 5000
      });
      return adminToken;
    } catch (e) {
      if (e.response?.status !== 401 && e.response?.status !== 403) throw e;
      adminToken = null;
    }
  }

  const { data } = await axios.post(`${API_URL}/auth/login`, {
    email: ADMIN_EMAIL, password: ADMIN_PASSWORD
  }, { timeout: 10000 });

  if (!data.success || !data.token) throw new Error('Admin login failed');
  adminToken = data.token;
  return adminToken;
}

async function adminApi(method, path, body = null) {
  const token = await getAdminToken();
  const config = {
    method, url: `${API_URL}${path}`, timeout: 15000,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (body) config.data = body;
  const { data } = await axios(config);
  return data;
}

// ═══════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════

const esc = (s) => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const pct = (n) => `${(Number(n || 0) * 100).toFixed(1)}%`;
const rankName = { 0: 'Bronze 🥉', 1: 'Silver 🥈', 2: 'Gold 🥇', 3: 'Platinum 💎' };

// ═══════════════════════════════════════
//  /start — Auto-register admin
// ═══════════════════════════════════════

bot.start(async (ctx) => {
  if (ctx.chat?.type !== 'private') return;

  const chatId = ctx.from.id;
  const isNew = addAdminId(chatId);

  try {
    const stats = await adminApi('GET', '/admin/stats');
    await ctx.reply(
      `🛡 <b>Tradyx Admin Panel</b>\n\n` +
      (isNew
        ? `✅ Ваш Telegram ID (<code>${chatId}</code>) зарегистрирован!\n` +
          `Теперь все уведомления платформы будут приходить сюда.\n\n`
        : '') +
      `👥 Пользователей: <b>${stats.totalUsers}</b>\n` +
      `💰 Общий баланс: <b>${money(stats.totalBalance)}</b>\n` +
      `📈 Инвестировано: <b>${money(stats.totalInvested)}</b>\n` +
      `💸 Выплачено: <b>${money(stats.totalPaidOut)}</b>\n` +
      `🏦 Резерв: <b>${money(stats.systemReserve)}</b>\n\n` +
      `Используйте меню ниже:`,
      { parse_mode: 'HTML', ...adminKeyboard() }
    );
  } catch (e) {
    // Even if backend is down, register the chat ID for notifications
    if (isNew) {
      await ctx.reply(
        `✅ Ваш Telegram ID (<code>${chatId}</code>) зарегистрирован!\n` +
        `Уведомления будут приходить сюда.\n\n` +
        `❌ Backend недоступен: ${e.message}\nПроверьте сервер.`,
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.reply(`❌ Ошибка подключения: ${e.message}\n\nПроверьте backend.`);
    }
  }
});

// ═══════════════════════════════════════
//  Main Menu
// ═══════════════════════════════════════

function adminKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📊 Статистика', 'stats'), Markup.button.callback('👥 Пользователи', 'users')],
    [Markup.button.callback('⏳ Ожидающие выводы', 'pending'), Markup.button.callback('📈 Инвестиции', 'investments')],
    [Markup.button.callback('📋 Планы', 'plans'), Markup.button.callback('📉 Аналитика', 'analytics')],
    [Markup.button.callback('⚡ Триггер выплат', 'trigger_payouts')],
  ]);
}

bot.command('menu', (ctx) => ctx.reply('🛡 <b>Admin Menu</b>', { parse_mode: 'HTML', ...adminKeyboard() }));

// ═══════════════════════════════════════
//  📊 Stats
// ═══════════════════════════════════════

async function showStats(ctx) {
  try {
    const s = await adminApi('GET', '/admin/stats');
    await ctx.reply(
      `📊 <b>Статистика платформы</b>\n\n` +
      `┌ 👥 Пользователей: <b>${s.totalUsers}</b>\n` +
      `├ 💰 Общий баланс: <b>${money(s.totalBalance)}</b>\n` +
      `├ 📈 Активных инвестиций: <b>${money(s.totalInvested)}</b>\n` +
      `├ 💸 Выплачено: <b>${money(s.totalPaidOut)}</b>\n` +
      `├ 🏦 Резерв системы: <b>${money(s.systemReserve)}</b>\n` +
      `├ 📥 Депозитов всего: <b>${money(s.totalDeposits)}</b>\n` +
      `├ 📤 Выводов всего: <b>${money(s.totalWithdrawals)}</b>\n` +
      `└ ⏳ Ожидающие выводы: <b>${s.pendingWithdrawals || 0}</b>`,
      { parse_mode: 'HTML', ...adminKeyboard() }
    );
  } catch (e) { await ctx.reply(`❌ ${e.message}`); }
}

bot.command('stats', showStats);
bot.action('stats', async (ctx) => { await ctx.answerCbQuery(); await showStats(ctx); });

// ═══════════════════════════════════════
//  👥 Users
// ═══════════════════════════════════════

async function showUsers(ctx) {
  try {
    const users = await adminApi('GET', '/admin/all-users');
    const list = Array.isArray(users) ? users.slice(0, 20) : [];
    if (list.length === 0) return ctx.reply('👥 Нет пользователей');

    let text = `👥 <b>Пользователи</b> (${list.length})\n\n`;
    list.forEach((u, i) => {
      text += `${i + 1}. <code>${esc(u.username)}</code> — ${money(u.balance)} ${rankName[u.status] || ''}\n`;
    });
    text += `\n<i>Для деталей:</i> <code>/user username</code>`;

    await ctx.reply(text, { parse_mode: 'HTML', ...adminKeyboard() });
  } catch (e) { await ctx.reply(`❌ ${e.message}`); }
}

bot.command('users', showUsers);
bot.action('users', async (ctx) => { await ctx.answerCbQuery(); await showUsers(ctx); });

// ═══════════════════════════════════════
//  /user <username> — User details
// ═══════════════════════════════════════

bot.command('user', async (ctx) => {
  const query = ctx.message.text.split(' ').slice(1).join(' ').trim();
  if (!query) return ctx.reply('❌ Использование: /user <username>');

  try {
    const users = await adminApi('GET', '/admin/all-users');
    const user = (Array.isArray(users) ? users : []).find(u =>
      u.username?.toLowerCase() === query.toLowerCase() ||
      u.email?.toLowerCase() === query.toLowerCase() ||
      u.id === query
    );

    if (!user) return ctx.reply(`❌ Пользователь "${esc(query)}" не найден`, { parse_mode: 'HTML' });

    const details = await adminApi('GET', `/admin/users/${user.id}/full-details`);
    const d = details;

    let text = `👤 <b>${esc(d.username)}</b>\n\n` +
      `├ 📧 Email: <code>${esc(d.email)}</code>\n` +
      `├ 🆔 ID: <code>${d.id}</code>\n` +
      `├ 💰 Баланс: <b>${money(d.balance)}</b>\n` +
      `├ 🏆 Статус: ${rankName[d.status] || 'Bronze'}\n` +
      `├ 💎 Личный оборот: ${money(d.personalTurnover)}\n` +
      `├ 👥 Командный оборот: ${money(d.teamTurnover)}\n` +
      `├ 📈 Активных инвестиций: ${d.activeInvestments || 0}\n` +
      `├ 🔗 Рефералов: ${d.referralsCount || 0}\n` +
      `├ 📅 Регистрация: ${new Date(d.createdAt).toLocaleDateString()}\n` +
      `├ 🌐 IP: <code>${esc(d.registrationIp) || '—'}</code>\n` +
      `└ ⚠️ Подозрительный: ${d.isSuspicious ? '❗ ДА' : 'Нет'}`;

    const buttons = [
      [Markup.button.callback(`➕ Пополнить баланс`, `adj_plus_${user.id}`)],
      [Markup.button.callback(`➖ Списать баланс`, `adj_minus_${user.id}`)],
      [Markup.button.callback('◀️ Назад', 'users')],
    ];

    await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (e) { await ctx.reply(`❌ ${e.message}`); }
});

// Balance adjustment — store pending in memory
const pendingAdjustments = {};

bot.action(/^adj_(plus|minus)_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const direction = ctx.match[1];
  const userId = ctx.match[2];
  pendingAdjustments[ctx.chat.id] = { userId, direction };
  await ctx.reply(
    `💰 Введите сумму для ${direction === 'plus' ? 'пополнения ➕' : 'списания ➖'}:\n\n` +
    `Пример: <code>100</code> или <code>50.5</code>\n` +
    `Отмена: /cancel`,
    { parse_mode: 'HTML' }
  );
});

bot.command('cancel', (ctx) => {
  delete pendingAdjustments[ctx.chat.id];
  ctx.reply('❌ Операция отменена', adminKeyboard());
});

// ═══════════════════════════════════════
//  ⏳ Pending Withdrawals
// ═══════════════════════════════════════

async function showPending(ctx) {
  try {
    const pending = await adminApi('GET', '/admin/withdrawals/pending');
    const list = Array.isArray(pending) ? pending : [];

    if (list.length === 0) {
      return ctx.reply('✅ Нет ожидающих выводов', { ...adminKeyboard() });
    }

    let text = `⏳ <b>Ожидающие выводы</b> (${list.length})\n\n`;
    const buttons = [];

    list.forEach((w, i) => {
      text += `${i + 1}. <code>${esc(w.username || w.userId?.slice(0, 8))}</code> — <b>${money(w.amount)}</b>\n`;
      text += `   📅 ${new Date(w.createdAt).toLocaleString()}\n`;
      if (w.walletAddress) text += `   💳 ${esc(w.walletAddress)}\n`;
      text += '\n';

      buttons.push([
        Markup.button.callback(`✅ #${i + 1} Одобрить`, `approve_${w.id}`),
        Markup.button.callback(`❌ #${i + 1} Отклонить`, `reject_${w.id}`),
      ]);
    });

    buttons.push([Markup.button.callback('✅ Одобрить ВСЕ', 'approve_all')]);
    buttons.push([Markup.button.callback('◀️ Назад', 'back_menu')]);

    await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (e) { await ctx.reply(`❌ ${e.message}`); }
}

bot.command('pending', showPending);
bot.action('pending', async (ctx) => { await ctx.answerCbQuery(); await showPending(ctx); });

// Approve withdrawal
bot.action(/^approve_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('Обработка...');
  const txId = ctx.match[1];

  if (txId === 'all') {
    try {
      const pending = await adminApi('GET', '/admin/withdrawals/pending');
      const list = Array.isArray(pending) ? pending : [];
      let approved = 0;
      for (const w of list) {
        try {
          await adminApi('POST', `/admin/withdrawals/${w.id}/approve`);
          approved++;
        } catch {}
      }
      return ctx.reply(`✅ Одобрено выводов: <b>${approved}/${list.length}</b>`, { parse_mode: 'HTML', ...adminKeyboard() });
    } catch (e) { return ctx.reply(`❌ ${e.message}`); }
  }

  try {
    await adminApi('POST', `/admin/withdrawals/${txId}/approve`);
    await ctx.reply(`✅ Вывод <code>${txId.slice(0, 8)}...</code> одобрен`, { parse_mode: 'HTML', ...adminKeyboard() });
  } catch (e) {
    await ctx.reply(`❌ ${e.response?.data?.message || e.message}`);
  }
});

// Reject withdrawal
bot.action(/^reject_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const txId = ctx.match[1];

  try {
    await adminApi('POST', `/admin/withdrawals/${txId}/reject`, { reason: 'Отклонено администратором' });
    await ctx.reply(`❌ Вывод <code>${txId.slice(0, 8)}...</code> отклонён. Средства возвращены.`, { parse_mode: 'HTML', ...adminKeyboard() });
  } catch (e) {
    await ctx.reply(`❌ ${e.response?.data?.message || e.message}`);
  }
});

// ═══════════════════════════════════════
//  📈 Recent Investments
// ═══════════════════════════════════════

async function showInvestments(ctx) {
  try {
    const investments = await adminApi('GET', '/admin/investments?limit=15');
    const list = Array.isArray(investments) ? investments : [];

    if (list.length === 0) return ctx.reply('📈 Нет инвестиций', { ...adminKeyboard() });

    let text = `📈 <b>Последние инвестиции</b>\n\n`;
    list.forEach((inv, i) => {
      const status = inv.isActive ? '🟢' : '⚫';
      text += `${status} <code>${esc(inv.username || '?')}</code> — <b>${money(inv.amount)}</b> (${pct(inv.dailyRate)}/д, ${inv.remainingPayouts || 0} выплат)\n`;
    });

    await ctx.reply(text, { parse_mode: 'HTML', ...adminKeyboard() });
  } catch (e) { await ctx.reply(`❌ ${e.message}`); }
}

bot.command('investments', showInvestments);
bot.action('investments', async (ctx) => { await ctx.answerCbQuery(); await showInvestments(ctx); });

// ═══════════════════════════════════════
//  📋 Investment Plans
// ═══════════════════════════════════════

async function showPlans(ctx) {
  try {
    const plans = await adminApi('GET', '/admin/plans');
    const list = Array.isArray(plans) ? plans : [];

    if (list.length === 0) return ctx.reply('📋 Нет планов');

    let text = `📋 <b>Инвестиционные планы</b>\n\n`;
    list.forEach((p, i) => {
      const status = p.isActive ? '🟢' : '🔴';
      text += `${status} <b>${esc(p.name)}</b>\n`;
      text += `   Ставка: ${pct(p.dailyRate)}/день (${(p.dailyRate * p.durationDays * 100).toFixed(0)}% ROI)\n`;
      text += `   Диапазон: ${money(p.minAmount)} — ${p.maxAmount >= 999999 ? '∞' : money(p.maxAmount)}\n`;
      text += `   Срок: ${p.durationDays} дней\n`;
      if (p.totalInvestors != null) text += `   Инвесторов: ${p.totalInvestors} (${money(p.totalInvested)})\n`;
      text += '\n';
    });

    const buttons = list.map(p => [
      Markup.button.callback(`${p.isActive ? '🔴 Выкл' : '🟢 Вкл'} ${p.name}`, `toggle_plan_${p.id}_${p.isActive ? 'off' : 'on'}`),
    ]);
    buttons.push([Markup.button.callback('◀️ Назад', 'back_menu')]);

    await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (e) { await ctx.reply(`❌ ${e.message}`); }
}

bot.command('plans', showPlans);
bot.action('plans', async (ctx) => { await ctx.answerCbQuery(); await showPlans(ctx); });

// Toggle plan active/inactive
bot.action(/^toggle_plan_(.+)_(on|off)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const planId = ctx.match[1];
  const activate = ctx.match[2] === 'on';

  try {
    await adminApi('PUT', `/admin/plans/${planId}`, { isActive: activate });
    await ctx.reply(`${activate ? '🟢' : '🔴'} План ${activate ? 'активирован' : 'деактивирован'}`, { ...adminKeyboard() });
  } catch (e) { await ctx.reply(`❌ ${e.message}`); }
});

// ═══════════════════════════════════════
//  📉 Analytics
// ═══════════════════════════════════════

async function showAnalytics(ctx) {
  try {
    const data = await adminApi('GET', '/admin/analytics?days=7');

    let text = `📉 <b>Аналитика (7 дней)</b>\n\n`;

    if (data.financial) {
      const f = data.financial;
      text += `<b>💰 Финансы:</b>\n`;
      text += `├ Депозиты: <b>${money(f.totalDeposits)}</b>\n`;
      text += `├ Инвестиции: <b>${money(f.totalInvestments)}</b>\n`;
      text += `├ Выплаты: <b>${money(f.totalPayouts)}</b>\n`;
      text += `├ Выводы: <b>${money(f.totalWithdrawals)}</b>\n`;
      text += `├ Комиссии: <b>${money(f.totalFees)}</b>\n`;
      text += `└ Баланс платформы: <b>${money(f.platformBalance)}</b>\n\n`;
    }

    if (data.userGrowth) {
      const g = data.userGrowth;
      text += `<b>👥 Рост:</b>\n`;
      text += `├ Новых за 24ч: <b>${g.last24h || 0}</b>\n`;
      text += `├ Новых за 7д: <b>${g.last7d || 0}</b>\n`;
      text += `└ Всего: <b>${g.total || 0}</b>\n\n`;
    }

    if (data.planDistribution && data.planDistribution.length > 0) {
      text += `<b>📊 Распределение по планам:</b>\n`;
      data.planDistribution.forEach(p => {
        text += `├ ${esc(p.name)}: ${p.investors || 0} инв. (${money(p.totalAmount)})\n`;
      });
      text += '\n';
    }

    await ctx.reply(text, { parse_mode: 'HTML', ...adminKeyboard() });
  } catch (e) { await ctx.reply(`❌ ${e.message}`); }
}

bot.command('analytics', showAnalytics);
bot.action('analytics', async (ctx) => { await ctx.answerCbQuery(); await showAnalytics(ctx); });

// ═══════════════════════════════════════
//  ⚡ Trigger Payouts
// ═══════════════════════════════════════

bot.action('trigger_payouts', async (ctx) => {
  await ctx.answerCbQuery('Запуск выплат...');
  try {
    const result = await adminApi('POST', '/admin/payouts/trigger');
    await ctx.reply(
      `⚡ <b>Выплаты обработаны</b>\n\n` +
      `Обработано: <b>${result.processedCount || 0}</b>\n` +
      `${result.message}`,
      { parse_mode: 'HTML', ...adminKeyboard() }
    );
  } catch (e) { await ctx.reply(`❌ ${e.message}`); }
});

bot.command('payout', async (ctx) => {
  try {
    const result = await adminApi('POST', '/admin/payouts/trigger');
    await ctx.reply(`⚡ Выплаты: ${result.processedCount || 0} обработано`, { ...adminKeyboard() });
  } catch (e) { await ctx.reply(`❌ ${e.message}`); }
});

// ═══════════════════════════════════════
//  Text handler (balance adjustments)
// ═══════════════════════════════════════

bot.on('text', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  const text = ctx.message.text.trim();

  if (text.startsWith('/')) return ctx.reply('❓ Неизвестная команда. /menu для списка.');

  // Check for pending balance adjustment
  const pending = pendingAdjustments[ctx.chat.id];
  if (pending) {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) return ctx.reply('❌ Введите положительное число');

    const adjustAmount = pending.direction === 'minus' ? -amount : amount;
    delete pendingAdjustments[ctx.chat.id];

    try {
      await adminApi('POST', `/admin/users/${pending.userId}/adjust-balance`, {
        amount: adjustAmount,
        reason: `Admin bot: ${pending.direction === 'plus' ? 'пополнение' : 'списание'}`
      });
      await ctx.reply(
        `✅ Баланс ${pending.direction === 'plus' ? 'пополнен' : 'списан'} на <b>${money(Math.abs(adjustAmount))}</b>`,
        { parse_mode: 'HTML', ...adminKeyboard() }
      );
    } catch (e) {
      await ctx.reply(`❌ ${e.response?.data?.message || e.message}`);
    }
    return;
  }

  await ctx.reply('📋 /menu — главное меню');
});

// ═══════════════════════════════════════
//  /help
// ═══════════════════════════════════════

bot.command('help', (ctx) => ctx.reply(
  `🛡 <b>Команды Admin Bot</b>\n\n` +
  `/menu — Главное меню\n` +
  `/stats — Статистика платформы\n` +
  `/users — Список пользователей\n` +
  `/user &lt;username&gt; — Детали пользователя\n` +
  `/pending — Ожидающие выводы\n` +
  `/investments — Последние инвестиции\n` +
  `/plans — Инвестиционные планы\n` +
  `/analytics — Аналитика 7д\n` +
  `/payout — Триггер выплат\n` +
  `/cancel — Отменить текущую операцию`,
  { parse_mode: 'HTML' }
));

// ═══════════════════════════════════════
//  Back to menu
// ═══════════════════════════════════════

bot.action('back_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🛡 <b>Admin Menu</b>', { parse_mode: 'HTML', ...adminKeyboard() });
});

// ═══════════════════════════════════════
//  Notification Server (from backend)
// ═══════════════════════════════════════

const notifyServer = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/notify') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { message } = JSON.parse(body);
        if (!message) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: 'No message' }));
        }

        if (AUTHORIZED_IDS.length > 0) {
          // Send to ALL registered admin chat IDs
          let sent = 0;
          for (const chatId of AUTHORIZED_IDS) {
            try {
              await bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
              sent++;
            } catch (e) {
              console.error(`[Notify] Failed to send to ${chatId}:`, e.message);
            }
          }
          console.log(`[Notify] Sent to ${sent}/${AUTHORIZED_IDS.length} admins`);
        } else {
          // No admins registered yet — log to console
          console.log('[Notify] No admin IDs registered yet! Message:', message.replace(/<[^>]+>/g, ''));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, delivered: AUTHORIZED_IDS.length }));
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
  console.error(`[Admin Bot Error] ${ctx.updateType}:`, err.message || err);
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
    const me = await bot.telegram.getMe();
    console.log(`  ✅ Admin Bot: @${me.username} (${me.first_name})`);

    bot.launch({ dropPendingUpdates: true });
    console.log('');
    console.log('══════════════════════════════════════════');
    console.log('  🛡  Tradyx ADMIN Bot STARTED');
    console.log('══════════════════════════════════════════');
    console.log(`  API: ${API_URL}`);
    console.log(`  Admin: ${ADMIN_EMAIL}`);
    console.log(`  Registered admin IDs: ${AUTHORIZED_IDS.length > 0 ? AUTHORIZED_IDS.join(', ') : 'NONE — send /start to register'}`);
    console.log(`  Notify: http://localhost:${NOTIFY_PORT}/notify`);
    console.log('══════════════════════════════════════════');
    console.log('');
  } catch (e) {
    console.error(`  ❌ Connection failed: ${e.message}`);
    console.error('  Retrying in 5s...');
    setTimeout(() => startBot(), 5000);
  }
}

notifyServer.listen(NOTIFY_PORT, () => {
  console.log(`  📡 Admin notify server on port ${NOTIFY_PORT}`);
  startBot();
});

process.once('SIGINT', () => { try { bot.stop('SIGINT'); } catch {} process.exit(0); });
process.once('SIGTERM', () => { try { bot.stop('SIGTERM'); } catch {} process.exit(0); });
