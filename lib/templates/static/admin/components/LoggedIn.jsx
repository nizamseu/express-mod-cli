import React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'adminjs';
import { Box, CurrentUserNav } from '@adminjs/design-system';

/**
 * The user menu in the top bar: the themes to switch between, and Log out
 * (replaces AdminJS's own menu, which has no theme switcher).
 */
const LoggedIn = ({ session, paths }) => {
  const { translateButton } = useTranslation();
  const theme = useSelector((state) => state.theme);
  const back = window.location.pathname + window.location.search;

  const themeActions = (theme?.availableThemes || []).map((item) => ({
    label: `${item.id === theme.id ? '✓ ' : ''}${item.name}`,
    icon: 'Droplet',
    onClick: (event) => {
      event.preventDefault();
      window.location.href = `${paths.rootPath}/theme?id=${encodeURIComponent(item.id)}&back=${encodeURIComponent(back)}`;
    },
  }));

  const logout = {
    label: translateButton('logout'),
    icon: 'LogOut',
    onClick: (event) => {
      event.preventDefault();
      window.location.href = paths.logoutPath;
    },
  };

  return (
    <Box flexShrink={0} data-css="logged-in">
      <CurrentUserNav
        name={session.email}
        title={session.title}
        avatarUrl={session.avatarUrl}
        dropActions={[...themeActions, logout]}
      />
    </Box>
  );
};

export default LoggedIn;
