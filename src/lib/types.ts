export type PublicTag = {
  code: string;
  full_name: string;
  role_title: string;
  place: string;
  amount_cents: number;
  fee_bps: number;
  demo_mode: boolean;
};

export type Worker = {
  id: string;
  full_name: string;
  role_title: string;
  place: string;
  amount_cents: number;
  balance_cents: number;
  stripe_account_id: string | null;
};

export type Tag = { code: string; label: string; active: boolean; created_at: string };

export type Tip = {
  id: string;
  tag_code: string | null;
  amount_cents: number;
  fee_cents: number;
  fee_covered: boolean;
  net_cents: number;
  status: "pending" | "paid" | "failed";
  method: string;
  rating: number | null;
  created_at: string;
};

export type Withdrawal = {
  id: string;
  method: "spei" | "instant" | "mercadopago" | "oxxo";
  amount_cents: number;
  fee_cents: number;
  status: string;
  created_at: string;
};
