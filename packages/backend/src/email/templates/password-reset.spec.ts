import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import { PasswordResetEmail, getPasswordResetSubject } from './password-reset';

describe('PasswordResetEmail', () => {
  const defaultProps = {
    userName: 'John Doe',
    resetLink: 'https://example.com/reset?token=abc123',
    expiresIn: '1 hour',
    appName: 'TestApp',
  };

  // Use ReactDOMServer for synchronous rendering in tests
  const renderToString = (element: React.ReactElement) => {
    return ReactDOMServer.renderToStaticMarkup(element);
  };

  describe('render', () => {
    it('should render the email successfully', () => {
      const html = renderToString(React.createElement(PasswordResetEmail, defaultProps));

      expect(html).toBeDefined();
      expect(html.length).toBeGreaterThan(0);
    });

    it('should include the user name', () => {
      const html = renderToString(React.createElement(PasswordResetEmail, defaultProps));

      expect(html).toContain('John Doe');
    });

    it('should include the reset link', () => {
      const html = renderToString(React.createElement(PasswordResetEmail, defaultProps));

      expect(html).toContain('https://example.com/reset?token=abc123');
    });

    it('should include the expiration time', () => {
      const html = renderToString(React.createElement(PasswordResetEmail, defaultProps));

      expect(html).toContain('1 hour');
    });

    it('should include the app name in header', () => {
      const html = renderToString(React.createElement(PasswordResetEmail, defaultProps));

      expect(html).toContain('TestApp');
    });

    it('should include the Reset Password button', () => {
      const html = renderToString(React.createElement(PasswordResetEmail, defaultProps));

      expect(html).toContain('Reset Password');
    });

    it('should truncate long user names', () => {
      const longName = 'A'.repeat(100);
      const props = { ...defaultProps, userName: longName };
      const html = renderToString(React.createElement(PasswordResetEmail, props));

      // Should be truncated to 50 chars + '...'
      expect(html).toContain('A'.repeat(50) + '...');
      expect(html).not.toContain('A'.repeat(51));
    });

    it('should use default expiration if not provided', () => {
      const props = { ...defaultProps };
      delete (props as { expiresIn?: string }).expiresIn;
      const html = renderToString(React.createElement(PasswordResetEmail, props));

      expect(html).toContain('1 hour');
    });

    it('should use default app name if not provided', () => {
      const props = { ...defaultProps };
      delete (props as { appName?: string }).appName;
      const html = renderToString(React.createElement(PasswordResetEmail, props));

      expect(html).toContain('Manifest');
    });
  });

  describe('getPasswordResetSubject', () => {
    it('should return subject with app name', () => {
      const subject = getPasswordResetSubject('MyApp');

      expect(subject).toBe('Reset your MyApp password');
    });

    it('should use default app name if not provided', () => {
      const subject = getPasswordResetSubject();

      expect(subject).toBe('Reset your Manifest password');
    });
  });
});
