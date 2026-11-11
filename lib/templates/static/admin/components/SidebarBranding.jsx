import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Box } from '@adminjs/design-system';

/**
 * The top of the sidebar: the logo (ADMIN_LOGO) or the panel's title.
 * Classic themes show it on a blue band with a yellow title.
 * (Replaces AdminJS's own, whose dark theme shows the AdminJS logo.)
 */
const SidebarBranding = () => {
  const branding = useSelector((state) => state.branding);
  const theme = useSelector((state) => state.theme);
  const rootPath = useSelector((state) => state.paths.rootPath);
  const classic = theme?.id?.startsWith('classic');
  const modern = theme?.id?.startsWith('modern');

  const band = classic ? { background: theme.id === 'classic-dark' ? '#264b5d' : '#417690', color: '#f5dd5d' } : {};

  return (
    <Box data-css="sidebar-logo" flexShrink={0}>
      <Link
        to={rootPath}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: classic ? '18px 24px' : '24px',
          textDecoration: 'none',
          ...band,
        }}
      >
        {branding.logo ? (
          <img src={branding.logo} alt={branding.companyName} style={{ maxWidth: 170, maxHeight: 48 }} />
        ) : (
          <>
            {modern && (
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: theme.overrides?.colors?.primary100 || '#4f46e5',
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                {String(branding.companyName || 'A').charAt(0).toUpperCase()}
              </span>
            )}
            <span
              style={{
                fontSize: classic ? 18 : 20,
                fontWeight: classic ? 400 : 700,
                color: classic ? band.color : theme?.overrides?.colors?.text || '#0C1E29',
              }}
            >
              {branding.companyName}
            </span>
          </>
        )}
      </Link>
    </Box>
  );
};

export default SidebarBranding;
