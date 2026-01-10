import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import { InvitationEmail, getInvitationSubject } from './invitation';

describe('InvitationEmail', () => {
  const defaultProps = {
    inviterName: 'Jane Smith',
    appName: 'Manifest',
    appLink: 'https://example.com/invite?code=abc123',
  };

  // Use ReactDOMServer for synchronous rendering in tests
  const renderToString = (element: React.ReactElement) => {
    return ReactDOMServer.renderToStaticMarkup(element);
  };

  describe('render', () => {
    it('should render the email successfully', () => {
      const html = renderToString(React.createElement(InvitationEmail, defaultProps));

      expect(html).toBeDefined();
      expect(html.length).toBeGreaterThan(0);
    });

    it('should include the inviter name', () => {
      const html = renderToString(React.createElement(InvitationEmail, defaultProps));

      expect(html).toContain('Jane Smith');
    });

    it('should include the app name', () => {
      const html = renderToString(React.createElement(InvitationEmail, defaultProps));

      expect(html).toContain('Manifest');
    });

    it('should include the app link', () => {
      const html = renderToString(React.createElement(InvitationEmail, defaultProps));

      expect(html).toContain('https://example.com/invite?code=abc123');
    });

    it('should include the Accept Invitation button', () => {
      const html = renderToString(React.createElement(InvitationEmail, defaultProps));

      expect(html).toContain('Accept Invitation');
    });

    it('should include personal message when provided', () => {
      const props = {
        ...defaultProps,
        personalMessage: 'Looking forward to collaborating with you!',
      };
      const html = renderToString(React.createElement(InvitationEmail, props));

      expect(html).toContain('Looking forward to collaborating with you!');
    });

    it('should truncate long inviter names', () => {
      const longName = 'A'.repeat(100);
      const props = { ...defaultProps, inviterName: longName };
      const html = renderToString(React.createElement(InvitationEmail, props));

      // Should be truncated to 50 chars + '...'
      expect(html).toContain('A'.repeat(50) + '...');
      expect(html).not.toContain('A'.repeat(51));
    });

    it('should truncate long app names', () => {
      const longName = 'B'.repeat(100);
      const props = { ...defaultProps, appName: longName };
      const html = renderToString(React.createElement(InvitationEmail, props));

      // Should be truncated to 50 chars + '...'
      expect(html).toContain('B'.repeat(50) + '...');
      expect(html).not.toContain('B'.repeat(51));
    });
  });

  describe('getInvitationSubject', () => {
    it('should return subject with inviter and app name', () => {
      const subject = getInvitationSubject('John', 'TestApp');

      expect(subject).toBe('John invited you to TestApp');
    });

    it('should truncate long names in subject', () => {
      const longInviter = 'A'.repeat(50);
      const longApp = 'B'.repeat(50);
      const subject = getInvitationSubject(longInviter, longApp);

      // Should truncate to 30 chars each + '...'
      expect(subject).toContain('A'.repeat(30) + '...');
      expect(subject).toContain('B'.repeat(30) + '...');
    });
  });
});
