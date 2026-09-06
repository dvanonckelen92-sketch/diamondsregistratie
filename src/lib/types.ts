export type Rol = 'juf' | 'admin';

export type HourEntryStatus = 'concept' | 'ingediend' | 'goedgekeurd' | 'betaald';

export type ExtraPaymentStatus = 'goedgekeurd' | 'betaald';

export interface Profile {
  id: string;
  naam: string;
  email: string;
  rol: Rol;
  created_at: string;
}

export interface Category {
  id: string;
  naam: string;
  created_at: string;
}

export interface Rate {
  id: string;
  profile_id: string;
  category_id: string;
  uurloon: number;
  geldig_vanaf: string;
  created_at: string;
}

export interface HourEntry {
  id: string;
  profile_id: string;
  category_id: string;
  datum: string;
  aantal_uren: number;
  opmerking: string | null;
  status: HourEntryStatus;
  created_at: string;
  updated_at: string;
}

export interface HourEntryWithAmount extends HourEntry {
  uurloon: number;
  bedrag: number;
}

export interface ExtraPayment {
  id: string;
  profile_id: string;
  bedrag: number;
  omschrijving: string;
  datum: string;
  status: ExtraPaymentStatus;
  created_at: string;
}
