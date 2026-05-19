import React, { useState, useEffect } from "react";
import { ShieldCheck, X } from "lucide-react";
import { useAdFreePopup } from "../context/AdFreePopupContext";

interface AdFreePlayerAdsProps {
  onClose?: () => void;
  onAccept?: () => void;
  adType?: "ad1" | "ad2";
  onAdClick?: () => void;
  variant?: "player" | "download" | "livetv";
}

const AdFreePlayerAds: React.FC<AdFreePlayerAdsProps> = ({
  onAccept,
}) => {
  const { handlePopupAccept } = useAdFreePopup();
  const finalOnAccept = onAccept || handlePopupAccept;

  const [bannerVisible, setBannerVisible] = useState(true);

  // Déclenche le callback de succès immédiatement au montage
  useEffect(() => {
    finalOnAccept();
  }, []);

  if (!bannerVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 12,
        padding: '8px 14px 8px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: 460,
        width: 'max-content',
        backdropFilter: 'blur(8px)',
      }}
    >
      <ShieldCheck size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
      <span style={{ color: 'rgba(255,255,255,0.80)', fontSize: 12, lineHeight: 1.4 }}>
        Pour une meilleure expérience sans pub, installez l'extension{' '}
        <strong style={{ color: '#fff' }}>uBlock Origin</strong>
      </span>
      <button
        onClick={() => setBannerVisible(false)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.45)',
          padding: 2,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
        aria-label="Fermer"
      >
        <X size={13} />
      </button>
    </div>
  );
};

export default AdFreePlayerAds;
