import { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { supabase } from './lib/supabase';
import { Product, Variant, UserInfo, Order } from './types';
import { ProductCard } from './components/ProductCard';
import { OrderModal } from './components/OrderModal';
import { AdminPanel } from './components/AdminPanel';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, Sparkles, CheckCircle2, AlertCircle, X, Shield, MessageCircle, Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import axios from 'axios';
import { cn } from './lib/utils';

// Store application context
export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<{ product: Product; variant: Variant } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 1000 });

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    
    const productMinPrice = Math.min(...product.variants.map(v => v.price));
    const matchesPrice = productMinPrice >= priceRange.min && productMinPrice <= priceRange.max;

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

    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('products')
          .select('*');
        
        if (error) throw error;
        setProducts(data || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderSubmit = async (userInfo: UserInfo): Promise<string | undefined> => {
    if (!selectedOrder) return;
    
    setIsSubmitting(true);
    setStatus(null);
    let orderId: string | undefined;
    
    try {
      // 1. Save to Supabase (CRITICAL STEP)
      if (!supabase) {
        throw new Error('Supabase is not configured. Please check your Settings.');
      }

      const orderData: any = {
        product_id: selectedOrder.product.id,
        variant_id: selectedOrder.variant.id,
        user_info: {
          ...userInfo,
          telegram_id: WebApp.initDataUnsafe.user?.id
        },
        status: 'pending'
      };
      
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
    <div className="min-h-screen bg-[#F2F2F7] pb-12 font-sans selection:bg-[#007AFF]/10">
      {/* Header */}
      <header className="px-5 py-5 bg-white border-b border-[#D1D1D6]/30 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[20px] font-bold text-[#1C1C1E] tracking-tight">Yan R.X</h1>
            <button 
              onClick={() => {
                WebApp.openTelegramLink('https://t.me/yanrx4');
                if (WebApp.HapticFeedback && typeof WebApp.HapticFeedback.impactOccurred === 'function') {
                  try {
                    WebApp.HapticFeedback.impactOccurred('light');
                  } catch (e) {}
                }
              }}
              className="p-2 text-[#007AFF] hover:bg-[#007AFF]/5 rounded-xl transition-all"
              title="Contact Support (@yanrx4)"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
            <button 
              onClick={() => {
                setShowAdmin(true);
                if (WebApp.HapticFeedback && typeof WebApp.HapticFeedback.impactOccurred === 'function') {
                  try {
                    WebApp.HapticFeedback.impactOccurred('medium');
                  } catch (e) {}
                }
              }}
              className="p-2 text-[#8E8E93] hover:text-[#007AFF] hover:bg-[#007AFF]/5 rounded-xl transition-all"
              title="Admin Panel"
            >
              <Shield className="w-5 h-5" />
            </button>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#E5E5EA] flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
            <Sparkles className="w-5 h-5 text-[#8E8E93]" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 pt-6">
        {/* Search Bar */}
        <div className="mb-6 space-y-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8E8E93] group-focus-within:text-[#007AFF] transition-colors" />
            <input 
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-[#D1D1D6]/30 rounded-2xl text-[16px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-[#8E8E93]/10 rounded-full"
              >
                <X className="w-4 h-4 text-[#8E8E93]" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
            <button 
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold transition-all shrink-0",
                !selectedCategory 
                  ? "bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/20" 
                  : "bg-white text-[#8E8E93] border border-[#D1D1D6]/30 hover:border-[#007AFF]/30"
              )}
            >
              All
            </button>
            {categories.map(category => (
              <button 
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-semibold transition-all shrink-0",
                  selectedCategory === category
                    ? "bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/20" 
                    : "bg-white text-[#8E8E93] border border-[#D1D1D6]/30 hover:border-[#007AFF]/30"
                )}
              >
                {category}
              </button>
            ))}
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-2 rounded-full transition-all ml-auto",
                showFilters ? "bg-[#007AFF] text-white" : "bg-white text-[#8E8E93] border border-[#D1D1D6]/30"
              )}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>

          {/* Price Range Filter */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white rounded-2xl p-5 border border-[#D1D1D6]/30 shadow-sm mt-2">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-bold text-[#1C1C1E]">Price Range</p>
                    <p className="text-xs font-semibold text-[#007AFF] bg-[#007AFF]/5 px-2 py-1 rounded-lg">
                      ${priceRange.min} — ${priceRange.max}
                    </p>
                  </div>
                  <div className="space-y-6 px-1">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-2">
                        <label className="text-[11px] font-bold text-[#8E8E93] uppercase">Min Price</label>
                        <input 
                          type="range"
                          min="0"
                          max="500"
                          step="5"
                          value={priceRange.min}
                          onChange={(e) => setPriceRange(prev => ({ ...prev, min: Number(e.target.value) }))}
                          className="w-full accent-[#007AFF]"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <label className="text-[11px] font-bold text-[#8E8E93] uppercase">Max Price</label>
                        <input 
                          type="range"
                          min="0"
                          max="1000"
                          step="10"
                          value={priceRange.max}
                          onChange={(e) => setPriceRange(prev => ({ ...prev, max: Number(e.target.value) }))}
                          className="w-full accent-[#007AFF]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mb-4 px-1 flex items-center justify-between">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'Service' : 'Services'} Found
          </p>
        </div>
        
        <div className="grid grid-cols-1">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOrder={(p, v) => {
                  setSelectedOrder({ product: p, variant: v });
                  if (WebApp.HapticFeedback && typeof WebApp.HapticFeedback.impactOccurred === 'function') {
                    try {
                      WebApp.HapticFeedback.impactOccurred('light');
                    } catch (e) {}
                  }
                }}
              />
            ))
          ) : (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center border border-[#D1D1D6]/30 mx-auto mb-4">
                <Search className="w-8 h-8 text-[#8E8E93]" />
              </div>
              <p className="text-[#1C1C1E] font-bold">No products found</p>
              <p className="text-[#8E8E93] text-sm mt-1">Try adjusting your filters or search terms</p>
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory(null);
                  setPriceRange({ min: 0, max: 1000 });
                }}
                className="mt-6 text-[#007AFF] font-bold text-sm hover:underline transition-all"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Modals & Popups */}
      <AnimatePresence>
        {showAdmin && (
          <AdminPanel 
            onClose={() => {
              setShowAdmin(false);
              fetchProducts(); // Refresh products after admin might have changed them
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
          © 2024 TeleStore Digital. Secure transactions guaranteed.
        </p>
      </footer>
    </div>
  );
}
