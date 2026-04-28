import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { Product, Variant } from '../types';

interface ProductFormProps {
  product?: Product | null;
  onSave: (product: Omit<Product, 'id'> & { id?: string }) => void;
  onCancel: () => void;
}

export const ProductForm: React.FC<ProductFormProps> = ({ product, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);

  useEffect(() => {
    if (product) {
      setTitle(product.title);
      setDescription(product.description || '');
      setImageUrl(product.image_url || '');
      setCategory(product.category || '');
      setVariants([...product.variants]);
    } else {
      setVariants([{ id: crypto.randomUUID(), label: '1 Month', price: 0, currency: 'USD' }]);
    }
  }, [product]);

  const addVariant = () => {
    setVariants([...variants, { id: crypto.randomUUID(), label: '', price: 0, currency: 'USD' }]);
  };

  const removeVariant = (id: string) => {
    setVariants(variants.filter(v => v.id !== id));
  };

  const updateVariant = (id: string, updates: Partial<Variant>) => {
    setVariants(variants.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: product?.id,
      title,
      description,
      image_url: imageUrl,
      category,
      variants
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Product Title</label>
              <input
                required
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-[#007AFF] outline-none transition-all"
                placeholder="e.g. Visual Studio Enterprise"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-[#007AFF] outline-none transition-all"
                placeholder="e.g. Design, Development, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-[#007AFF] outline-none transition-all resize-none h-24"
                placeholder="Describe the product..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Image URL</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-[#007AFF] outline-none transition-all"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                {imageUrl && (
                  <div className="w-12 h-12 rounded-xl border border-gray-100 overflow-hidden bg-gray-50 shrink-0">
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">Price Variants</label>
              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-1 text-sm font-bold text-[#007AFF] hover:bg-[#007AFF]/5 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Variant
              </button>
            </div>

            <div className="space-y-3">
              {variants.map((v, index) => (
                <div key={v.id} className="flex gap-2 items-start bg-gray-50 p-4 rounded-2xl relative group">
                  <div className="flex-1 space-y-2">
                    <input
                      required
                      type="text"
                      value={v.label}
                      onChange={(e) => updateVariant(v.id, { label: e.target.value })}
                      placeholder="Label (e.g. 1 Month)"
                      className="w-full bg-white border-transparent rounded-lg px-3 py-2 text-sm focus:border-[#007AFF] outline-none transition-all"
                    />
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          required
                          type="number"
                          step="0.01"
                          value={isNaN(v.price) ? '' : v.price}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateVariant(v.id, { price: isNaN(val) ? 0 : val });
                          }}
                          placeholder="0.00"
                          className="w-full bg-white border-transparent rounded-lg pl-6 pr-3 py-2 text-sm focus:border-[#007AFF] outline-none transition-all"
                        />
                      </div>
                      <input
                        required
                        type="text"
                        value={v.currency}
                        onChange={(e) => updateVariant(v.id, { currency: e.target.value })}
                        className="w-20 bg-white border-transparent rounded-lg px-3 py-2 text-sm focus:border-[#007AFF] outline-none transition-all uppercase"
                      />
                    </div>
                  </div>
                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariant(v.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-4 text-[16px] font-bold text-gray-500 bg-gray-100 rounded-xl active:scale-[0.98] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] py-4 text-[16px] font-bold text-white bg-[#007AFF] rounded-xl active:scale-[0.98] transition-all shadow-lg shadow-[#007AFF]/20"
            >
              {product ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
