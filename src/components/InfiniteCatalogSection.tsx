import React from 'react';
import { Loader2 } from 'lucide-react';
import EmblaCarousel from './EmblaCarousel';
import { InfiniteCatalogRow } from '../utils/infiniteCatalogRows';

interface InfiniteCatalogSectionProps {
  rows: InfiniteCatalogRow[];
  isLoadingBatch: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  onLoadMoreRowItems: (rowId: string) => void;
  rowClassName?: string;
}

const InfiniteCatalogSection: React.FC<InfiniteCatalogSectionProps> = ({
  rows,
  isLoadingBatch,
  sentinelRef,
  onLoadMoreRowItems,
  rowClassName = 'mb-3 px-4 md:px-8',
}) => {
  return (
    <>
      {rows.map((row) => (
        <div key={row.id} className={`${rowClassName} infinite-carousel-row`}>
          <EmblaCarousel
            title={row.title}
            items={row.items as any}
            mediaType={row.recipe.mediaType === 'tv' ? 'series' : 'movie'}
            onLoadMore={() => onLoadMoreRowItems(row.id)}
            hasMore={row.hasMore}
            isLoadingMore={Boolean(row.isLoadingMore)}
          />
        </div>
      ))}

      <div
        ref={sentinelRef}
        aria-hidden="true"
        className="w-full h-16 flex items-center justify-center"
      >
        {isLoadingBatch && (
          <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
        )}
      </div>
    </>
  );
};

export default React.memo(InfiniteCatalogSection);
