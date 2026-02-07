import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('tradyx_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('tradyx_token');
      localStorage.removeItem('tradyx_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },
  register: async (username: string, email: string, password: string, referrerCode?: string) => {
    const { data } = await api.post('/auth/register', { username, email, password, referrerCode });
    return data;
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
  getTransactions: async (skip = 0, take = 20) => {
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
  withdraw: async (amount: number, walletAddress?: string) => {
    const { data } = await api.post('/user/me/withdraw', { amount, walletAddress });
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
};

export const adminApi = {
  getStats: async () => { const { data } = await api.get('/admin/stats'); return data; },
  getUsers: async () => { const { data } = await api.get('/admin/all-users'); return data; },
  getUserDetails: async (userId: string) => { const { data } = await api.get(`/admin/users/${userId}/full-details`); return data; },
  adjustBalance: async (userId: string, amount: number, reason: string) => {
    const { data } = await api.post(`/admin/users/${userId}/adjust-balance`, { amount, reason });
    return data;
  },
  triggerPayouts: async () => { const { data } = await api.post('/admin/payouts/trigger'); return data; },
  getInvestments: async (limit = 20) => { const { data } = await api.get(`/admin/investments?limit=${limit}`); return data; },
};

// Types
export interface User { id: string; username: string; email: string; balance: number; }
export interface Dashboard { balance: number; activeInvestmentsAmount: number; totalEarned: number; todayProfit: number; todayReferralBonus: number; referralsCount: number; nextPayoutAt: string | null; }
export interface Transaction { id: string; amount: number; type: string; description: string; createdAt: string; }
export interface Investment { id: string; amount: number; dailyRate: number; createdAt: string; nextPayoutAt: string; isActive: boolean; }
export interface Notification { id: string; message: string; isRead: boolean; createdAt: string; }
export interface AdminStats { totalUsers: number; totalInvested: number; totalProfitPaid: number; totalReferralPaid: number; systemReserve: number; activeInvestmentsCount: number; generatedAt: string; }
export interface AdminUser { id: string; username: string; email: string; balance: number; investmentsCount: number; totalInvested: number; totalEarned: number; referralsCount: number; createdAt: string; }
export interface UserFullDetails {
  profile: { id: string; username: string; email: string; balance: number; referrerId: string | null; referrerUsername: string | null; createdAt: string; };
  transactions: Transaction[];
  investments: Investment[];
  notifications: Notification[];
  referrals: { totalReferrals: number; referrals: Array<{ id: string; username: string; joinedAt: string }> };
}
