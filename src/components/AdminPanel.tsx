import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Product } from '../types';
import { ProductForm } from './ProductForm';
import { Plus, Edit2, Trash2, LogOut, Package, RefreshCw, AlertCircle, LayoutGrid, Image as ImageIcon, ClipboardList, Bot, CheckCircle2, XCircle, Clock, Shield, Search, Eye } from 'lucide-react';
import axios from 'axios';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

interface Order {
  id: string;
  product_title: string;
  variant_label: string;
  price: string;
  user_name: string;
  user_username: string;
  payment_method: string;
  transaction_id: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
}

interface AdminPanelProps {
  onClose: () => void;
  onProductsUpdated?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, onProductsUpdated }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'setup'>('products');
  const [isLoading, setIsLoading] = useState(true);
  const [botStatus, setBotStatus] = useState<{ loading: boolean; message: string | null; error: string | null }>({ loading: false, message: null, error: null });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check session storage for existing login
    const savedLogin = sessionStorage.getItem('admin_logged_in');
    if (savedLogin === 'true') {
      setIsLoggedIn(true);
      fetchData();
    }
  }, []);

  const [testStatus, setTestStatus] = useState<{ loading: boolean; error: string | null; success: boolean }>({ loading: false, error: null, success: false });

  const fetchData = async () => {
    setIsLoading(true);
    // Fetch products first so we can map names/labels in orders
    const fetchedProducts = await fetchProducts();
    await fetchOrders(fetchedProducts || []);
    setIsLoading(false);
  };

  const fetchOrders = async (currentProducts: Product[]) => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Map raw order data to the UI format
      const mappedOrders = (data || []).map(order => {
        const product = currentProducts.find(p => p.id === order.product_id);
        const variant = product?.variants.find(v => v.id === order.variant_id);
        const userInfo = order.user_info || {};

        return {
          id: order.id,
          product_title: product?.title || 'Unknown Product',
          variant_label: variant?.label || 'Unknown Plan',
          price: variant ? `${variant.price} ${variant.currency || 'USD'}` : 'N/A',
          user_name: userInfo.name || 'Anonymous',
          user_username: userInfo.username || '',
          payment_method: order.payment_method || order.paymentMethod || 'N/A',
          transaction_id: order.transaction_id || order.transactionId || 'N/A',
          status: order.status || 'pending',
          created_at: order.created_at
        };
      });

      setOrders(mappedOrders);
    } catch (err: any) {
      console.error('Fetch orders error:', err);
    }
  };

  const handleTestBot = async () => {
    setTestStatus({ loading: true, error: null, success: false });
    try {
      await axios.post('/api/notify-order', {
        order: { title: 'Test Product' },
        selectedVariant: { label: 'Test Plan', price: '0', currency: 'USD' },
        userInfo: { name: 'Admin Test', username: 'admin' },
        orderId: 'test-123',
        telegramId: null
      });
      setTestStatus({ loading: false, error: null, success: true });
      setTimeout(() => setTestStatus(s => ({ ...s, success: false })), 3000);
    } catch (err: any) {
      setTestStatus({ 
        loading: false, 
        error: err.response?.data?.error || err.message, 
        success: false 
      });
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ADMIN_EMAIL) {
      setError('Admin email not configured in Settings (VITE_ADMIN_EMAIL)');
      return;
    }
    if (emailInput.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      setIsLoggedIn(true);
      sessionStorage.setItem('admin_logged_in', 'true');
      fetchProducts();
    } else {
      setError('Invalid admin email');
    }
  };

  const handleSetupBot = async () => {
    setBotStatus({ loading: true, message: null, error: null });
    try {
      const response = await axios.get('/api/setup-telegram');
      if (response.data.success) {
        setBotStatus({ 
          loading: false, 
          message: response.data.message || 'Bot linked successfully! Buttons are now active.', 
          error: null 
        });
      } else {
        throw new Error(response.data.error?.description || 'Failed to setup bot');
      }
    } catch (err: any) {
      setBotStatus({ 
        loading: false, 
        message: null, 
        error: err.response?.data?.error?.description || err.message || 'Setup failed' 
      });
    }
  };

  const updateOrderStatus = async (orderId: string, status: 'completed' | 'cancelled') => {
    setIsLoading(true);
    try {
      const response = await axios.post('/api/update-order-status', {
        orderId,
        status
      });
      
      if (!response.data.success) throw new Error(response.data.error || 'Server error');
      
      await fetchData();
      alert(`Order ${status} successfully! ${status === 'completed' ? 'Confirmation message sent to customer.' : ''}`);
    } catch (err: any) {
      alert('Error updating order: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this order record?')) return;
    
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      await fetchData();
      alert('Order record deleted.');
    } catch (err: any) {
      alert('Error deleting order: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };
  const fetchProducts = async (): Promise<Product[] | undefined> => {
    setError(null);
    try {
      if (!supabase) {
        return undefined;
      }

      console.log('Admin: Fetching products...');
      const { data, error, status } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch error:', error);
        if (status === 404 || error.message.includes('not found') || error.message.includes('does not exist')) {
          throw new Error('Database table "products" is missing. Please go to Setup and run the SQL query.');
        }
        throw error;
      }
      
      setProducts(data || []);
      return data || [];
    } catch (err: any) {
      console.error('Fetch operation failed:', err);
      if (err.status === 401 || err.code === '401' || (err.message && err.message.includes('401'))) {
        setError('Unauthorized (401). Your Supabase API Key is invalid. Please check VITE_SUPABASE_ANON_KEY in Settings.');
      } else {
        setError(err.message);
      }
      return undefined;
    }
  };

  const handleCreateOrUpdateProduct = async (productData: Omit<Product, 'id'> & { id?: string }) => {
    try {
      if (!supabase) {
        throw new Error('Supabase client not initialized. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Settings.');
      }

      // 1. Separate ID from the rest of the data
      const { id, created_at, ...cleanData } = productData as any;

      // 2. Validate data
      if (!cleanData.title) throw new Error('Product title is required');
      if (!cleanData.variants || cleanData.variants.length === 0) {
        throw new Error('At least one price variant is required');
      }

      console.log(`Admin: ${id ? 'Updating' : 'Inserting'} product...`, cleanData);

      if (id) {
        // UPDATE existing product
        const { error, status, statusText } = await supabase
          .from('products')
          .update(cleanData)
          .eq('id', id)
          .select();
        
        if (error) {
          console.error('Supabase Update Error:', error);
          throw new Error(`Update failed (${status}): ${error.message || statusText}. Please ensure the "products" table exists with correct RLS policies.`);
        }
        console.log('Update Success:', status);
      } else {
        // INSERT new product
        const { error, status, statusText } = await supabase
          .from('products')
          .insert([cleanData])
          .select();
        
        if (error) {
          console.error('Supabase Insert Error:', error);
          throw new Error(`Insert failed (${status}): ${error.message || statusText}. Please ensure the "products" table exists with correct RLS policies.`);
        }
        console.log('Insert Success:', status);
      }
      
      setIsAddingProduct(false);
      setEditingProduct(null);
      
      // Refresh products list
      const updatedProducts = await fetchProducts();
      if (onProductsUpdated) onProductsUpdated(); // Notify parent App
      
      if (updatedProducts) {
        alert('Product saved successfully!');
      } else {
        alert('Product was saved to database, but could not be refreshed in UI. Try refreshing the page.');
      }
    } catch (err: any) {
      console.error('Operation Error:', err);
      alert(err.message || 'An unexpected error occurred while saving.');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;
    
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      
      console.log('Sending Delete Request for ID:', id);
      const { error, status } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Supabase Delete Error:', error);
        throw error;
      }

      // Supabase return status 204 or 200 on success. 
      // If RLS blocks it without "error" (sometimes happens with DELETE), we check if still exists
      console.log('Delete status:', status);
      
      await fetchProducts();
      alert('Product deleted successfully.');
    } catch (err: any) {
      console.error('Delete Error Detail:', err);
      let msg = err.message || 'Could not delete product.';
      
      if (err.code === '42501' || msg.includes('permission denied')) {
        msg = 'Permission Denied! Please go to the "Setup" tab and run the SQL query to enable delete permissions for products.';
      } else if (msg.includes('foreign key constraint')) {
        msg = 'Could not delete product because it has associated orders in the orders table. Please delete the orders first.';
      }
      
      alert(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="fixed inset-0 bg-white z-[60] flex items-center justify-center p-6 animate-in slide-in-from-bottom duration-300">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="mx-auto w-20 h-20 bg-brand/10 rounded-3xl flex items-center justify-center">
            <LayoutGrid className="w-10 h-10 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Login</h1>
            <p className="text-gray-500 mt-2">Sign in to manage your products</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-semibold text-gray-700 ml-1 mb-1">Email Address</label>
              <input
                required
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-4 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-brand outline-none transition-all placeholder:text-gray-300"
              />
            </div>
                  {error && (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Error</p>
                          <p>{error}</p>
                        </div>
                      </div>

                      {/* URL/Key Mismatch Check */}
                      {(() => {
                        const url = import.meta.env.VITE_SUPABASE_URL;
                        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
                        if (url && key && url.includes('supabase.co') && key.split('.').length === 3) {
                          try {
                            const urlRef = url.match(/https:\/\/(.*?)\.supabase\.co/)?.[1];
                            const keyPayload = JSON.parse(atob(key.split('.')[1]));
                            const keyRef = keyPayload.ref;
                            
                            if (urlRef && keyRef && urlRef !== keyRef) {
                              return (
                                <div className="p-3 bg-orange-50 text-orange-700 rounded-xl text-[11px] border border-orange-200">
                                  <p className="font-bold mb-1">🚨 Configuration Mismatch!</p>
                                  <p>Your URL refers to project <code className="font-bold">"{urlRef}"</code> but your Key is for <code className="font-bold">"{keyRef}"</code>.</p>
                                  <p className="mt-1 font-medium italic">Please update the URL to match the project the key belongs to.</p>
                                </div>
                              );
                            }
                          } catch (e) { /* Ignore parsing errors */ }
                        }
                        return null;
                      })()}

                      {error.includes('401') && (
                  <div className="space-y-2">
                    <div className="p-3 bg-blue-50 text-blue-700 rounded-xl text-[11px] border border-blue-100">
                      <p className="font-bold mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                        1. Fix Connection (401)
                      </p>
                      <p className="mb-2">Your API key doesn't match your URL. In Supabase Dashboard:</p>
                      <ul className="list-disc ml-4 space-y-1">
                        <li>Go to <strong>Project Settings</strong> → <strong>API</strong></li>
                        <li>Copy <strong>Project URL</strong> manually (ensure no trailing /)</li>
                        <li>Copy <strong>anon public</strong> key (NOT service_role)</li>
                        <li>Update them in AI Studio <strong>Settings</strong></li>
                      </ul>
                    </div>

                    <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl text-[11px] border border-indigo-100">
                      <p className="font-bold mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        2. Setup Database Schema
                      </p>
                      <p className="mb-2">Run this in your <strong>SQL Editor</strong> to ensure tables exist and access is granted:</p>
                      <pre className="bg-indigo-900/10 p-2 rounded mt-1 font-mono text-[9px] overflow-x-auto">
{`CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure category column exists
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read" ON products FOR SELECT USING (true);
CREATE POLICY "Public Manage" ON products FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,
  user_info JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Read" ON orders FOR SELECT USING (true);
CREATE POLICY "Admin Update" ON orders FOR UPDATE USING (true);`}
                      </pre>
                    </div>
                  </div>
                )}
                {/* Debug Indicators */}
                <div className="grid grid-cols-2 gap-2 p-2 bg-gray-50 rounded-lg text-[10px] uppercase font-bold text-gray-500">
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${import.meta.env.VITE_SUPABASE_URL ? 'bg-green-500' : 'bg-red-500'}`} />
                    URL
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${import.meta.env.VITE_SUPABASE_ANON_KEY ? 'bg-green-500' : 'bg-red-500'}`} />
                    KEY
                  </div>
                </div>
              </div>
            )}
            <button
              type="submit"
              className="w-full py-4 text-[16px] font-bold text-white bg-brand rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-brand/20"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-sm text-gray-400 font-medium hover:text-gray-600 transition-colors"
            >
              Back to Store
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#F2F2F7] z-[60] flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Admin Console</h1>
            <p className="text-xs text-gray-500 font-medium">Logged in as {ADMIN_EMAIL}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              sessionStorage.removeItem('admin_logged_in');
              setIsLoggedIn(false);
            }}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut className="w-6 h-6" />
          </button>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Tabs and Bot Config */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex bg-white p-1.5 rounded-2xl border border-gray-200 w-fit">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActiveTab('products')}
              onKeyDown={(e) => e.key === 'Enter' && setActiveTab('products')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'products' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="w-5 h-5" />
              Products
              {activeTab === 'products' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); fetchProducts(); }}
                  className="ml-2 p-1 hover:bg-white/20 rounded-lg"
                  title="Refresh List"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActiveTab('orders')}
              onKeyDown={(e) => e.key === 'Enter' && setActiveTab('orders')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'orders' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <ClipboardList className="w-5 h-5" />
              Orders
              {orders.filter(o => o.status === 'pending').length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                  {orders.filter(o => o.status === 'pending').length}
                </span>
              )}
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActiveTab('setup')}
              onKeyDown={(e) => e.key === 'Enter' && setActiveTab('setup')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'setup' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Shield className="w-5 h-5" />
              Setup
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTestBot}
              disabled={testStatus.loading}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold transition-all ${
                testStatus.error ? 'bg-red-50 text-red-600 border border-red-100' : 
                testStatus.success ? 'bg-green-50 text-green-600 border border-green-100' :
                'bg-white text-brand border border-brand/20 hover:bg-brand/5'
              }`}
            >
              {testStatus.loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : testStatus.success ? <CheckCircle2 className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              {testStatus.error ? 'Test Failed' : testStatus.success ? 'Test Sent!' : 'Test Telegram Notify'}
            </button>

            <button
              onClick={handleSetupBot}
              disabled={botStatus.loading}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold transition-all ${
                botStatus.error ? 'bg-red-50 text-red-600 border border-red-100' : 
                botStatus.message ? 'bg-green-50 text-green-600 border border-green-100' :
                'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {botStatus.loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              {botStatus.error ? 'Bot Setup Failed' : botStatus.message ? 'Bot Active' : 'Setup Bot Webhook'}
            </button>
            
            {activeTab === 'products' && (
              <button
                onClick={() => setIsAddingProduct(true)}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-brand text-white font-bold rounded-2xl hover:bg-brand/90 active:scale-[0.98] transition-all shadow-lg shadow-brand/20"
              >
                <Plus className="w-5 h-5" />
                Add Product
              </button>
            )}
          </div>
        </div>

        {botStatus.message && (
          <div className="bg-green-50 border border-green-100 text-green-700 p-4 rounded-2xl text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Setup Success</p>
              <p className="opacity-90">{botStatus.message}</p>
            </div>
          </div>
        )}

        {botStatus.error && (
          <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Bot Setup Failed</p>
              <p className="opacity-90">{botStatus.error}</p>
              <p className="mt-2 text-[10px] font-medium uppercase tracking-wider bg-red-100 w-fit px-1.5 py-0.5 rounded">
                Check TELEGRAM_BOT_TOKEN in Settings
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-700 font-bold">Fetch Error (401 Unauthorized)</p>
                <p className="text-sm text-red-600 mt-1">Your Supabase API Key is invalid. Please check your credentials in Settings.</p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-xl border border-red-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">VITE_SUPABASE_URL</p>
                    <p className="text-xs font-mono truncate">{import.meta.env.VITE_SUPABASE_URL || 'NOT SET'}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-red-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">VITE_SUPABASE_ANON_KEY</p>
                    <p className="text-xs font-mono truncate">{import.meta.env.VITE_SUPABASE_ANON_KEY ? '••••••••' + import.meta.env.VITE_SUPABASE_ANON_KEY.slice(-4) : 'NOT SET'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse text-gray-400">
            <RefreshCw className="w-12 h-12 mb-4 animate-spin-slow" />
            <p className="font-medium">Loading {activeTab}...</p>
          </div>
        ) : activeTab === 'setup' ? (
          // SETUP TAB
          <div className="bg-white rounded-3xl p-8 border border-gray-100 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Database Schema Setup</h2>
              <p className="text-sm text-gray-500">Run these commands in your Supabase SQL Editor to ensure your database is correctly configured.</p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100">
                <p className="font-bold mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  1. Connect Telegram Bot
                </p>
                <div className="space-y-3">
                  <p className="text-xs">To receive notifications about new orders in Telegram:</p>
                  <ol className="text-[11px] list-decimal ml-4 space-y-1 opacity-80">
                    <li>Create a bot via <b>@BotFather</b> and get the <b>Token</b>.</li>
                    <li>Add <b>TELEGRAM_BOT_TOKEN</b>, <b>TELEGRAM_ADMIN_ID</b>, and <b>SUPABASE_SERVICE_ROLE_KEY</b> to AI Studio <b>Settings</b>.</li>
                    <li>
                      <button 
                        onClick={() => alert("👉 Message your bot /id to get your ID instantly!")}
                        className="text-[#007AFF] font-bold hover:underline"
                      >
                        How to find my Admin ID?
                      </button>
                    </li>
                  </ol>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSetupBot}
                      disabled={botStatus.loading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-[#007AFF] border border-[#007AFF]/20 rounded-xl font-bold hover:bg-[#007AFF]/5 transition-all text-xs"
                    >
                      {botStatus.loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Bot className="w-4 h-4" />}
                      Link Bot Webhook
                    </button>
                    <button
                      onClick={handleTestBot}
                      disabled={testStatus.loading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-all text-xs"
                    >
                      {testStatus.loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Bot className="w-4 h-4" />}
                      Send Test Order
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
                <p className="font-bold mb-2 flex items-center gap-2 text-indigo-800">
                  <Shield className="w-5 h-5" />
                  Deployment Note (Cloud Run Org Policy)
                </p>
                <div className="text-xs space-y-2 opacity-90">
                  <p>If you see a <b>"constraints/run.managed.requireInvokerIam"</b> error during deployment, it means your Google Cloud organization restricts public access to apps. </p>
                  <p><b>Fix:</b> You must go to the Google Cloud Console for this project and enable "Allow unauthenticated" in the Cloud Run service settings, or contact your IT admin.</p>
                </div>
              </div>

              <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100">
                <p className="font-bold mb-1 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Database Repair (Fix "Column Missing" Errors)
                </p>
                <div className="text-[11px] mb-3 space-y-1 opacity-90">
                  <p>If you get "Could not find column" errors, copy and run this in your <b>Supabase SQL Editor</b>:</p>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-[10px] overflow-x-auto whitespace-pre-wrap select-all border border-red-200">
{`-- FIX MISSING COLUMNS
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- REFRESH PERMISSIONS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read/Write Products" ON products;
DROP POLICY IF EXISTS "Public Read/Write Orders" ON orders;

CREATE POLICY "Public Read/Write Products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write Orders" ON orders FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON products TO anon, authenticated, postgres, service_role;
GRANT ALL ON orders TO anon, authenticated, postgres, service_role;`}
                </pre>
              </div>

              <div className="p-4 bg-gray-50 text-gray-700 rounded-2xl border border-gray-100">
                <p className="font-bold mb-2 flex items-center gap-2">
                   <Clock className="w-4 h-4" />
                   Full Database Reset
                </p>
                <div className="text-[11px] mb-3 space-y-1 opacity-80">
                  <p>Use this ONLY if you want to wipe all data and start fresh:</p>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-[10px] overflow-x-auto whitespace-pre-wrap select-all border border-gray-200">
{`-- 1. DELETE EVERYTHING
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- 2. CREATE PRODUCTS
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. CREATE ORDERS
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,
  user_info JSONB NOT NULL,
  payment_method TEXT,
  transaction_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. PERMISSIONS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read/Write Products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write Orders" ON orders FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON products TO anon, authenticated, postgres, service_role;
GRANT ALL ON orders TO anon, authenticated, postgres, service_role;`}
                </pre>
              </div>
            </div>
          </div>
        ) : activeTab === 'orders' ? (
          // ORDERS TAB
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-200">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ClipboardList className="w-8 h-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">No orders yet</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">Orders will appear here once customers start buying.</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl overflow-hidden border border-gray-100 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Order</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Payment</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Price</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {orders.map(order => (
                      <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 text-sm truncate max-w-[200px]">{order.product_title}</span>
                            <span className="text-xs text-gray-400">{order.variant_label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900 text-sm">{order.user_name}</span>
                            <span className="text-xs text-brand/70 font-bold">@{order.user_username || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-brand text-xs uppercase">{order.payment_method}</span>
                            <span className="text-[10px] font-mono text-gray-400">ID: ...{order.transaction_id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase ${
                            order.status === 'completed' ? 'bg-green-50 text-green-600' :
                            order.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                            'bg-orange-50 text-orange-600'
                          }`}>
                            {order.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> :
                             order.status === 'cancelled' ? <XCircle className="w-3 h-3" /> :
                             <Clock className="w-3 h-3" />}
                            {order.status}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900 text-sm">{order.price}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {order.status === 'pending' && (
                              <>
                                <button 
                                  onClick={() => updateOrderStatus(order.id, 'completed')}
                                  className="p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-all"
                                  title="Mark Completed"
                                >
                                  <CheckCircle2 className="w-5 h-5" />
                                </button>
                                <button 
                                  onClick={() => updateOrderStatus(order.id, 'cancelled')}
                                  className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                                  title="Decline Order"
                                >
                                  <XCircle className="w-5 h-5" />
                                </button>
                              </>
                            )}
                            <button 
                              onClick={() => handleDeleteOrder(order.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete Permanently"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No products found</h3>
            <p className="text-sm text-gray-500 mt-1 mb-6 max-w-xs mx-auto">Your store is currently empty. Click the button below to add your first product.</p>
            <button
              onClick={() => setIsAddingProduct(true)}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#007AFF] text-white font-bold rounded-2xl hover:bg-[#007AFF]/90 active:scale-[0.98] transition-all shadow-lg shadow-[#007AFF]/20"
            >
              <Plus className="w-5 h-5" />
              Add First Product
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map(product => (
              <div key={product.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 flex flex-col group">
                <div className="aspect-video w-full bg-gray-100 relative overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4 flex gap-2 z-10">
                    <button
                      onClick={() => setEditingProduct(product)}
                      className="p-2.5 bg-white shadow-md text-[#007AFF] rounded-xl hover:bg-[#007AFF] hover:text-white transition-all active:scale-90 border border-gray-100"
                      title="Edit Product"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="p-2.5 bg-white shadow-md text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90 border border-gray-100"
                      title="Delete Product"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#007AFF] transition-colors">{product.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {product.variants.slice(0, 3).map((v, i) => (
                        <div key={v.id} className="h-8 px-2.5 bg-gray-50 border border-white rounded-lg flex items-center justify-center text-[11px] font-bold text-gray-600">
                          {v.label}
                        </div>
                      ))}
                      {product.variants.length > 3 && (
                        <div className="h-8 w-8 bg-gray-50 border border-white rounded-lg flex items-center justify-center text-[10px] font-bold text-gray-400">
                          +{product.variants.length - 3}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      {product.variants.length} Variants
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Floating Action Button for Add Product - only in Products Tab */}
        {activeTab === 'products' && products.length > 0 && (
          <button
            onClick={() => setIsAddingProduct(true)}
            className="fixed bottom-8 right-8 w-16 h-16 bg-[#007AFF] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-20 group"
            title="Add New Product"
          >
            <Plus className="w-8 h-8" />
            <span className="absolute right-full mr-4 px-3 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Add New Product
            </span>
          </button>
        )}
      </main>

      {(isAddingProduct || editingProduct) && (
        <ProductForm
          product={editingProduct}
          onSave={handleCreateOrUpdateProduct}
          onCancel={() => {
            setIsAddingProduct(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
};

const X = ({ className, ...props }: any) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);
