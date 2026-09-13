export type Role = 'admin' | 'member';
export type ReservationStatus = 'pending' | 'approved' | 'rejected';

export type Profile = {
  id: string;
  full_name: string;
  first_name?: string | null;
  family?: string | null;
  role: Role;
  created_at: string;
};

export type Reservation = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  reservation_type?: string;
  guests: number;
  comment: string | null;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
  user_full_name?: string;
  user_first_name?: string;
  user_family?: string;
};

export type FamilyPeriod = {
  id: string;
  year: number;
  family: string;
  label: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
};

export type PlanningImport = {
  id: string;
  year: number;
  file_name: string;
  image_url?: string | null;
  status: 'draft' | 'validated';
  extracted_periods: unknown[];
  created_by: string;
  created_at: string;
};

export type FamilySetting = {
  family: string;
  label: string;
  bg_color: string;
  border_color: string;
  text_color: string;
  updated_at: string;
};

export type InfoItem = {
  id: string;
  title: string;
  text: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
