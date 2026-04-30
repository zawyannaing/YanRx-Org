import React, { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { motion } from 'motion/react';
import { Product, Variant, UserInfo } from '../types';
import { X, CheckCircle2, MessageCircle, Plus, Copy, CreditCard } from 'lucide-react';
import { cn } from '../lib/utils';

interface OrderModalProps {
  product: Product;
  variant: Variant;
  onClose: () => void;
  onSubmit: (userInfo: UserInfo, paymentMethod: string, transactionId: string) => Promise<string | undefined>;
  isSubmitting: boolean;
}

export function OrderModal({ product, variant, onClose, onSubmit, isSubmitting }: OrderModalProps) {
  const [mmTime, setMmTime] = useState('');
  const [successData, setSuccessData] = useState<{ id?: string } | null>(null);
  const [selectedPayment, setSelectedPayment] = useState('KPay');
  const [transactionId, setTransactionId] = useState('');
  const [step, setStep] = useState<'form' | 'summary'>('form');
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
      WebApp.MainButton.hideProgress();
      WebApp.MainButton.onClick(onClose);
      WebApp.MainButton.show();
      WebApp.MainButton.enable();
      return () => {
        WebApp.MainButton.hideProgress();
        WebApp.MainButton.offClick(onClose);
        WebApp.MainButton.hide();
      };
    }

    if (step === 'form') {
      const isValid = formData.name.length > 2 && transactionId.length === 6;
      WebApp.MainButton.setText('REVIEW ORDER');
      WebApp.MainButton.show();
      if (isValid) WebApp.MainButton.enable();
      else WebApp.MainButton.disable();

      const handleNext = () => setStep('summary');
      WebApp.MainButton.onClick(handleNext);
      return () => {
        WebApp.MainButton.offClick(handleNext);
        WebApp.MainButton.hide();
      };
    }

    if (step === 'summary') {
      WebApp.MainButton.setText(`CONFIRM PURCHASE (${variant.price} ${variant.currency})`);
      WebApp.MainButton.show();
      WebApp.MainButton.enable();

      const handleClick = async () => {
        if (isSubmitting) return;
        try {
          WebApp.MainButton.showProgress();
          const id = await onSubmit(formData, selectedPayment, transactionId);
          setSuccessData({ id });
        } catch (err) {
          console.error('Order submission failed:', err);
        } finally {
          WebApp.MainButton.hideProgress();
        }
      };
      WebApp.MainButton.onClick(handleClick);
      
      if (isSubmitting) WebApp.MainButton.showProgress();
      else WebApp.MainButton.hideProgress();

      return () => {
        WebApp.MainButton.offClick(handleClick);
        WebApp.MainButton.hide();
      };
    }
  }, [formData, isSubmitting, variant, onSubmit, successData, onClose, step, transactionId, selectedPayment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transactionId.length === 6 && formData.name.length > 2) {
      setStep('summary');
    }
  };

  const deliveryTime = "5 - 15 Minutes";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="glass-card w-full max-w-md rounded-t-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 pb-8 sm:pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] relative border-t border-white/60 max-h-[95vh] overflow-y-auto scrollbar-hide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-gray-300/50 rounded-full mx-auto mb-6 sm:hidden" />
        
        <button
          onClick={onClose}
          className="absolute top-6 right-6 sm:top-8 sm:right-8 p-2 rounded-full glass-button text-gray-400 hover:text-red-500 transition-all active:scale-95"
        >
          <X size={20} />
        </button>

        {successData ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="text-center py-4"
          >
            <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
              <CheckCircle2 size={48} className="text-green-500" />
            </div>
            
            <h2 className="text-[24px] sm:text-[28px] font-black text-black mb-2 tracking-tight">Order Summary</h2>
            <p className="text-[#8E8E93] text-[14px] sm:text-[15px] mb-6 sm:mb-10 leading-relaxed font-medium">
              Receipt for <span className="text-brand font-bold">{product.title}</span>
            </p>

            <div className="bg-gray-50/80 border border-gray-200/50 rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 space-y-3 sm:space-y-4 text-left shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
              <div className="flex justify-between items-center pb-3 border-b border-gray-200/40">
                <span className="text-[14px] font-bold text-gray-500 uppercase tracking-wider">Order ID</span>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold font-mono text-black">
                    #{successData.id ? successData.id.split('-')[0].toUpperCase() : 'DEMO'}
                  </span>
                  <button
                    onClick={() => {
                      if (successData.id) {
                        navigator.clipboard.writeText(successData.id);
                        WebApp.HapticFeedback.notificationOccurred('success');
                      }
                    }}
                    className="p-1 px-2 bg-brand/20 text-brand-dark rounded-lg text-[10px] font-black active:scale-90 transition-all font-mono"
                  >
                    COPY
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-200/40">
                <span className="text-[14px] font-bold text-gray-500 uppercase tracking-wider">Customer</span>
                <span className="text-[14px] font-bold text-black">{formData.name}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-200/40">
                <span className="text-[14px] font-bold text-gray-500 uppercase tracking-wider">Channel</span>
                <span className="text-[14px] font-bold text-brand-dark">{selectedPayment}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-200/40">
                <span className="text-[14px] font-bold text-gray-500 uppercase tracking-wider">Paid Digits</span>
                <span className="text-[14px] font-bold text-black font-mono">{transactionId}</span>
              </div>
              {formData.username && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-200/40">
                  <span className="text-[14px] font-bold text-gray-500 uppercase tracking-wider">Telegram</span>
                  <span className="text-[14px] font-bold text-brand-dark">{formData.username}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-[14px] font-bold text-gray-500 uppercase tracking-wider">Est. Delivery</span>
                <span className="text-[14px] font-bold text-emerald-700 bg-emerald-500/10 px-3 py-1 rounded-full">{deliveryTime}</span>
              </div>
            </div>
            
            <div className="mt-6 px-2 text-left">
              <p className="text-[11px] font-bold text-brand/80 leading-relaxed">
                🚀 Order confirmed! Keep this screen for your reference. You will receive updates via our Telegram Bot shortly.
              </p>
            </div>

            <button
              onClick={onClose}
              className="mt-10 w-full py-4 text-[17px] font-bold text-white bg-brand rounded-2xl shadow-xl active:scale-95 transition-all"
            >
              Done
            </button>
          </motion.div>
        ) : step === 'summary' ? (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="py-2 sm:py-4"
          >
            <h2 className="text-[24px] sm:text-[28px] font-black text-black mb-4 sm:mb-6 tracking-tight">Review Order</h2>
            
            <div className="bg-gray-50/80 border border-gray-200/50 rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 space-y-4 sm:space-y-5 text-left mb-6 sm:mb-10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-black">
                 <CheckCircle2 size={120} strokeWidth={1} />
               </div>
               
               <div>
                 <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Product Details</p>
                 <p className="text-[17px] font-black text-black">{product.title} - <span className="text-brand-dark">{variant.label}</span></p>
               </div>

               <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200/40">
                 <div>
                   <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Contact Name</p>
                   <p className="text-[15px] font-bold text-black">{formData.name}</p>
                 </div>
                 <div>
                   <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Fee</p>
                   <p className="text-[17px] font-black text-brand-dark">{variant.price} {variant.currency}</p>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200/40">
                 <div>
                   <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Pay Method</p>
                   <p className="text-[15px] font-bold text-black">{selectedPayment}</p>
                 </div>
                 <div>
                   <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Input Digits</p>
                   <p className="text-[17px] font-black font-mono text-black">{transactionId}</p>
                 </div>
               </div>
            </div>

            <div className="space-y-3 px-1">
              <button
                onClick={async () => {
                  if (isSubmitting) return;
                  try {
                    WebApp.MainButton.showProgress();
                    const id = await onSubmit(formData, selectedPayment, transactionId);
                    setSuccessData({ id });
                  } catch (err) {
                    WebApp.MainButton.hideProgress();
                  }
                }}
                disabled={isSubmitting}
                className="group relative w-full py-4 text-[17px] font-bold text-white bg-brand rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                {isSubmitting ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>CONFIRM & PAY</>
                )}
              </button>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setStep('form')}
                  disabled={isSubmitting}
                  className="w-full py-4 text-[15px] font-bold text-gray-500 bg-gray-100/80 rounded-2xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Edit
                </button>

                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="w-full py-4 text-[15px] font-bold text-red-500 bg-red-50 rounded-2xl active:scale-95 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[20px] sm:text-[24px] font-black text-black tracking-tight">Checkout</h2>
                <div className="text-[9px] sm:text-[10px] font-bold text-brand-dark bg-brand/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-brand-dark rounded-full animate-pulse" />
                  Details
                </div>
              </div>
              <p className="text-gray-600 text-xs sm:text-sm font-medium">Verify your details for premium access.</p>
              
              <div className="mt-4 sm:mt-8 p-4 sm:p-5 bg-gray-50/80 border border-gray-200/50 rounded-[18px] sm:rounded-[24px] flex justify-between items-center shadow-sm">
                <div>
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1">Plan</p>
                  <p className="text-[17px] font-extrabold text-black">{product.title}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1">Total</p>
                  <p className="text-[19px] font-black text-brand-dark tracking-tight">{variant.price} {variant.currency}</p>
                </div>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); if(formData.name.length > 2 && transactionId.length === 6) setStep('summary'); }} className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2 sm:mb-3 px-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['KPay', 'Wave', 'AYA'].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setSelectedPayment(method)}
                      className={cn(
                        "py-2 sm:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all border-2",
                        selectedPayment === method 
                          ? "bg-brand border-brand text-white shadow-lg shadow-brand/20" 
                          : "bg-white/50 border-white/80 text-[#1C1C1E] hover:bg-white/80"
                      )}
                    >
                      {method}
                    </button>
                  ))}
                </div>


                {/* Dynamic Payment Info Card */}
                <div className="mt-3 sm:mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="bg-brand/5 border border-brand/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-brand/10 rounded-lg sm:rounded-xl flex items-center justify-center">
                        <CreditCard size={16} className="text-brand sm:w-[18px] sm:h-[18px]" />
                      </div>
                      <div>
                        <p className="text-[9px] sm:text-[10px] font-bold text-brand/60 uppercase tracking-wider">{selectedPayment} Account</p>
                        <p className="text-[14px] sm:text-[16px] font-black text-black font-mono tracking-tight leading-none mb-0.5 sm:mb-1">
                          {selectedPayment === 'AYA' ? '90890809' : '09882881538'}
                        </p>
                        <p className="text-[11px] sm:text-[12px] font-bold text-brand/80">
                          {selectedPayment === 'AYA' ? 'LIN LAE MOE' : 'ZAW YAN NAING'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const num = selectedPayment === 'AYA' ? '90890809' : '09882881538';
                        navigator.clipboard.writeText(num);
                        WebApp.HapticFeedback.notificationOccurred('success');
                      }}
                      className="p-2 sm:p-2.5 bg-white border border-brand/20 rounded-lg sm:rounded-xl text-brand hover:bg-brand hover:text-white transition-all active:scale-90 shadow-sm"
                      title="Copy Number"
                    >
                      <Copy size={14} className="sm:w-[16px] sm:h-[16px]" />
                    </button>
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-gray-400 mt-1.5 sm:mt-2 px-1 font-medium italic">
                    Transfer first, then enter the 6 digits below.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-1.5 sm:mb-2 px-1">
                    Contact Name
                  </label>
                  <input
                    required
                    disabled={isSubmitting}
                    type="text"
                    placeholder="Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/50 border border-white/80 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-[15px] sm:text-[16px] font-medium focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] sm:text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-1.5 sm:mb-2 px-1">
                    Trans ID (6 Digits)
                  </label>
                  <input
                    required
                    disabled={isSubmitting}
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={transactionId}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      if (val.length <= 6) setTransactionId(val);
                    }}
                    className="w-full bg-white/50 border border-white/80 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-[15px] sm:text-[16px] font-mono font-bold focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-1.5 sm:mb-2 px-1">
                  Telegram Username (Optional)
                </label>
                <input
                  disabled={isSubmitting}
                  type="text"
                  placeholder="@your_username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full bg-white/50 border border-white/80 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-[15px] sm:text-[16px] font-medium focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all disabled:opacity-50"
                />
              </div>

              <div className="pt-2 sm:pt-4">
                <button
                  type="submit"
                  disabled={!formData.name || transactionId.length !== 6}
                  className="w-full py-3.5 sm:py-4 text-[16px] sm:text-[17px] font-bold text-white bg-brand rounded-xl sm:rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-30"
                >
                  Review Order Details
                </button>
                
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 sm:py-4 mt-1 sm:mt-2 text-[14px] sm:text-[15px] font-bold text-gray-400 hover:text-red-500 transition-all"
                >
                  Back
                </button>
              </div>

              <div className="pt-1 sm:pt-2">
                <button
                  type="button"
                  onClick={() => WebApp.openTelegramLink('https://t.me/yanrx4')}
                  className="w-full py-2.5 sm:py-3 text-[12px] sm:text-[13px] font-bold text-brand bg-brand/10 rounded-xl sm:rounded-2xl border border-brand/20 hover:bg-brand/20 transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle size={14} className="sm:w-[16px] sm:h-[16px]" />
                  Ask for Help
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
