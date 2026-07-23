import { useEffect } from "react";
import { useAdFreePopup } from "../context/AdFreePopupContext";

interface AdFreePlayerAdsProps {
  onClose?: () => void;
  onAccept?: () => void;
  adType?: "ad1" | "ad2";
  onAdClick?: () => void;
  variant?: "player" | "download";
}

const AdFreePlayerAds: React.FC<AdFreePlayerAdsProps> = ({
  onAccept,
}) => {
  const { handlePopupAccept } = useAdFreePopup();
  const finalOnAccept = onAccept || handlePopupAccept;

  // Déclenche le callback de succès immédiatement au montage
  useEffect(() => {
    finalOnAccept();
  }, []);

  return null;
};

export default AdFreePlayerAds;
