import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000, // 15s timeout
});

// === Inject token ===
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('tradyx_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// === Global error interceptor ===
// Dispatches custom events so ToastProvider can catch them
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('tradyx_token');
      localStorage.removeItem('tradyx_user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Extract error message from backend
    const message =
      error.response?.data?.message ||
      error.response?.data?.Message ||
      (error.code === 'ECONNABORTED' ? 'Request timed out' : null) ||
      (error.message === 'Network Error' ? 'Server is unavailable' : null) ||
      'Something went wrong';

    // Dispatch global toast error event (picked up by ToastProvider)
    window.dispatchEvent(new CustomEvent('api-error', { detail: message }));

    return Promise.reject(error);
  }
);

// === Helper to extract error message from axios errors ===
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.response?.data?.Message || error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },
  register: async (username: string, email: string, password: string, referrerCode?: string) => {
    const { data } = await api.post('/auth/register', { username, email, password, referrerCode });
    return data;
  },
  telegramInit: async (refCode?: string) => {
    const { data } = await api.post(`/auth/telegram/init${refCode ? `?ref_code=${refCode}` : ''}`);
    return data as { token: string; botUrl: string };
  },
  telegramCheck: async (token: string) => {
    const { data } = await api.get(`/auth/telegram/check?token=${token}`);
    return data as { confirmed: boolean; jwtToken?: string; user?: User };
  },
};

export const userApi = {
  getDashboard: async () => {
    const { data } = await api.get('/user/me/dashboard');
    return data;
  },
  getProfile: async () => {
    const { data } = await api.get('/user/me');
    return data;
  },
  getTransactions: async (skip = 0, take = 50) => {
    const { data } = await api.get(`/user/me/transactions?skip=${skip}&take=${take}`);
    return data;
  },
  getNotifications: async () => {
    const { data } = await api.get('/user/me/notifications');
    return data;
  },
  markNotificationRead: async (id: string) => {
    const { data } = await api.patch(`/user/me/notifications/${id}/read`);
    return data;
  },
  markAllNotificationsRead: async () => {
    const { data } = await api.patch('/user/me/notifications/read-all');
    return data;
  },
  deposit: async (amount: number) => {
    const { data } = await api.post('/user/me/deposit', { amount });
    return data;
  },
  withdraw: async (amount: number, isInstant: boolean, walletAddress?: string) => {
    const { data } = await api.post('/user/me/withdraw', { amount, isInstant, walletAddress });
    return data;
  },
  getWithdrawalInfo: async () => {
    const { data } = await api.get('/user/me/withdrawal-info');
    return data as WithdrawalInfo;
  },
  getMyTeam: async () => {
    const { data } = await api.get('/user/me/team');
    return data;
  },
};

export const investmentApi = {
  purchase: async (amount: number) => {
    const { data } = await api.post('/investment/purchase', { amount });
    return data;
  },
  getMyInvestments: async () => {
    const { data } = await api.get('/investment/my');
    return data;
  },
  getPlans: async () => {
    const { data } = await api.get('/investment/plans');
    return data as InvestmentPlanPublic[];
  },
};

export const adminApi = {
  getStats: async () => { const { data } = await api.get('/admin/stats'); return data as AdminStats; },
  getUsers: async () => { const { data } = await api.get('/admin/all-users'); return data as AdminUser[]; },
  getUserDetails: async (userId: string) => { const { data } = await api.get(`/admin/users/${userId}/full-details`); return data as UserFullDetails; },
  adjustBalance: async (userId: string, amount: number, reason: string) => {
    const { data } = await api.post(`/admin/users/${userId}/adjust-balance`, { amount, reason });
    return data;
  },
  triggerPayouts: async () => { const { data } = await api.post('/admin/payouts/trigger'); return data; },
  getInvestments: async (limit = 20) => { const { data } = await api.get(`/admin/investments?limit=${limit}`); return data; },
  getPendingWithdrawals: async () => { const { data } = await api.get('/admin/withdrawals/pending'); return data as PendingWithdrawal[]; },
  approveWithdrawal: async (txId: string) => { const { data } = await api.post(`/admin/withdrawals/${txId}/approve`); return data; },
  rejectWithdrawal: async (txId: string, reason?: string) => { const { data } = await api.post(`/admin/withdrawals/${txId}/reject`, { reason }); return data; },
  // Plans CRUD
  getPlans: async () => { const { data } = await api.get('/admin/plans'); return data as AdminInvestmentPlan[]; },
  getPlan: async (planId: string) => { const { data } = await api.get(`/admin/plans/${planId}`); return data as AdminInvestmentPlan; },
  createPlan: async (plan: CreatePlanPayload) => { const { data } = await api.post('/admin/plans', plan); return data; },
  updatePlan: async (planId: string, plan: UpdatePlanPayload) => { const { data } = await api.put(`/admin/plans/${planId}`, plan); return data; },
  deletePlan: async (planId: string) => { const { data } = await api.delete(`/admin/plans/${planId}`); return data; },
  // Analytics
  getAnalytics: async (days = 14) => { const { data } = await api.get(`/admin/analytics?days=${days}`); return data as AdminAnalytics; },
};

// Types
export interface User { id: string; username: string; email: string; balance: number; inviteCode?: string; }
export interface RankProgress {
  currentRank: number;
  currentRankName: string;
  nextRank: number | null;
  nextRankName: string | null;
  personalTurnover: number;
  teamTurnover: number;
  personalNeeded: number | null;
  teamNeeded: number | null;
  progress: number | null;
  cashbackRate: number;
}

export interface Dashboard {
  balance: number;
  inviteCode: string;
  activeInvestmentsAmount: number;
  totalEarned: number;
  todayProfit: number;
  todayReferralBonus: number;
  totalReferralEarned: number;
  referralsCount: number;
  nextPayoutAt: string | null;
  rankProgress: RankProgress | null;
}
export interface Transaction { id: string; amount: number; type: string; description: string; status: string; feeAmount: number; isInstant: boolean; createdAt: string; }
export interface WithdrawalInfo { feeRate: number; maxInstant: number; minAmount: number; feeDiscount: number; }
export interface PendingWithdrawal { id: string; userId: string; username: string; email: string; amount: number; feeAmount: number; isInstant: boolean; walletAddress: string | null; createdAt: string; }
export interface Investment { id: string; amount: number; dailyRate: number; createdAt: string; nextPayoutAt: string; isActive: boolean; remainingPayouts: number; }
export interface Notification { id: string; message: string; isRead: boolean; createdAt: string; }
export interface AdminStats { totalUsers: number; totalInvested: number; totalProfitPaid: number; totalReferralPaid: number; systemReserve: number; activeInvestmentsCount: number; generatedAt: string; }
export interface AdminUser { id: string; username: string; email: string; balance: number; investmentsCount: number; totalInvested: number; totalEarned: number; referralsCount: number; createdAt: string; }
export interface UserFullDetails {
  profile: { id: string; username: string; email: string; balance: number; inviteCode: string; referrerId: string | null; referrerUsername: string | null; createdAt: string; };
  transactions: Transaction[];
  investments: Investment[];
  notifications: Notification[];
  referrals: { totalReferrals: number; referrals: Array<{ id: string; username: string; joinedAt: string }> };
}

// Referral team types
export interface ReferralMember { id: string; username: string; joinedAt: string; level: number; totalEarned: number; }
export interface ReferralTeamStats { totalMembers: number; level1Count: number; level2Count: number; level3Count: number; totalEarned: number; todayEarned: number; }
export interface ReferralTeam { level1: ReferralMember[]; level2: ReferralMember[]; level3: ReferralMember[]; stats: ReferralTeamStats; }

// Investment plans (public)
export interface InvestmentPlanPublic {
  id: string; name: string; minAmount: number; maxAmount: number;
  dailyRate: number; durationDays: number; description: string; color: string;
}

// Admin: Investment Plans
export interface AdminInvestmentPlan {
  id: string; name: string; minAmount: number; maxAmount: number;
  dailyRate: number; durationDays: number; isActive: boolean; sortOrder: number;
  description: string; color: string; createdAt: string; updatedAt: string;
  activeInvestments: number; totalInvested: number;
}
export interface CreatePlanPayload { name: string; minAmount: number; maxAmount: number; dailyRate: number; durationDays: number; description: string; color: string; }
export interface UpdatePlanPayload { name?: string; minAmount?: number; maxAmount?: number; dailyRate?: number; durationDays?: number; isActive?: boolean; description?: string; color?: string; }

// Admin: Analytics
export interface AdminAnalytics {
  dailyStats: DailyStatPoint[];
  planDistribution: PlanDistributionItem[];
  financial: FinancialSummary;
  userGrowth: UserGrowthData;
}
export interface DailyStatPoint { date: string; deposits: number; withdrawals: number; profitPaid: number; referralPaid: number; newUsers: number; newInvestments: number; }
export interface PlanDistributionItem { name: string; color: string; count: number; totalAmount: number; }
export interface FinancialSummary { totalDeposits: number; totalWithdrawals: number; totalProfitPaid: number; totalReferralPaid: number; platformRevenue: number; pendingWithdrawals: number; activeInvestmentsTotal: number; }
export interface UserGrowthData { totalUsers: number; activeUsers7d: number; newUsersToday: number; newUsersWeek: number; rankDistribution: Record<string, number>; }
