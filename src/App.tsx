import { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { supabase } from './lib/supabase';
import { Product, Variant, UserInfo, Order } from './types';
import { ProductCard } from './components/ProductCard';
import { OrderModal } from './components/OrderModal';
import { AdminPanel } from './components/AdminPanel';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, Sparkles, CheckCircle2, AlertCircle, X, Shield, MessageCircle, Search, SlidersHorizontal, ChevronDown, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { cn } from './lib/utils';

// Store application context
export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<{ product: Product; variant: Variant } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 100000 });
  const [userBalance, setUserBalance] = useState<number>(0);
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];

  const filteredProducts = products.filter(product => {
    const title = (product.title || '').toLowerCase();
    const description = (product.description || '').toLowerCase();
    const category = (product.category || '').toLowerCase();
    const search = searchQuery.toLowerCase();
    
    const matchesSearch = title.includes(search) || description.includes(search);
    const matchesCategory = !selectedCategory || category === selectedCategory.toLowerCase();
    
    // Parse variants if they're somehow a string (Supabase safety)
    let variants = product.variants;
    if (typeof variants === 'string') {
      try {
        variants = JSON.parse(variants);
      } catch (e) {
        variants = [];
      }
    }

    const hasVariants = variants && Array.isArray(variants) && variants.length > 0;
    if (!hasVariants) {
      return matchesSearch && matchesCategory;
    }

    const prices = variants.map(v => Number(v.price) || 0);
    const productMinPrice = Math.min(...prices);
    const productMaxPrice = Math.max(...prices);
    
    // Match if ANY part of our price range overlaps with the product's price range
    const matchesPrice = productMinPrice <= priceRange.max && productMaxPrice >= priceRange.min;

    return matchesSearch && matchesCategory && matchesPrice;
  });

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    
    // Set theme color
    document.documentElement.style.setProperty('--tg-theme-bg-color', WebApp.backgroundColor);
    document.documentElement.style.setProperty('--tg-theme-text-color', WebApp.themeParams.text_color || '#000000');
    document.documentElement.style.setProperty('--tg-theme-button-color', WebApp.themeParams.button_color || '#2481cc');
    document.documentElement.style.setProperty('--tg-theme-button-text-color', WebApp.themeParams.button_text_color || '#ffffff');

    fetchProducts(true);
    fetchUserBalance();
  }, []);

  const fetchUserBalance = async () => {
    const user = WebApp.initDataUnsafe.user;
    if (user?.id) {
      try {
        const response = await axios.get(`/api/user/${user.id}`);
        if (response.data) {
          setUserBalance(response.data.balance || 0);
        }
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    }
  };

  const updateBalance = async (amount: number) => {
    const user = WebApp.initDataUnsafe.user;
    if (!user?.id) {
      WebApp.showAlert('Telegram user not found');
      return;
    }

    setIsUpdatingBalance(true);
    try {
      const response = await axios.post('/api/update-balance', {
        telegramId: user.id,
        amount: amount
      });

      if (response.data.success) {
        setUserBalance(response.data.balance);
        WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (error) {
      console.error('Error updating balance:', error);
      WebApp.showAlert('Failed to update balance');
    } finally {
      setIsUpdatingBalance(false);
    }
  };

  const fetchProducts = async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);

    try {
      if (supabase) {
        console.log('App: Fetching products...');
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Supabase fetch error:', error);
          throw error;
        }
        console.log(`Successfully fetched ${data?.length || 0} products`);
        if (data && data.length > 0) {
          console.log('Product Raw Sample:', data[0]);
          console.table(data.map(p => ({ 
            id: p.id, 
            title: p.title, 
            category: p.category, 
            v_count: p.variants?.length,
            v_type: typeof p.variants,
            v_is_arr: Array.isArray(p.variants)
          })));
        } else {
          console.warn('Database returned 0 products. Check your RLS policies or tables.');
        }
        setProducts(data || []);
        setStatus(null);
      } else {
        console.warn('Supabase not configured');
        setStatus({ type: 'error', message: 'Database not configured. Please check Settings.' });
      }
    } catch (error: any) {
      console.error('Error fetching products:', error);
      setStatus({ 
        type: 'error', 
        message: `Failed to load products: ${error.message || 'Check database connection'}` 
      });
    } finally {
      if (initial) setLoading(false);
      else setRefreshing(false);
    }
  };

  const handleOrderSubmit = async (userInfo: UserInfo, paymentMethod: string, transactionId: string): Promise<string | undefined> => {
    if (!selectedOrder) return;
    
    setIsSubmitting(true);
    setStatus(null);
    let orderId: string | undefined;
    
    try {
      // 1. Save to Supabase (CRITICAL STEP)
      if (!supabase) {
        throw new Error('Supabase is not configured. Please check your Settings.');
      }

      const orderData: Partial<Order> = {
        product_id: selectedOrder.product.id,
        variant_id: selectedOrder.variant.id,
        user_info: {
          ...userInfo,
          telegram_id: WebApp.initDataUnsafe.user?.id
        },
        payment_method: paymentMethod,
        transaction_id: transactionId,
        status: 'pending'
      };
      
      console.log('App: Saving order to Supabase...', orderData);
      
      const { data, error, status: dbStatus, statusText } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();
      
      if (error) {
        const is401 = dbStatus === 401 || error.message?.includes('401');
        if (is401) {
          throw new Error('Unauthorized (401). Your Supabase API Key is invalid.');
        }
        throw new Error(`Database Error (${dbStatus}): ${error.message || statusText}`);
      }
      
      orderId = data?.id;

      // 2. Notify Telegram (Non-blocking background call to prevent "Order Delay")
      // We don't await this so the user gets the success screen immediately
      axios.post('/api/notify-order', {
        order: selectedOrder.product,
        selectedVariant: selectedOrder.variant,
        userInfo: userInfo,
        paymentMethod: paymentMethod,
        transactionId: transactionId,
        orderId: orderId,
        telegramId: WebApp.initDataUnsafe.user?.id
      }).catch(tgError => console.warn('Background Telegram notification failed:', tgError));

      if (WebApp.HapticFeedback && typeof WebApp.HapticFeedback.notificationOccurred === 'function') {
        try {
          WebApp.HapticFeedback.notificationOccurred('success');
        } catch (e) {}
      }
      
      return orderId;
      
    } catch (error: any) {
      console.error('Order submission failed:', error);
      setStatus({ 
        type: 'error', 
        message: error.message || 'Failed to place order. Please try again.' 
      });
      
      if (WebApp.HapticFeedback && typeof WebApp.HapticFeedback.notificationOccurred === 'function') {
        try {
          WebApp.HapticFeedback.notificationOccurred('error');
        } catch (e) {}
      }
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-400 font-medium animate-pulse">Loading Store...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-12 font-sans selection:bg-brand/10">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand/10 blur-[120px] rounded-full animate-float" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-brand/5 blur-[100px] rounded-full animate-float [animation-delay:2s]" />
      </div>

      {/* Header */}
      <header className="px-5 py-4 bg-white/60 backdrop-blur-xl border-b border-white/40 sticky top-0 z-40 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand/10 overflow-hidden border border-brand/10">
              <img 
                src="https://storage.googleapis.com/bit-academy-static-assets/bi-bi-logo.png" 
                alt="Bi Bi Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/bottts/svg?seed=BiBi';
                }}
              />
            </div>
            <div>
              <h1 className="text-[18px] font-black text-black tracking-tight leading-none">Bi Bi</h1>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand">Digital Store</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                WebApp.openTelegramLink('https://t.me/yanrx4');
                WebApp.HapticFeedback?.impactOccurred('light');
              }}
              className="p-2.5 glass-button rounded-xl text-brand"
              title="Support"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
            <button 
              onClick={() => {
                setShowAdmin(true);
                WebApp.HapticFeedback?.impactOccurred('medium');
              }}
              className="p-2.5 glass-button rounded-xl text-[#8E8E93] hover:text-brand"
              title="Admin"
            >
              <Shield className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 pt-8 pb-4 relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10"
        >
          <div className="flex items-center gap-2 bg-white/50 backdrop-blur-md w-fit px-3 py-1.5 rounded-full border border-white/80 mb-6 group cursor-pointer active:scale-95 transition-all">
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-black/60">New Services Just Landed</span>
            <ChevronDown className="w-3 h-3 text-brand" />
          </div>
          <h2 className="text-[42px] font-black text-black leading-[0.92] tracking-tighter mb-4">
            Level Up Your <br/>
            <span className="text-brand">Digital Life.</span>
          </h2>
          <p className="text-[#8E8E93] text-[15px] max-w-[280px] font-medium leading-relaxed">
            Premium tools, subscriptions, and accounts delivered instantly to your inbox.
          </p>
        </motion.div>
        
        {/* Abstract shapes for fancy look */}
        <div className="absolute top-10 right-[-20px] w-40 h-40 bg-[#007AFF]/10 rounded-full blur-3xl animate-float" />
      </section>

      {/* Main Content */}
      <main className="px-4 mt-4">
        {/* Search & Filters */}
        <div className="mb-8 space-y-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-brand transition-colors" />
            <input 
              type="text"
              placeholder="Search premium plans..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 glass-card rounded-[24px] text-[16px] font-medium focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
            <button 
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shrink-0",
                !selectedCategory 
                  ? "bg-brand text-white shadow-xl shadow-brand/20" 
                  : "glass-card text-gray-500 hover:text-brand"
              )}
            >
              All Plans
            </button>
            {categories.map(category => (
              <button 
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shrink-0",
                  selectedCategory === category
                    ? "bg-brand text-white shadow-xl shadow-brand/20" 
                    : "glass-card text-gray-500 hover:text-brand"
                )}
              >
                {category}
              </button>
            ))}
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-2.5 rounded-2xl transition-all ml-auto",
                showFilters ? "bg-brand text-white" : "glass-card text-gray-500"
              )}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>

          {/* Price Range */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="glass-card rounded-[24px] p-6 shadow-2xl mt-2 border border-white/60">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <p className="text-sm font-black text-[#1C1C1E] mb-1">Max Budget</p>
                      <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Slide to adjust</p>
                    </div>
                    <p className="text-[15px] font-black text-brand bg-brand/10 px-4 py-2 rounded-2xl">
                      {priceRange.max >= 50000 ? 'No Limit' : '$' + priceRange.max}
                    </p>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="50000"
                    step="100"
                    value={priceRange.max}
                    onChange={(e) => setPriceRange(prev => ({ ...prev, max: Number(e.target.value) || 0 }))}
                    className="w-full accent-brand mb-2"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                    <span>Low Range</span>
                    <span>High Range</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Featured Item (Bento Grid Style) */}
        {!searchQuery && !selectedCategory && filteredProducts.length > 0 && products[0] && (
          <div className="mb-8">
            <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3 px-1">
              Store Highlight
            </h3>
            <ProductCard
              product={products[0]}
              onOrder={(p, v) => {
                setSelectedOrder({ product: p, variant: v });
                WebApp.HapticFeedback?.impactOccurred('light');
              }}
            />
          </div>
        )}

        {/* Explorer Grid */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between px-1 mb-4">
            <h3 className="text-[12px] font-bold text-[#8E8E93] uppercase tracking-[0.2em]">
              Explorer
            </h3>
            <button onClick={() => fetchProducts(false)} className="text-brand text-[11px] font-black flex items-center gap-1.5 active:scale-95 transition-all">
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              Sync
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {products.length === 0 && !loading && !refreshing ? (
              <div className="col-span-full py-20 text-center px-6 glass-card rounded-[2.5rem] border border-white/60 shadow-2xl">
                <div className="w-24 h-24 bg-[#F2F2F7] rounded-[2rem] flex items-center justify-center mx-auto mb-6 active:scale-90 transition-transform cursor-pointer">
                  <AlertCircle className="w-12 h-12 text-blue-400" />
                </div>
                <h3 className="text-2xl font-black mb-2 tracking-tight">Empty Vault</h3>
                <p className="text-gray-500 text-sm mb-10 leading-relaxed max-w-[240px] mx-auto font-medium">
                  We're currently refilling our digital stock. Check back in a few minutes.
                </p>
                <button 
                  onClick={() => setShowAdmin(true)}
                  className="w-full py-5 bg-brand text-white rounded-2xl font-black shadow-xl shadow-brand/20 active:scale-95 transition-all"
                >
                  Configure Store
                </button>
              </div>
            ) : filteredProducts.length > 0 ? (
              // If we showed the highlight, skip it in the list to avoid duplication
              filteredProducts
                .filter(p => !(!searchQuery && !selectedCategory && p.id === products[0]?.id))
                .map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOrder={(p, v) => {
                    setSelectedOrder({ product: p, variant: v });
                    WebApp.HapticFeedback?.impactOccurred('light');
                  }}
                />
              ))
            ) : !loading && !refreshing && (
              <div className="col-span-full py-20 text-center px-6 glass-card rounded-[2.5rem] border border-white/60 shadow-2xl">
                <div className="w-16 h-16 glass-button rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-6 h-6 text-[#8E8E93]" />
                </div>
                <h3 className="text-[#1C1C1E] font-bold text-lg tracking-tight">No results matched</h3>
                <p className="text-[#8E8E93] text-sm mt-2 mb-8 font-medium">
                  Try adjusting filters or using different keywords.
                </p>
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory(null);
                    setPriceRange({ min: 0, max: 100000 });
                  }}
                  className="px-8 py-4 bg-brand text-white rounded-2xl font-bold shadow-2xl active:scale-95 transition-all"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals & Popups */}
      <AnimatePresence>
        {showAdmin && (
          <AdminPanel 
            onClose={() => {
              setShowAdmin(false);
              setSearchQuery('');
              setSelectedCategory(null);
              setPriceRange({ min: 0, max: 100000 });
              fetchProducts(); 
            }} 
            onProductsUpdated={() => {
              fetchProducts();
            }}
          />
        )}
        
        {selectedOrder && (
          <OrderModal
            product={selectedOrder.product}
            variant={selectedOrder.variant}
            onClose={() => setSelectedOrder(null)}
            onSubmit={handleOrderSubmit}
            isSubmitting={isSubmitting}
          />
        )}

        {status && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-8 left-6 right-6 z-[60]"
          >
            <div className={cn(
              "p-4 rounded-2xl shadow-xl flex items-center gap-4 border",
              status.type === 'success' 
                ? "bg-green-50 border-green-100 text-green-800" 
                : "bg-red-50 border-red-100 text-red-800"
            )}>
              {status.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
              <div className="flex-1">
                <p className="text-sm font-bold">{status.type === 'success' ? 'Success!' : 'Error'}</p>
                <p className="text-xs opacity-80">{status.message}</p>
              </div>
              <button 
                onClick={() => setStatus(null)}
                className="p-2 hover:bg-black/5 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-8 text-center px-6">
        <p className="text-xs text-gray-400 font-medium">
          © 2024 Bi Bi Digital Store. Secure transactions guaranteed.
        </p>
      </footer>
    </div>
  );
}
