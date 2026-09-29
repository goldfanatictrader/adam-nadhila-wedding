import { useState } from 'react';
import {
  LayoutDashboard,
  Paintbrush,
  Wallet,
  Settings,
  Shield,
  ArrowUpRight,
  Menu,
} from 'lucide-react';
import BrandLogo from './ui/BrandLogo';
import Modal from './ui/Modal';
export default function AppShell({
  name,
  admin = false,
  active = 'app',
  children,
}: {
  name: string;
  admin?: boolean;
  active?: string;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    { href: '/app', label: 'Undangan saya', icon: LayoutDashboard, active: active === 'app' },
    { href: '/#templates', label: 'Koleksi template', icon: Paintbrush, active: false },
    { href: '/#pricing', label: 'Pilihan paket', icon: Wallet, active: false },
    { href: '/account', label: 'Akun & keamanan', icon: Settings, active: active === 'account' },
    ...(admin
      ? [{ href: '/superadmin', label: 'Superadmin', icon: Shield, active: active === 'admin' }]
      : []),
  ];
  const navigation = (mobile = false) => (
    <nav
      className="side-nav"
      aria-label={mobile ? 'Navigasi workspace mobile' : 'Navigasi workspace'}
    >
      {links.map(({ href, label, icon: Icon, active: selected }) => (
        <a
          key={href}
          className={`nav-item ${selected ? 'active' : ''}`}
          href={href}
          aria-current={selected ? 'page' : undefined}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
        </a>
      ))}
    </nav>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <a className="brand" href="/" aria-label="CELEYO — beranda">
            <BrandLogo decorative />
          </a>
        </div>
        <div>
          <p className="eyebrow">Ruang cerita Anda</p>
          {navigation()}
        </div>
        <div className="sidebar-help">
          <img src="/brand/symbol.svg" alt="" width="26" height="26" />
          <h3>Satu momen berarti.</h3>
          <p>Mulai dari cerita kecil. Jadikan undangan yang terasa seperti Anda.</p>
        </div>
        <div className="side-bottom">
          <a className="row" href="/account">
            <span className="avatar" aria-hidden="true">
              {name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong style={{ fontSize: 13 }}>{name}</strong>
              <div className="note">Akun & keamanan</div>
            </div>
          </a>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <span className="crumb">
            Ruang kerja{' '}
            <span aria-hidden="true" style={{ margin: '0 10px' }}>
              /
            </span>{' '}
            <strong>
              {active === 'admin' ? 'Superadmin' : active === 'account' ? 'Akun' : 'Undangan saya'}
            </strong>
          </span>
          <div className="mobile-header-left">
            <button
              className="icon-button mobile-nav-toggle"
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Buka navigasi workspace"
              aria-expanded={menuOpen}
            >
              <Menu size={20} />
            </button>
            <a href="/" className="brand mobile-brand" aria-label="CELEYO — beranda">
              <BrandLogo decorative />
            </a>
          </div>
          <div className="row">
            <a className="topbar-inspiration btn secondary small" href="/#templates">
              Lihat template <ArrowUpRight size={15} aria-hidden="true" />
            </a>
            {admin && active !== 'admin' && (
              <a className="btn secondary small" href="/superadmin">
                Admin
              </a>
            )}
            <a className="topbar-account" href="/account" aria-label={`Akun ${name}`}>
              <span className="topbar-name">{name.split(' ')[0]}</span>
              <span className="avatar" aria-hidden="true">
                {name.slice(0, 2).toUpperCase()}
              </span>
            </a>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="app-content">
          {children}
        </main>
      </div>
      {menuOpen && (
        <Modal
          title="Ruang cerita Anda"
          close={() => setMenuOpen(false)}
          className="mobile-app-nav"
        >
          {navigation(true)}
        </Modal>
      )}
    </div>
  );
}
