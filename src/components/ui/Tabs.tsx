import React from 'react';
import { motion } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="flex gap-4 mb-8">
      {tabs.map((tab) => (
        <motion.button
          key={tab.id}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 rounded-lg transition-colors ${
            activeTab === tab.id
              ? 'bg-white/15 hover:bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(0,0,0,0.3)] text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {tab.label} {tab.count !== undefined && `(${tab.count})`}
        </motion.button>
      ))}
    </div>
  );
}; 