export type Role = 'admin' | 'member';
export type ReservationStatus = 'pending' | 'approved' | 'rejected';

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
  created_at: string;
};

export type Reservation = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  guests: number;
  comment: string | null;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
  user_full_name?: string;
};
