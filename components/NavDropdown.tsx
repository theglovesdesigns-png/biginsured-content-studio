
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface DropdownItem {
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
}

interface NavDropdownProps {
    label: string;
    icon: React.ReactNode;
    items: DropdownItem[];
    isActive?: boolean;
}

const NavDropdown: React.FC<NavDropdownProps> = ({ label, icon, items, isActive }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const activeItem = items.find(item => item.isActive);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-center px-6 py-3 mx-2 font-black text-[12px] rounded-2xl transition-all duration-300 ease-in-out focus:outline-none shadow-sm transform hover:-translate-y-0.5 border-2 uppercase tracking-[0.1em] font-display
                ${
                    isActive || isOpen
                    ? 'bg-orange-600 text-white border-white shadow-[0_10px_20px_rgba(234,88,12,0.3)] ring-4 ring-orange-500/10'
                    : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 border-slate-200 dark:border-gray-700'
                }`}
            >
                <span className={isActive || isOpen ? 'text-white' : 'text-orange-600'}>{icon}</span>
                <span className="ml-2">{label}</span>
                <ChevronDown className={`ml-2 w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 space-y-1">
                        {items.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    item.onClick();
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left
                                ${
                                    item.isActive
                                    ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 font-bold'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                <span className={item.isActive ? 'text-orange-600' : 'text-slate-400'}>{item.icon}</span>
                                <span className="text-[11px] font-black uppercase tracking-widest">{item.label}</span>
                                {item.isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-600"></div>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NavDropdown;
