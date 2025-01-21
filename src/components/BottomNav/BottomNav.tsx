import React, { useState } from 'react';
import { Home, Plus, Bell, Activity } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePostCreation } from '../../postCreationContext';
import NotificationBell from '../NotificationBell/NotificationBell';
import { useUser } from '../../userContext';
import './BottomNav.css';

const BottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { openPostModal } = usePostCreation();
    const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const { userId } = useUser();

    // Navigation items configuration
    const navItems = [
        {
            id: 'home',
            label: 'Home',
            icon: Home,
            action: () => navigate('/'),
            isActive: location.pathname === '/'
        },
        {
            id: 'post',
            label: 'Post',
            icon: Plus,
            action: openPostModal,
            isActive: false
        },
        {
            id: 'notifications',
            label: 'Alerts',
            icon: Bell,
            action: () => setShowNotifications(!showNotifications),
            isActive: showNotifications,
            badge: unreadCount > 0 ? unreadCount : undefined
        },
        {
            id: 'health',
            label: 'Health',
            icon: Activity,
            action: () => setIsHealthModalOpen(true),
            isActive: false
        }
    ];

    return (
        <>
            <nav className="bottom-nav">
                <div className="bottom-nav__container">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={item.action}
                            className={`bottom-nav__item ${item.isActive ? 'bottom-nav__item--active' : ''
                                }`}
                            aria-label={item.label}
                        >
                            {item.id === 'notifications' ? (
                                <>
                                    <div className="bottom-nav__icon-wrapper">
                                        <item.icon size={24} className="bottom-nav__icon" />
                                        {item.badge && (
                                            <span className="bottom-nav__badge">{item.badge > 9 ? '9+' : item.badge}</span>
                                        )}
                                    </div>
                                    <span className="bottom-nav__label">{item.label}</span>
                                    {userId && <NotificationBell
                                        userId={userId}
                                        isOpen={showNotifications}
                                        position="bottom"
                                        onUnreadCountChange={setUnreadCount}
                                    />}
                                </>
                            ) : (
                                <>
                                    <item.icon size={24} className="bottom-nav__icon" />
                                    <span className="bottom-nav__label">{item.label}</span>
                                </>
                            )}
                        </button>
                    ))}
                </div>
            </nav>

            {/* Placeholder Health Modal */}
            {isHealthModalOpen && (
                <div className="modal-overlay" onClick={() => setIsHealthModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>Coming Soon!</h2>
                        <p>Health tracking features are under development.</p>
                        <button
                            onClick={() => setIsHealthModalOpen(false)}
                            className="modal-close-button"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default BottomNav;
