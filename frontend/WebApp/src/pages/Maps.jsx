import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchEvacuationSites } from '../services/api.js';

// Fix leaflet default icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function Maps() {
    const [sites, setSites] = React.useState([]);
    const mapRef = useRef(null);

    useEffect(() => {
        const loadSites = async () => {
            try {
                const data = await fetchEvacuationSites();
                setSites(data);
            } catch (error) {
                console.error("Error loading map markers:", error);
            }
        };
        loadSites();
    }, []);

    // Invalidate size when component mounts
    useEffect(() => {
        if (mapRef.current) {
            setTimeout(() => {
                mapRef.current.invalidateSize();
            }, 100);
        }
    }, [sites]);

    return (
        <div id="maps-view">
            <div className="custom-card">
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-700 section-title">Evacuation Centers Map</h2>
                <div id="map-container" className="w-full rounded-lg overflow-hidden border border-gray-200" style={{ height: 'min(70vh, 600px)', minHeight: '280px', zIndex: 1 }}>
                    <MapContainer
                        center={[14.6773, 120.9842]}
                        zoom={15}
                        style={{ height: '100%', width: '100%' }}
                        ref={mapRef}
                    >
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            maxZoom={19}
                            attribution="© OpenStreetMap contributors"
                        />
                        {sites.map((site, i) => {
                            if (site.latitude && site.longitude) {
                                return (
                                    <Marker key={i} position={[site.latitude, site.longitude]}>
                                        <Popup>
                                            <div className="text-center">
                                                <strong className="text-blue-700">{site.name}</strong><br />
                                                <span className="text-xs text-gray-600">{site.address}</span>
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            }
                            return null;
                        })}
                    </MapContainer>
                </div>
            </div>
        </div>
    );
}
