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

// ── Convites ─────────────────────────────────────────────────────────────────

export interface InviteToken {
  id:         string;
  token:      string;
  guest_name: string;
  guests:     string[];
  whatsapp:   string | null;
  email:      string | null;
  sent:       boolean;
  sent_at:    string | null;
  used:       boolean;
  used_at:    string | null;
  created_at: string;
  invite_url: string;
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
  payment_method: string | null;
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
  payment_method: 'pix' | 'credit_card' | null;
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

// ── Editor de Site (admin) ────────────────────────────────────────────────────

export interface SiteEditorCouple {
  display_name:     string;
  home_name:        string;
  partner1:         string;
  partner2:         string;
  wedding_date:     string;   // 'YYYY-MM-DD'
  wedding_time:     string;   // 'HH:MM'
  wedding_location: string;
  pix_key:          string;
}

export interface SiteEditorContent {
  intro_title:    string;
  intro_subtitle: string;
}

export interface SiteEditorRoom {
  title:     string;
  desc:      string;
  nextText?: string;
}

export interface AdminGiftItem {
  id:               string;
  slug:             string;
  title:            string;
  subtitle:         string;
  description:      string;
  suggested_amount: number | null;
  tag:              string;
  tag_color:        string;
  emoji_name:       string;
  display_order:    number;
  active:           boolean;
}

export interface AdminSiteData {
  couple:  SiteEditorCouple;
  content: SiteEditorContent;
  rooms:   Record<string, SiteEditorRoom>;
  gifts:   AdminGiftItem[];
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
