/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Bike, 
  Utensils, 
  Package, 
  ShoppingBag, 
  MapPin, 
  Navigation, 
  Clock, 
  Wallet, 
  Search, 
  ChevronRight, 
  ArrowLeft,
  Map as MapIcon,
  Info,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings as SettingsIcon,
  LogOut,
  User as UserIcon,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { getMapGrounding, calculatePrice, getPricingSettings, PricingSettings } from './lib/gemini';
import { ServiceType, BookingState } from './types';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const SERVICES = [
  { id: 'ride' as ServiceType, name: 'GoRide', icon: Bike, color: 'bg-emerald-500', desc: 'Ojek Motor' },
  { id: 'food' as ServiceType, name: 'GoFood', icon: Utensils, color: 'bg-red-500', desc: 'Pesan Makan' },
  { id: 'send' as ServiceType, name: 'GoSend', icon: Package, color: 'bg-blue-500', desc: 'Kirim Barang' },
  { id: 'jastip' as ServiceType, name: 'GoJastip', icon: ShoppingBag, color: 'bg-amber-500', desc: 'Titip Barang' },
];

const ADMIN_EMAIL = "mitapn86@gmail.com";

export default function App() {
  const [booking, setBooking] = useState<BookingState>({
    service: null,
    origin: null,
    destination: null,
    price: null,
    distance: null,
    duration: null,
    status: 'idle',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [geminiResponse, setGeminiResponse] = useState<{ text: string, chunks: any[] } | null>(null);
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchPricing = async () => {
      const settings = await getPricingSettings();
      setPricing(settings);
    };
    fetchPricing();
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => console.warn("Geolocation error:", err)
      );
    }
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAdminMode(false);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleServiceSelect = (service: ServiceType) => {
    setBooking(prev => ({ ...prev, service, status: 'idle' }));
  };

  const handleEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking.origin?.address || !booking.destination?.address) {
      setError("Mohon isi lokasi asal dan tujuan");
      return;
    }

    if (!pricing) {
      setError("Gagal memuat pengaturan harga. Coba lagi nanti.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const prompt = `Hitung jarak dan waktu tempuh dari ${booking.origin.address} ke ${booking.destination.address} di Indonesia. Berikan estimasi jarak dalam KM dan waktu dalam menit. Gunakan Google Maps untuk data akurat.`;
      
      const result = await getMapGrounding(prompt, userLocation || undefined);
      setGeminiResponse({ text: result.text, chunks: result.groundingChunks });

      const distanceMatch = result.text.match(/(\d+([.,]\d+)?)\s*km/i);
      const durationMatch = result.text.match(/(\d+)\s*menit/i);

      const distanceKm = distanceMatch ? parseFloat(distanceMatch[1].replace(',', '.')) : 5;
      const duration = durationMatch ? durationMatch[1] : '15';

      const price = calculatePrice(distanceKm, booking.service!, pricing);

      setBooking(prev => ({
        ...prev,
        price,
        distance: `${distanceKm} km`,
        duration: `${duration} menit`,
        status: 'estimated'
      }));
    } catch (err) {
      setError("Gagal mendapatkan estimasi. Coba lagi.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = () => {
    setBooking(prev => ({ ...prev, status: 'booked' }));
  };

  const reset = () => {
    setBooking({
      service: null,
      origin: null,
      destination: null,
      price: null,
      distance: null,
      duration: null,
      status: 'idle',
    });
    setGeminiResponse(null);
    setError(null);
  };

  const savePricing = async (newPricing: PricingSettings) => {
    setLoading(true);
    const path = 'settings/global';
    try {
      await setDoc(doc(db, path), newPricing);
      setPricing(newPricing);
      alert("Pengaturan harga berhasil disimpan!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col items-center">
      <div className="w-full max-w-md bg-white min-h-screen shadow-xl relative overflow-hidden flex flex-col">
        
        {/* Header */}
        <header className="px-6 pt-8 pb-4 bg-white sticky top-0 z-10 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                <Navigation size={24} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-emerald-800">GOARMI</h1>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button 
                  onClick={() => setIsAdminMode(!isAdminMode)}
                  className={`p-2 rounded-xl transition-colors ${isAdminMode ? 'bg-emerald-100 text-emerald-600' : 'text-gray-400 hover:bg-gray-100'}`}
                >
                  <SettingsIcon size={20} />
                </button>
              )}
              {user ? (
                <div className="group relative">
                  <button className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                    <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="User" referrerPolicy="no-referrer" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-20">
                    <p className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest truncate">{user.email}</p>
                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <LogOut size={16} />
                      Keluar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={handleLogin} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors">
                  <UserIcon size={20} />
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-4">
          <AnimatePresence mode="wait">
            
            {isAdminMode ? (
              <motion.div
                key="admin"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <h2 className="text-xl font-bold text-emerald-900">Panel Admin</h2>
                  <p className="text-emerald-800 text-sm">Atur tarif layanan GOARMI</p>
                </div>

                {pricing && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Biaya Dasar (Rp)</label>
                      <input 
                        type="number" 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={pricing.basePrice}
                        onChange={(e) => setPricing({...pricing, basePrice: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">GoRide / KM</label>
                        <input 
                          type="number" 
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={pricing.perKmRide}
                          onChange={(e) => setPricing({...pricing, perKmRide: parseInt(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">GoFood / KM</label>
                        <input 
                          type="number" 
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={pricing.perKmFood}
                          onChange={(e) => setPricing({...pricing, perKmFood: parseInt(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">GoSend / KM</label>
                        <input 
                          type="number" 
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={pricing.perKmSend}
                          onChange={(e) => setPricing({...pricing, perKmSend: parseInt(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">GoJastip / KM</label>
                        <input 
                          type="number" 
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={pricing.perKmJastip}
                          onChange={(e) => setPricing({...pricing, perKmJastip: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => savePricing(pricing)}
                      disabled={loading}
                      className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                      Simpan Perubahan
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              <>
                {/* Step 1: Service Selection */}
                {!booking.service && (
                  <motion.div
                    key="services"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                      <p className="text-emerald-800 font-medium text-sm">Halo, mau kemana hari ini?</p>
                      <h2 className="text-xl font-bold text-emerald-900 mt-1">Pilih Layanan Kami</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {SERVICES.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleServiceSelect(s.id)}
                          className="flex flex-col items-center p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group"
                        >
                          <div className={`${s.color} w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform`}>
                            <s.icon size={28} />
                          </div>
                          <span className="font-bold text-gray-800">{s.name}</span>
                          <span className="text-xs text-gray-500 mt-1">{s.desc}</span>
                        </button>
                      ))}
                    </div>

                    <div className="mt-8">
                      <h3 className="font-bold text-gray-800 mb-4">Promo Untukmu</h3>
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg">
                        <div className="relative z-10">
                          <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Diskon 50%</p>
                          <h4 className="text-xl font-bold mt-1">Perjalanan Pertama</h4>
                          <button className="mt-4 bg-white text-emerald-600 px-4 py-2 rounded-lg text-sm font-bold shadow-sm">Klaim Sekarang</button>
                        </div>
                        <Bike className="absolute -right-4 -bottom-4 text-white/20 w-32 h-32 rotate-12" />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Location Input */}
                {booking.service && booking.status === 'idle' && (
                  <motion.div
                    key="location"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <button onClick={() => setBooking(prev => ({ ...prev, service: null }))} className="flex items-center gap-2 text-gray-500 hover:text-emerald-600 transition-colors">
                      <ArrowLeft size={20} />
                      <span className="font-medium">Kembali</span>
                    </button>

                    <div className="flex items-center gap-3">
                      <div className={`${SERVICES.find(s => s.id === booking.service)?.color} w-10 h-10 rounded-xl flex items-center justify-center text-white`}>
                        {React.createElement(SERVICES.find(s => s.id === booking.service)?.icon || Bike, { size: 20 })}
                      </div>
                      <h2 className="text-xl font-bold">Atur Lokasi {SERVICES.find(s => s.id === booking.service)?.name}</h2>
                    </div>

                    <form onSubmit={handleEstimate} className="space-y-4">
                      <div className="relative">
                        <div className="absolute left-4 top-4 flex flex-col items-center gap-1">
                          <div className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-white" />
                          <div className="w-0.5 h-10 bg-gray-200" />
                          <MapPin className="text-red-500" size={16} />
                        </div>
                        
                        <div className="ml-10 space-y-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Asal</label>
                            <input 
                              type="text" 
                              placeholder="Cari lokasi jemput..."
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                              value={booking.origin?.address || ''}
                              onChange={(e) => setBooking(prev => ({ ...prev, origin: { address: e.target.value } }))}
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tujuan</label>
                            <input 
                              type="text" 
                              placeholder="Mau kemana?"
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                              value={booking.destination?.address || ''}
                              onChange={(e) => setBooking(prev => ({ ...prev, destination: { address: e.target.value } }))}
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-sm">
                          <AlertCircle size={16} />
                          {error}
                        </div>
                      )}

                      <button 
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="animate-spin" size={20} />
                            Menghitung Tarif...
                          </>
                        ) : (
                          <>
                            Cek Harga
                            <ChevronRight size={20} />
                          </>
                        )}
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* Step 3: Estimation */}
                {booking.status === 'estimated' && (
                  <motion.div
                    key="estimation"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    <button onClick={() => setBooking(prev => ({ ...prev, status: 'idle' }))} className="flex items-center gap-2 text-gray-500 hover:text-emerald-600 transition-colors">
                      <ArrowLeft size={20} />
                      <span className="font-medium">Ubah Rute</span>
                    </button>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                      <div className="h-40 bg-emerald-100 relative flex items-center justify-center overflow-hidden">
                        <MapIcon className="text-emerald-300 w-24 h-24" />
                        <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                          <div className="bg-white px-3 py-1 rounded-full shadow-sm flex items-center gap-2 border border-gray-100">
                            <Navigation size={14} className="text-emerald-600" />
                            <span className="text-xs font-bold text-emerald-800">{booking.distance}</span>
                          </div>
                          <div className="bg-white px-3 py-1 rounded-full shadow-sm flex items-center gap-2 border border-gray-100">
                            <Clock size={14} className="text-emerald-600" />
                            <span className="text-xs font-bold text-emerald-800">{booking.duration}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`${SERVICES.find(s => s.id === booking.service)?.color} w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                              {React.createElement(SERVICES.find(s => s.id === booking.service)?.icon || Bike, { size: 24 })}
                            </div>
                            <div>
                              <h3 className="font-bold text-lg">{SERVICES.find(s => s.id === booking.service)?.name}</h3>
                              <p className="text-xs text-gray-500">Estimasi tiba dalam {booking.duration}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-emerald-700">Rp {booking.price?.toLocaleString('id-ID')}</p>
                            <p className="text-xs text-gray-400">Termasuk pajak</p>
                          </div>
                        </div>

                        <div className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                            <p className="text-sm text-gray-600"><span className="font-bold text-gray-800">Dari:</span> {booking.origin?.address}</p>
                          </div>
                          <div className="flex gap-3">
                            <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                            <p className="text-sm text-gray-600"><span className="font-bold text-gray-800">Ke:</span> {booking.destination?.address}</p>
                          </div>
                        </div>

                        {geminiResponse && (
                          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <div className="flex items-center gap-2 mb-2 text-emerald-800">
                              <Info size={16} />
                              <span className="text-xs font-bold uppercase tracking-wider">Informasi Rute (AI)</span>
                            </div>
                            <div className="text-xs text-emerald-900/80 prose prose-sm max-w-none">
                              <ReactMarkdown>{geminiResponse.text}</ReactMarkdown>
                            </div>
                          </div>
                        )}

                        <button 
                          onClick={handleBook}
                          className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-[0.98] transition-all"
                        >
                          Pesan Sekarang
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Booked */}
                {booking.status === 'booked' && (
                  <motion.div
                    key="booked"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-12 text-center"
                  >
                    <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6">
                      <CheckCircle2 size={64} className="animate-bounce" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Pesanan Diterima!</h2>
                    <p className="text-gray-500 mt-2 px-6">Driver kami sedang menuju ke lokasi jemput Anda.</p>
                    <button onClick={reset} className="mt-8 text-emerald-600 font-bold hover:underline">Kembali ke Beranda</button>
                  </motion.div>
                )}
              </>
            )}

          </AnimatePresence>
        </main>

        {!booking.service && !isAdminMode && (
          <nav className="px-6 py-4 bg-white border-t border-gray-100 flex justify-between items-center">
            {[
              { icon: Navigation, label: 'Beranda', active: true },
              { icon: Clock, label: 'Aktivitas', active: false },
              { icon: Wallet, label: 'Bayar', active: false },
              { icon: Search, label: 'Promo', active: false },
            ].map((item, idx) => (
              <button key={idx} className={`flex flex-col items-center gap-1 ${item.active ? 'text-emerald-600' : 'text-gray-400'}`}>
                <item.icon size={20} />
                <span className="text-[10px] font-bold">{item.label}</span>
              </button>
            ))}
          </nav>
        )}

      </div>
    </div>
  );
}
