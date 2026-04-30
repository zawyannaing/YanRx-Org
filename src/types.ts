export interface Variant {
  id: string;
  label: string; // e.g. "1 Month"
  price: number;
  currency: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  image_url: string;
  category?: string;
  variants: Variant[];
}

export interface UserInfo {
  name: string;
  username?: string;
  email?: string;
  telegram_id?: number | string;
}

export interface Order {
  id?: string;
  product_id: string;
  variant_id: string;
  user_info: UserInfo;
  payment_method?: string;
  transaction_id?: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_at?: string;
}
