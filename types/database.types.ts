// types/database.types.ts
// Hand-written types matching the Supabase schema. Once your project is
// running, regenerate these with:
//   npx supabase gen types typescript --project-id <your-project-id> > types/database.types.ts

export type UserRole = 'client' | 'technician' | 'reseller' | 'wholesaler' | 'admin';
export type RequestStatus = 'pending' | 'assigned' | 'in_progress' | 'resolved' | 'cancelled';
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  city: string | null;
  is_active: boolean;
  verification_status: VerificationStatus;
  verification_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestLocation {
  latitude?: number;
  longitude?: number;
  address: string;
}

export interface ServiceRequest {
  id: string;
  client_id: string;
  technician_id: string | null;
  reseller_id: string | null;
  issue_type: string;
  description: string | null;
  status: RequestStatus;
  location_data: RequestLocation | null;
  quoted_price: number | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  photo_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  price: number;
  wholesale_price: number | null;
  stock_level: number;
  min_order_qty: number;
  category: string | null;
  image_url: string | null;
  last_sold_at: string | null;
  is_dead_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  buyer_id: string;
  seller_id: string;
  total_amount: number;
  platform_fee: number;
  seller_payout: number | null;
  status: OrderStatus;
  payment_method: string | null;
  payment_reference: string | null;
  shipping_address: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface JobCard {
  id: string;
  service_request_id: string;
  technician_id: string;
  notes: string | null;
  parts_used: Array<{ name: string; quantity: number; cost: number }> | null;
  labor_cost: number;
  parts_cost: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  service_request_id: string;
  client_id: string;
  technician_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export type MessageSubjectType = 'service_request' | 'order';

export interface Message {
  id: string;
  subject_type: MessageSubjectType;
  subject_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export type TicketStatus = 'open' | 'resolved';

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
}

export interface ServiceCategory {
  id: string;
  label: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// Minimal shape expected by Supabase's generated Database type.
// Expand this if/when you swap in the CLI-generated version.
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile>; Relationships: [] };
      service_requests: {
        Row: ServiceRequest;
        Insert: Partial<ServiceRequest>;
        Update: Partial<ServiceRequest>;
        Relationships: [];
      };
      products: { Row: Product; Insert: Partial<Product>; Update: Partial<Product>; Relationships: [] };
      orders: { Row: Order; Insert: Partial<Order>; Update: Partial<Order>; Relationships: [] };
      order_items: { Row: OrderItem; Insert: Partial<OrderItem>; Update: Partial<OrderItem>; Relationships: [] };
      job_cards: { Row: JobCard; Insert: Partial<JobCard>; Update: Partial<JobCard>; Relationships: [] };
      reviews: { Row: Review; Insert: Partial<Review>; Update: Partial<Review>; Relationships: [] };
      messages: { Row: Message; Insert: Partial<Message>; Update: Partial<Message>; Relationships: [] };
      support_tickets: {
        Row: SupportTicket;
        Insert: Partial<SupportTicket>;
        Update: Partial<SupportTicket>;
        Relationships: [];
      };
      service_categories: {
        Row: ServiceCategory;
        Insert: Partial<ServiceCategory>;
        Update: Partial<ServiceCategory>;
        Relationships: [];
      };
    };
  };
}
