import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Product, Variant } from '../types';
import { ChevronRight, CreditCard } from 'lucide-react';
import { cn } from '../lib/utils';

export interface ProductCardProps {
  key?: string | number;
  product: Product;
  onOrder: (product: Product, variant: Variant) => void;
}

export function ProductCard({ product, onOrder }: ProductCardProps) {
  const [selectedVariant, setSelectedVariant] = useState<Variant>(
    product.variants && product.variants.length > 0 
      ? product.variants[0] 
      : { id: 'dummy', label: 'No Plan', price: 0, currency: 'USD' }
  );

  const isPopular = product.id.length % 3 === 0;

  if (!product.variants || product.variants.length === 0) {
    return (
      <div className="glass-card rounded-[1.25rem] p-5 mb-4">
        <h3 className="text-[17px] font-bold text-black">{product.title}</h3>
        <p className="text-sm text-red-500 mt-2 font-medium">Coming soon: Price plans are being updated.</p>
      </div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass-card rounded-[1.5rem] overflow-hidden mb-4 group relative"
    >
      {isPopular && (
        <div className="absolute top-0 right-0 z-10">
          <div className="bg-brand text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-bl-xl shadow-lg">
            Most Popular
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="flex justify-between items-start mb-5">
          <div className="max-w-[80%]">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-dark bg-brand/10 px-2 py-0.5 rounded-full">
                {product.category || 'Premium'}
              </span>
            </div>
            <h3 className="text-[20px] font-bold text-black tracking-tight leading-tight group-hover:text-brand transition-colors">
              {product.title}
            </h3>
            <p className="text-[14px] text-gray-600 mt-2 leading-relaxed font-medium">
              {product.description}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {product.variants.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVariant(v)}
              className={cn(
                "px-2 py-3.5 rounded-2xl text-[14px] font-bold transition-all flex flex-col items-center justify-center border-2",
                selectedVariant.id === v.id
                  ? "bg-brand border-brand text-white shadow-lg shadow-brand/20 scale-[1.02]"
                  : "bg-white/50 border-white/50 text-[#1C1C1E] hover:border-brand/30"
              )}
            >
              <span className="opacity-90">{v.label}</span>
              <span className={cn(
                "text-[12px] mt-1",
                selectedVariant.id === v.id ? "text-white/70" : "text-gray-500"
              )}>
                {v.price} {v.currency}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => onOrder(product, selectedVariant)}
          className="w-full bg-brand hover:bg-brand/90 text-white font-bold py-4 rounded-2xl text-[16px] shadow-xl shadow-brand/20 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
        >
          <CreditCard className="w-5 h-5" />
          Get Access Now
        </button>
      </div>
    </motion.div>
  );
}
