import { useState, useRef, useCallback, useEffect } from 'react';
import { MapPin, Camera, Upload, Loader2, Check, AlertCircle, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase, CATEGORY_LABELS, type ComplaintCategory } from '@/lib/supabase';
import { uploadComplaintPhoto } from '@/lib/storage';
import { addReporterEntry } from '@/lib/reporter';
import { useAuth } from '@/lib/auth';

interface ComplaintFormProps {
  onSubmitted: () => void;
  onDemoSubmitted: (complaint: import('@/lib/supabase').Complaint) => void;
}

const PRISHTINA_CENTER: [number, number] = [42.6629, 21.1655];

export default function ComplaintForm({ onSubmitted, onDemoSubmitted }: ComplaintFormProps) {
  const { user } = useAuth();
  const isDemo = user?.email?.endsWith('@demo.local') === true;
  const [category, setCategory] = useState<ComplaintCategory>('pothole');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [showManualMap, setShowManualMap] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const miniMapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const pinMarkerRef = useRef<L.Marker | null>(null);

  const initMiniMap = useCallback(() => {
    if (!miniMapRef.current || mapInstanceRef.current) return;

    const map = L.map(miniMapRef.current, {
      center: PRISHTINA_CENTER,
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      setLat(e.latlng.lat);
      setLng(e.latlng.lng);
      setLocError(null);
      updatePin(e.latlng.lat, e.latlng.lng);
    });

    mapInstanceRef.current = map;

    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 300);
    setTimeout(() => map.invalidateSize(), 800);
  }, []);

  const updatePin = (latVal: number, lngVal: number) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (pinMarkerRef.current) {
      pinMarkerRef.current.setLatLng([latVal, lngVal]);
    } else {
      pinMarkerRef.current = L.marker([latVal, lngVal], { draggable: true })
        .addTo(map)
        .on('dragend', (e) => {
          const ll = (e.target as L.Marker).getLatLng();
          setLat(ll.lat);
          setLng(ll.lng);
        });
    }
  };

  useEffect(() => {
    if (!showManualMap) return;
    const timer = window.setTimeout(() => initMiniMap(), 80);
    return () => window.clearTimeout(timer);
  }, [showManualMap, initMiniMap]);

  useEffect(() => () => {
    mapInstanceRef.current?.remove();
    mapInstanceRef.current = null;
  }, []);

  const detectLocation = () => {
    setLocating(true);
    setLocError(null);
    setShowManualMap(true);
    if (!navigator.geolocation) {
      setLocating(false);
      setLocError('Shfletuesi nuk e mbështet gjetjen automatike. Vendoseni pikën në hartë.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        setLocating(false);
        window.setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([latitude, longitude], 16);
            updatePin(latitude, longitude);
          }
        }, 180);
      },
      () => {
        setLocating(false);
        setLocError('Nuk u lejua ose nuk u gjet lokacioni. Zgjidheni manualisht në hartë.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };
  const handleFileSelect = (file: File | undefined) => {
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setSubmitError('Ju lutemi shkruani një përshkrim.');
      return;
    }
    if (lat === null || lng === null) {
      setSubmitError('Ju lutemi vendosni lokacionin në hartë.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    if (isDemo) {
      onDemoSubmitted({
        id: `demo-user-${Date.now()}`,
        category,
        description: description.trim(),
        image_url: imagePreview,
        lat,
        lng,
        status: 'pranuar',
        reporter_token: '',
        confirmed_by_reporter: false,
        user_id: user?.id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setSubmitting(false);
      setSuccess(true);
      return;
    }

    let imageUrl: string | null = null;
    if (imageFile) {
      imageUrl = await uploadComplaintPhoto(imageFile);
    }

    const { data, error } = await supabase
      .from('complaints')
      .insert({
        category,
        description: description.trim(),
        image_url: imageUrl,
        lat,
        lng,
        status: 'pranuar',
        user_id: user?.id ?? null,
      })
      .select()
      .single();

    if (error) {
      setSubmitting(false);
      setSubmitError('Gabim gjatë dërgimit të ankesës. Ju lutemi provoni përsëri.');
      return;
    }

    if (data) {
      addReporterEntry({ complaintId: data.id, token: data.reporter_token });
    }

    setSubmitting(false);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setCategory('pothole');
      setDescription('');
      setImageFile(null);
      setImagePreview(null);
      setLat(null);
      setLng(null);
      setLocError(null);
      setSubmitError(null);
      if (pinMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(pinMarkerRef.current);
        pinMarkerRef.current = null;
      }
      onSubmitted();
    }, 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pb-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Raporto një problem</h2>
          <p className="text-sm text-slate-500 mt-1">Plotësoni formularin më poshtë për të raportuar një problem në komunën tuaj.</p>
          {user ? (
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
              <Check size={14} /> I kyçur si {user.email} — ankesa do të ruhet në historikun tuaj.
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-2">
              Po raportoni pa kyçje. Kyçuni për të ruajtur historikun e ankesave.
            </p>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Kategoria e problemit</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.entries(CATEGORY_LABELS) as [ComplaintCategory, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                  category === key
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Photo Upload */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Foto (opsionale)</label>
          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-200">
              <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 transition text-sm font-medium"
              >
                <Camera size={18} />
                Bëj foto
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 transition text-sm font-medium"
              >
                <Upload size={18} />
                Ngarko nga galeria
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0])}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0])}
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Lokacioni</label>
          <button
            type="button"
            onClick={() => {
              detectLocation();
            }}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition text-sm font-semibold disabled:opacity-60"
          >
            {locating ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
            {locating ? 'Duke gjetur lokacionin...' : 'Gjej lokacionin tim'}
          </button>
          {locError && (
            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
              <AlertCircle size={14} /> {locError}
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowManualMap((visible) => !visible)}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition text-sm font-semibold"
          >
            <MapPin size={18} /> {showManualMap ? 'Mbyll hartën manuale' : 'Hape hartën për zgjedhje manuale'}
          </button>
          {showManualMap && (
            <>
              <div ref={(node) => { miniMapRef.current = node; if (node) window.setTimeout(initMiniMap, 0); }} className="w-full h-64 mt-3 rounded-xl overflow-hidden border border-slate-200 z-0" style={{ minHeight: 256, position: 'relative', background: '#e2e8f0' }} />
              <p className="text-xs text-slate-500 mt-1.5">Klikoni në hartë ose tërhiqni pinin për të vendosur lokacionin e saktë.</p>
            </>
          )}          {lat !== null && lng !== null && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <Check size={14} /> Lokacioni i caktuar: {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Përshkrimi</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Përshkruani problemin shkurt..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-slate-400 mt-1 text-right">{description.length}/500</p>
        </div>

        {/* Error */}
        {submitError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertCircle size={16} /> {submitError}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || success}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60"
        >
          {submitting ? (
            <><Loader2 size={18} className="animate-spin" /> Duke dërguar...</>
          ) : success ? (
            <><Check size={18} /> Ankesa u dërgua!</>
          ) : (
            'Dërgo ankesën'
          )}
        </button>
      </div>
    </div>
  );
}
