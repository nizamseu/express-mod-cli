import React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'adminjs';
import { Box, Button, FormGroup, H2, H5, Input, Label, MessageBox, Text } from '@adminjs/design-system';

/**
 * The login page of the panel, with a "Forgot your password?" link
 * (replaces AdminJS's own login page).
 */
const Login = () => {
  const { action, errorMessage } = window.__APP_STATE__ || {};
  const { translateComponent, translateMessage } = useTranslation();
  const branding = useSelector((state) => state.branding);
  // The login page only knows its form's address (<panel>/login)
  const forgotPath = String(action || '').replace(/\/login$/, '/forgot-password');
  const notice = new URLSearchParams(window.location.search).get('notice');
  // The login page doesn't get the user's theme from AdminJS; the theme switcher remembers it in a cookie
  const dark = /(?:^|;\s*)admin_theme=(?:dark|classic-dark|modern-dark)(?:;|$)/.test(document.cookie);

  return (
    <Box
      flex
      variant="grey"
      style={{ minHeight: '100vh', alignItems: 'center', justifyContent: 'center', ...(dark ? { background: '#151419' } : {}) }}
    >
      <Box
        bg="white"
        flex
        boxShadow="login"
        width={[1, 2 / 3, 'auto']}
        style={dark ? { background: '#1A1A1E', color: '#fff' } : undefined}
      >
        <Box bg="primary100" p="x3" width="340px" display={['none', 'none', 'block']} style={{ color: '#fff' }}>
          <H2 fontWeight="lighter" style={{ color: '#fff' }}>{translateComponent('Login.welcomeHeader')}</H2>
          <Text fontWeight="lighter" mt="default" style={{ color: '#fff' }}>
            {translateComponent('Login.welcomeMessage')}
          </Text>
        </Box>
        <Box as="form" action={action} method="POST" p="x3" width={['100%', '100%', '440px']}>
          <H5 marginBottom="xxl" style={dark ? { color: '#fff' } : undefined}>
            {branding.logo ? <img src={branding.logo} alt={branding.companyName} style={{ maxWidth: 200 }} /> : branding.companyName}
          </H5>
          {errorMessage && (
            <MessageBox
              my="lg"
              variant="danger"
              message={errorMessage.split(' ').length > 1 ? errorMessage : translateMessage(errorMessage)}
            />
          )}
          {notice === 'password-reset' && (
            <MessageBox my="lg" variant="success" message="Your password was changed. Log in with the new one." />
          )}
          <FormGroup>
            <Label required style={dark ? { color: '#CDCBD4' } : undefined}>{translateComponent('Login.properties.email')}</Label>
            <Input name="email" type="email" autoComplete="username" placeholder={translateComponent('Login.properties.email')} />
          </FormGroup>
          <FormGroup>
            <Label required style={dark ? { color: '#CDCBD4' } : undefined}>{translateComponent('Login.properties.password')}</Label>
            <Input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder={translateComponent('Login.properties.password')}
            />
          </FormGroup>
          <Text mt="xl" textAlign="center">
            <Button variant="contained">{translateComponent('Login.loginButton')}</Button>
          </Text>
          <Text mt="lg" textAlign="center">
            <a href={forgotPath} style={dark ? { color: '#8CB4FF' } : undefined}>Forgot your password?</a>
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
