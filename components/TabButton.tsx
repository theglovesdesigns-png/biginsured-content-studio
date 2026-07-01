
import React from 'react';

interface TabButtonProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, icon, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center px-6 py-3 mx-2 font-bold text-sm sm:text-base rounded-2xl transition-all duration-300 ease-in-out focus:outline-none shadow-sm transform hover:-translate-y-0.5 border-2 uppercase tracking-tight font-display
        ${
          isActive
            ? 'bg-orange-600 text-white border-white shadow-[0_10px_20px_rgba(234,88,12,0.3)] ring-4 ring-orange-500/10'
            : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 border-slate-200 dark:border-gray-700'
        }`}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className={isActive ? 'text-white' : 'text-orange-600'}>{icon}</span>
      <span className="ml-2">{label}</span>
    </button>
  );
};

export default TabButton;
