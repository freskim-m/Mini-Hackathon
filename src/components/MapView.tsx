import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Complaint, ComplaintStatus } from '@/lib/supabase';
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/lib/supabase';

interface MapViewProps {
  complaints: Complaint[];
  onPinClick?: (complaint: Complaint) => void;
}

function createPinIcon(status: ComplaintStatus): L.DivIcon {
  const color = STATUS_COLORS[status];
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="
      width: 28px;
      height: 28px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    "><div style="
      transform: rotate(45deg);
      width: 8px;
      height: 8px;
      background: white;
      border-radius: 50%;
    "></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

export default function MapView({ complaints, onPinClick }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const onPinClickRef = useRef(onPinClick);

  // Keep latest callback without re-triggering marker effect
  useEffect(() => {
    onPinClickRef.current = onPinClick;
  }, [onPinClick]);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [42.6629, 21.1655],
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Fix size after layout settles
    const fixSize = () => map.invalidateSize();
    fixSize();
    const resizeTimer = setTimeout(fixSize, 200);
    const resizeTimer2 = setTimeout(fixSize, 500);

    // Keep map sized correctly on window resize / mobile address bar changes
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(fixSize, 300));

    return () => {
      clearTimeout(resizeTimer);
      clearTimeout(resizeTimer2);
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when complaints change (not on callback change)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    complaints.forEach((complaint) => {
      const marker = L.marker([complaint.lat, complaint.lng], {
        icon: createPinIcon(complaint.status),
      }).addTo(map);

      marker.bindPopup(`
        <div style="min-width: 200px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${CATEGORY_LABELS[complaint.category]}</div>
          <div style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: ${STATUS_COLORS[complaint.status]}; color: white; margin-bottom: 8px;">
            ${STATUS_LABELS[complaint.status]}
          </div>
          <div style="font-size: 13px; color: #555; margin-bottom: 8px;">${complaint.description.length > 100 ? complaint.description.substring(0, 100) + '...' : complaint.description}</div>
          ${complaint.image_url ? `<img src="${complaint.image_url}" style="width: 100%; border-radius: 6px; max-height: 150px; object-fit: cover;" />` : ''}
        </div>
      `);

      const clickHandler = onPinClickRef.current;
      if (clickHandler) {
        marker.on('click', () => clickHandler(complaint));
      }

      markersRef.current.push(marker);
    });
  }, [complaints]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ position: 'absolute', inset: 0 }}
    />
  );
}
