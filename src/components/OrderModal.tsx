import React, { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { motion } from 'motion/react';
import { Product, Variant, UserInfo } from '../types';
import { X, CheckCircle2 } from 'lucide-react';

interface OrderModalProps {
  product: Product;
  variant: Variant;
  onClose: () => void;
  onSubmit: (userInfo: UserInfo) => Promise<string | undefined>;
  isSubmitting: boolean;
}

export function OrderModal({ product, variant, onClose, onSubmit, isSubmitting }: OrderModalProps) {
  const [mmTime, setMmTime] = useState('');
  const [successData, setSuccessData] = useState<{ id?: string } | null>(null);
  const [formData, setFormData] = useState<Omit<UserInfo, 'email'>>({
    name: '',
    username: '',
  });

  useEffect(() => {
    // Auto-detect Telegram User Info
    const user = WebApp.initDataUnsafe?.user;
    if (user) {
      const telegramUsername = user.username ? `@${user.username}` : '';
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
      
      setFormData(prev => ({
        ...prev,
        username: prev.username || telegramUsername,
        name: prev.name || fullName || '',
      }));
    }
  }, []);

  useEffect(() => {
    const updateTime = () => {
      setMmTime(new Date().toLocaleTimeString('en-US', { 
        timeZone: 'Asia/Yangon', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (successData) {
      WebApp.MainButton.setText('DONE');
      WebApp.MainButton.onClick(onClose);
      WebApp.MainButton.show();
      WebApp.MainButton.enable();
      return () => {
        WebApp.MainButton.offClick(onClose);
        WebApp.MainButton.hide();
      };
    }

    // Basic validation to enable MainButton
    const isValid = formData.name.length > 2;
    
    WebApp.MainButton.setText(`CONFIRM PURCHASE (${variant.price} ${variant.currency})`);
    WebApp.MainButton.show();
    
    if (isValid && !isSubmitting) {
      WebApp.MainButton.enable();
    } else {
      WebApp.MainButton.disable();
    }

    const handleClick = async () => {
      try {
        const id = await onSubmit(formData);
        setSuccessData({ id });
      } catch (err) {
        // Error handled in App.tsx via status
      }
    };
    WebApp.MainButton.onClick(handleClick);

    if (isSubmitting) {
      WebApp.MainButton.showProgress();
    } else {
      WebApp.MainButton.hideProgress();
    }

    return () => {
      WebApp.MainButton.offClick(handleClick);
      WebApp.MainButton.hide();
    };
  }, [formData, isSubmitting, variant, onSubmit, successData, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = await onSubmit(formData);
      setSuccessData({ id });
    } catch (err) {
      // Error handled in App.tsx
    }
  };

  const deliveryTime = "5 - 15 Minutes";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white w-full max-w-md rounded-t-[2rem] p-6 pb-12 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
        
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-1.5 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <X size={20} />
        </button>

        {successData ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="text-center py-4"
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-green-600" />
            </div>
            
            <h2 className="text-[24px] font-bold text-black mb-2 tracking-tight">Order Confirmed!</h2>
            <p className="text-[#8E8E93] text-[15px] mb-8 leading-relaxed">
              Your subscription for <span className="text-black font-semibold">{product.title}</span> is being processed.
            </p>

            <div className="bg-[#F2F2F7] rounded-[24px] p-6 space-y-4 text-left">
              <div className="flex justify-between items-center pb-3 border-b border-[#D1D1D6]/30">
                <span className="text-[14px] font-medium text-[#8E8E93]">Contact Name</span>
                <span className="text-[14px] font-bold text-black">{formData.name}</span>
              </div>
              {formData.username && (
                <div className="flex justify-between items-center pb-3 border-b border-[#D1D1D6]/30">
                  <span className="text-[14px] font-medium text-[#8E8E93]">Telegram</span>
                  <span className="text-[14px] font-bold text-[#007AFF]">{formData.username}</span>
                </div>
              )}
              <div className="flex justify-between items-center pb-3 border-b border-[#D1D1D6]/30">
                <span className="text-[14px] font-medium text-[#8E8E93]">Order ID</span>
                <span className="text-[14px] font-mono font-bold text-black truncate max-w-[180px]">
                  {successData.id ? successData.id.split('-')[0].toUpperCase() : 'DEMO-ORDER'}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-[#D1D1D6]/30">
                <span className="text-[14px] font-medium text-[#8E8E93]">Estimated Delivery</span>
                <span className="text-[14px] font-bold text-[#007AFF]">{deliveryTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] font-medium text-[#8E8E93]">Status</span>
                <span className="text-[12px] font-bold text-green-600 bg-green-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Pending
                </span>
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={onClose}
                className="w-full py-4 text-[17px] font-bold text-white bg-[#007AFF] rounded-2xl shadow-lg shadow-[#007AFF]/25 transition-all active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[20px] font-bold text-black tracking-tight">Order Summary</h2>
                <div className="text-[12px] font-bold text-[#007AFF] bg-[#007AFF]/5 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-[#007AFF] rounded-full animate-pulse" />
                  {mmTime} MMT
                </div>
              </div>
              <div className="mt-4 p-4 bg-[#F2F2F7] rounded-[14px] flex justify-between items-center">
                <span className="text-[15px] font-medium text-black">{product.title}</span>
                <span className="text-[17px] font-bold text-[#007AFF]">{variant.price} {variant.currency}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[#8E8E93] uppercase tracking-normal mb-1.5 px-1">
                  Contact Detail
                </label>
                <input
                  required
                  disabled={isSubmitting}
                  type="text"
                  placeholder="Add your phone number or Contact Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#F2F2F7] border-none rounded-xl px-4 py-3.5 text-[16px] focus:outline-none transition-all disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8E8E93] uppercase tracking-normal mb-1.5 px-1">
                  Telegram
                </label>
                <input
                  disabled={isSubmitting}
                  type="text"
                  placeholder="@username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full bg-[#F2F2F7] border-none rounded-xl px-4 py-3.5 text-[16px] focus:outline-none transition-all disabled:opacity-50"
                />
              </div>

              <div className="pt-4 grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => WebApp.openTelegramLink('https://t.me/yanrx4')}
                  className="w-full py-4 text-[16px] font-semibold text-[#007AFF] bg-[#007AFF]/10 rounded-xl transition-all active:scale-[0.98]"
                >
                  Contact Support Team
                </button>
                <p className="text-[12px] text-[#8E8E93] text-center px-4 pt-1 leading-normal">
                  Your selection will be processed immediately.
                </p>
              </div>
            </form>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
