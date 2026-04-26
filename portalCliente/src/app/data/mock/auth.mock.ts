import type { ClientUser, AuthSession } from '../../types/auth.types';

export const mockUser: ClientUser = {
  id: '3b6cde6d-e5e1-4ec5-97ad-6990a9d11ab0',
  name: 'Jonathan',
  email: 'jonathan@ejemplo.com',
  phone: '+52 33 1234 5678',
  avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Jonathan',
  role: 'client'
};

export const mockAuthSession: AuthSession = {
  isAuthenticated: true,
  user: mockUser
};

export const mockGuestSession: AuthSession = {
  isAuthenticated: false,
  user: null
};