import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Filter, AlertTriangle, Sparkles, Check, Edit2, ArrowUpDown } from 'lucide-react';
import api from '../api';

export default function CatalogManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    sku: '',
    name: '',
    description: '',
    priceInr: '',
    costInr: '',
    category: 'Electronics > Audio',
    inventory: 40
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/products');
      setProducts(res.data?.products || []);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStock = async (productId, newInventory) => {
    try {
      await api.patch(`/api/products/${productId}/inventory`, { inventory: newInventory });
      setProducts(products.map(p => p.id === productId ? { ...p, inventory: newInventory, inStock: newInventory > 0 } : p));
    } catch (err) {
      alert('Failed to update inventory: ' + err.message);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/products', newProduct);
      setShowAddModal(false);
      setNewProduct({
        sku: '',
        name: '',
        description: '',
        priceInr: '',
        costInr: '',
        category: 'Electronics > Audio',
        inventory: 40
      });
      fetchProducts();
    } catch (err) {
      alert('Failed to create product: ' + (err.response?.data?.error || err.message));
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || p.category.includes(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const categories = ['ALL', 'Audio', 'Accessories', 'Wearables', 'Gaming', 'Workspace'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Merchant Catalog & Inventory Manager</h1>
          <p className="text-xs text-slate-400">Manage real-time SKU pricing, margins, and availability for AI Buyer Agents</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Product SKU
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((p) => {
          return (
            <div key={p.id} className="p-4 rounded-2xl glass-card glass-card-hover flex flex-col justify-between gap-3 relative">
              {/* Badges */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  {p.sku}
                </span>
                <div className="flex items-center gap-1.5">
                  {p.isSlowMoving && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Slow-Moving ({p.salesCount30Days}/mo)
                    </span>
                  )}
                  {p.isHighMargin && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> High Margin ({p.marginPercent}%)
                    </span>
                  )}
                </div>
              </div>

              {/* Product Info */}
              <div>
                <h3 className="font-bold text-sm text-white">{p.name}</h3>
                <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{p.description}</p>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">{p.category}</div>
              </div>

              {/* Price & Margin & Inventory Controls */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500">Retail Price</span>
                    <div className="text-lg font-extrabold text-white font-mono">
                      ₹{p.priceInr.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500">Margin</span>
                    <div className="text-xs font-bold text-emerald-400 font-mono">
                      {p.marginPercent}% (Cost ₹{p.costInr})
                    </div>
                  </div>
                </div>

                {/* Stock Controls */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <span className="text-slate-400">Stock Available:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateStock(p.id, Math.max(0, p.inventory - 5))}
                      className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center transition-colors"
                    >
                      -
                    </button>
                    <span className={`font-mono font-bold ${p.inventory <= 5 ? 'text-red-400' : 'text-white'}`}>
                      {p.inventory}
                    </span>
                    <button
                      onClick={() => handleUpdateStock(p.id, p.inventory + 5)}
                      className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 text-slate-100 space-y-4">
            <h3 className="text-lg font-bold text-white">Add New Product to Catalog</h3>
            <form onSubmit={handleAddProduct} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">SKU Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EB-009"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wireless Pro Earbuds"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Description</label>
                <textarea
                  rows="2"
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                ></textarea>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={newProduct.priceInr}
                    onChange={(e) => setNewProduct({ ...newProduct, priceInr: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Cost (₹)</label>
                  <input
                    type="number"
                    value={newProduct.costInr}
                    onChange={(e) => setNewProduct({ ...newProduct, costInr: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Stock</label>
                  <input
                    type="number"
                    value={newProduct.inventory}
                    onChange={(e) => setNewProduct({ ...newProduct, inventory: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md shadow-blue-600/30"
                >
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
