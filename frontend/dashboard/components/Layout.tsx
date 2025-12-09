import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from './Layout.module.css';

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const router = useRouter();
    const [userRole, setUserRole] = useState<string>('');
    const [isAuth, setIsAuth] = useState(false);

    // Pages that don't need the sidebar layout
    const noLayoutPages = ['/login', '/oauth-callback'];
    const isNoLayout = noLayoutPages.includes(router.pathname);

    useEffect(() => {
        // Check auth
        if (typeof window !== 'undefined') {
            const token = window.localStorage.getItem('auth_token');
            const role = window.localStorage.getItem('auth_role');

            if (!token && !isNoLayout) {
                router.push('/login');
            } else if (token) {
                setIsAuth(true);
                setUserRole(role || 'viewer');
            }
        }
    }, [router.pathname, isNoLayout]);

    const handleLogout = () => {
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem('auth_token');
            window.localStorage.removeItem('auth_role');
            window.localStorage.removeItem('auth_user_id');
            router.push('/login');
        }
    };

    if (isNoLayout) {
        return <>{children}</>;
    }

    // Prevent flash of layout before auth check
    if (!isAuth) {
        return null;
    }

    const navItems = [
        { name: 'Campaigns', path: '/campaigns', icon: '🚀' },
        { name: 'Review Profiles', path: '/review', icon: '👀' },
        { name: 'Analytics', path: '/analytics', icon: '📊' },
        { name: 'Cloak System', path: '/cloak', icon: '🎭' },
        { name: 'System Status', path: '/status', icon: '📡' },
    ];

    return (
        <div className={styles.container}>
            {/* Sidebar navigation */}
            <aside className={styles.sidebar}>
                <div className={styles.logo}>
                    🚀 <span>Bombardier</span>
                </div>

                <nav className={styles.nav}>
                    {navItems.map((item) => (
                        <Link key={item.path} href={item.path} legacyBehavior>
                            <a className={`${styles.navItem} ${router.pathname === item.path ? styles.active : ''}`}>
                                <span className={styles.icon}>{item.icon}</span>
                                {item.name}
                            </a>
                        </Link>
                    ))}
                </nav>

                <div className={styles.footer}>
                    <div className={styles.userProfile}>
                        <div className={styles.avatar}>
                            {userRole.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>User</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{userRole}</div>
                        </div>
                    </div>
                    <button onClick={handleLogout} className={styles.logoutBtn}>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main content area */}
            <main className={styles.main}>
                <header className={styles.header}>
                    <h2 className={styles.pageTitle}>
                        {navItems.find(i => i.path === router.pathname)?.name || 'Dashboard'}
                    </h2>
                    <div className={styles.statusIndicator}>
                        <span className={styles.dot}></span>
                        System Online
                    </div>
                </header>

                <div className={styles.content}>
                    {children}
                </div>
            </main>
        </div>
    );
}
