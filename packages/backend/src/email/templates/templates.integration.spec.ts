import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import { PasswordResetEmail } from './password-reset';
import { InvitationEmail } from './invitation';

describe('Email Templates Integration - Layout Consistency', () => {
  const passwordResetProps = {
    userName: 'Test User',
    resetLink: 'https://example.com/reset',
    expiresIn: '1 hour',
    appName: 'TestApp',
  };

  const invitationProps = {
    inviterName: 'Jane Doe',
    appName: 'TestApp',
    appLink: 'https://example.com/invite',
  };

  // Use ReactDOMServer for synchronous rendering in tests
  const renderToString = (element: React.ReactElement) => {
    return ReactDOMServer.renderToStaticMarkup(element);
  };

  describe('shared layout verification', () => {
    it('both templates should use the same base HTML structure', () => {
      const passwordResetHtml = renderToString(
        React.createElement(PasswordResetEmail, passwordResetProps),
      );
      const invitationHtml = renderToString(
        React.createElement(InvitationEmail, invitationProps),
      );

      // Both should have html element and meta charset
      expect(passwordResetHtml).toContain('<html');
      expect(invitationHtml).toContain('<html');

      // Both should have the same meta charset
      expect(passwordResetHtml).toContain('charset');
      expect(invitationHtml).toContain('charset');
    });

    it('both templates should include consistent header styling', () => {
      const passwordResetHtml = renderToString(
        React.createElement(PasswordResetEmail, passwordResetProps),
      );
      const invitationHtml = renderToString(
        React.createElement(InvitationEmail, invitationProps),
      );

      // Both should contain the app name in header area
      expect(passwordResetHtml).toContain('TestApp');
      expect(invitationHtml).toContain('TestApp');
    });

    it('both templates should include consistent footer', () => {
      const passwordResetHtml = renderToString(
        React.createElement(PasswordResetEmail, passwordResetProps),
      );
      const invitationHtml = renderToString(
        React.createElement(InvitationEmail, invitationProps),
      );

      // Both should have footer text about company/support
      expect(passwordResetHtml).toContain('This email was sent by');
      expect(invitationHtml).toContain('This email was sent by');

      // Both should mention support
      expect(passwordResetHtml).toContain('support');
      expect(invitationHtml).toContain('support');
    });

    it('both templates should use the same primary color for buttons', () => {
      const passwordResetHtml = renderToString(
        React.createElement(PasswordResetEmail, passwordResetProps),
      );
      const invitationHtml = renderToString(
        React.createElement(InvitationEmail, invitationProps),
      );

      // Both should contain the primary color (#4F46E5)
      expect(passwordResetHtml).toContain('#4F46E5');
      expect(invitationHtml).toContain('#4F46E5');
    });

    it('both templates should have a fallback URL section', () => {
      const passwordResetHtml = renderToString(
        React.createElement(PasswordResetEmail, passwordResetProps),
      );
      const invitationHtml = renderToString(
        React.createElement(InvitationEmail, invitationProps),
      );

      // Both should have the fallback URL copy instruction (checking key phrase)
      expect(passwordResetHtml).toContain('copy and paste');
      expect(invitationHtml).toContain('copy and paste');

      // Both should contain their respective action URLs as fallback
      expect(passwordResetHtml).toContain('https://example.com/reset');
      expect(invitationHtml).toContain('https://example.com/invite');
    });

    it('both templates should use the same font family', () => {
      const passwordResetHtml = renderToString(
        React.createElement(PasswordResetEmail, passwordResetProps),
      );
      const invitationHtml = renderToString(
        React.createElement(InvitationEmail, invitationProps),
      );

      // Both should reference the same font family
      expect(passwordResetHtml).toContain('Inter');
      expect(invitationHtml).toContain('Inter');
    });

    it('both templates should have consistent container max-width', () => {
      const passwordResetHtml = renderToString(
        React.createElement(PasswordResetEmail, passwordResetProps),
      );
      const invitationHtml = renderToString(
        React.createElement(InvitationEmail, invitationProps),
      );

      // Both should have 600px max-width (standard email width)
      expect(passwordResetHtml).toContain('600px');
      expect(invitationHtml).toContain('600px');
    });
  });

  describe('template-specific content', () => {
    it('password reset should have unique reset-specific content', () => {
      const html = renderToString(
        React.createElement(PasswordResetEmail, passwordResetProps),
      );

      expect(html).toContain('Reset Your Password');
      expect(html).toContain('Reset Password'); // Button text
      expect(html).toContain('expire');
    });

    it('invitation should have unique invitation-specific content', () => {
      const html = renderToString(
        React.createElement(InvitationEmail, invitationProps),
      );

      // Note: Apostrophe gets HTML-encoded to &#x27; by ReactDOMServer
      expect(html).toContain('Been Invited');
      expect(html).toContain('Accept Invitation'); // Button text
      expect(html).toContain('invited you to');
    });
  });
});
