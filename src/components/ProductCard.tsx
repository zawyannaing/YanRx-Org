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
  const [selectedVariant, setSelectedVariant] = useState<Variant>(product.variants[0]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-[1.25rem] border border-[#E5E5EA] overflow-hidden mb-3"
    >
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-[17px] font-semibold text-black tracking-tight">{product.title}</h3>
            <p className="text-[13px] text-[#8E8E93] mt-0.5 leading-snug">
              {product.description}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {product.variants.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVariant(v)}
              className={cn(
                "px-4 py-3 rounded-xl text-[14px] font-medium transition-all flex flex-col items-center justify-center border",
                selectedVariant.id === v.id
                  ? "bg-[#007AFF]/5 border-[#007AFF] text-[#007AFF]"
                  : "bg-[#F2F2F7] border-transparent text-[#1C1C1E] hover:bg-[#E5E5EA]"
              )}
            >
              <span>{v.label}</span>
              <span className={cn(
                "text-[11px] mt-0.5 font-semibold",
                selectedVariant.id === v.id ? "text-[#007AFF]" : "text-[#8E8E93]"
              )}>
                {v.price} {v.currency}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => onOrder(product, selectedVariant)}
          className="w-full bg-[#007AFF] text-white font-semibold py-3.5 rounded-xl text-[16px] transition-all active:scale-[0.98] active:opacity-90"
        >
          Select & Continue
        </button>
      </div>
    </motion.div>
  );
}
