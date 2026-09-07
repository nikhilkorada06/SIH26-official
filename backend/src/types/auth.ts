export type UserRole =
  | 'admin'
  | 'department_officer'
  | 'citizen';

export interface AuthUser {
  id: string;
  role: UserRole;
}
