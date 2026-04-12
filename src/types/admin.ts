// ── Tenant ───────────────────────────────────────────────────────────────────

export interface Couple {
  id: string;
  slug: string;               // 'alvin-lari'
  name_partner_1: string;
  name_partner_2: string;
  wedding_date: string;       // 'YYYY-MM-DD'
  wedding_location: string | null;
  pix_key: string | null;
  active: boolean;
  created_at: string;
}

// ── RSVP ────────────────────────────────────────────────────────────────────

export interface RsvpResponse {
  id: string;
  couple_id: string;          // tenant key — nunca exposto no frontend
  name: string;
  attendance: boolean;
  message: string | null;
  created_at: string;
}

// ── Presentes ────────────────────────────────────────────────────────────────

export interface GiftItem {
  id: string;
  couple_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  suggested_amount: number | null;
  tag: string | null;
  tag_color: string | null;
  display_order: number;
  active: boolean;
}

export interface GiftContribution {
  id: string;
  couple_id: string;
  gift_item_id: string | null;
  gift_title: string;
  amount: number;
  contributor: string | null;
  created_at: string;
}

export interface GiftSummary {
  couple_id: string;
  gift_item_id: string | null;
  gift_title: string;
  contribution_count: number;
  total_amount: number;
  avg_amount: number;
}

// ── Rifa (admin) ─────────────────────────────────────────────────────────────

export interface RifaConfig {
  ticket_price:       number;
  total_tickets:      number;
  draw_threshold_pct: number;
}

export interface RifaPrize {
  id:            string;
  title:         string;
  description:   string;
  display_order: number;
}

export interface RifaTicketDetail {
  id:             string;
  ticket_number:  number;
  buyer_name:     string | null;
  buyer_email:    string;
  buyer_phone:    string | null;
  payment_status: 'approved' | 'pending';
  amount:         number;
  created_at:     string;
}

export interface AdminRifaData {
  config:  RifaConfig;
  prizes:  RifaPrize[];
  tickets: {
    sold:    RifaTicketDetail[];
    pending: RifaTicketDetail[];
    stats:   { sold: number; pending: number; available: number };
  };
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  couple_id: string;
  total_rsvp: number;
  confirmed: number;
  declined: number;
  total_gift_amount: number;
  total_contributions: number;
}
