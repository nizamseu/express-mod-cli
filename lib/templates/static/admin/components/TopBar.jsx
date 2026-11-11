import React from 'react';
import { useSelector } from 'react-redux';
import { OriginalTopBar, useNavigationResources } from 'adminjs';
import { Box, Button, DropDown, DropDownItem, DropDownMenu, DropDownTrigger, Icon } from '@adminjs/design-system';
import LoggedIn from './LoggedIn';
import SidebarBranding from './SidebarBranding';

/** One entry of the top menu: a section with its pages, or a single page */
const MenuEntry = ({ element }) => {
  if (!element.elements?.length) {
    return (
      <Button as="a" href={element.href} onClick={element.onClick} color={element.isSelected ? 'primary' : 'text'} mr="sm">
        {element.icon && <Icon icon={element.icon} />}
        {element.label}
      </Button>
    );
  }

  const selected = element.elements.some((item) => item.isSelected);
  return (
    <DropDown>
      <DropDownTrigger>
        <Button color={selected ? 'primary' : 'text'} mr="sm">
          {element.icon && <Icon icon={element.icon} />}
          {element.label}
          <Icon icon="ChevronDown" />
        </Button>
      </DropDownTrigger>
      <DropDownMenu>
        {element.elements.map((item) => (
          <DropDownItem key={item.href} as="a" href={item.href} onClick={item.onClick}>
            {item.label}
          </DropDownItem>
        ))}
      </DropDownMenu>
    </DropDown>
  );
};

/**
 * The top bar. In the Top Menu theme it holds the title, the sections as menus and the
 * user menu (with the theme switcher); the other themes use AdminJS's own top bar.
 */
const TopBar = (props) => {
  const theme = useSelector((state) => state.theme);
  const resources = useSelector((state) => state.resources);
  const session = useSelector((state) => state.session);
  const paths = useSelector((state) => state.paths);
  const elements = useNavigationResources(resources);

  if (theme?.id !== 'top-menu') {
    return <OriginalTopBar {...props} />;
  }

  return (
    <Box
      data-css="topbar"
      flex
      flexDirection="row"
      alignItems="center"
      height="navbarHeight"
      bg="container"
      style={{ flexShrink: 0, borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}
    >
      <SidebarBranding />
      <Box as="nav" flex alignItems="center" style={{ flexWrap: 'wrap' }}>
        {elements.map((element) => (
          <MenuEntry key={element.label} element={element} />
        ))}
      </Box>
      <Box flexGrow={1} />
      {session?.email && <LoggedIn session={session} paths={paths} />}
    </Box>
  );
};

export default TopBar;
