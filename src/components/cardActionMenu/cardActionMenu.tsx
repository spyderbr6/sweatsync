// src/components/cardActionMenu/cardActionMenu.tsx
import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';
import './cardActionMenu.css';

export interface Action {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
  show?: boolean;
}

export interface ActionMenuProps {
  actions: Action[];
  position?: 'left' | 'right';
}

const ActionMenu: React.FC<ActionMenuProps> = ({
  actions,
  position = 'right'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visibleActions = actions.filter(action => action.show !== false);

  if (visibleActions.length === 0) return null;

  return (
    <div className="action-menu" ref={menuRef}>
      <button
        type="button"
        className="action-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open menu"
      >

        <MoreHorizontal size={20} />

      </button>

      {isOpen && (
        <div
          className={`action-dropdown ${position === 'left' ? 'left' : 'right'}`}
          role="menu"
        >
          {visibleActions.map((action, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                action.onClick();
                setIsOpen(false);
              }}
              className={`action-item ${action.destructive ? 'destructive' : ''}`}
              disabled={action.disabled}
              role="menuitem"
            >
              <span className="action-icon">{action.icon}</span>
              <span className="action-label">{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActionMenu;