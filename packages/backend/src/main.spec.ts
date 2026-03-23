import { MANIFEST_CSP_DIRECTIVES } from './common/constants/csp.constants';

describe('MANIFEST_CSP_DIRECTIVES', () => {
  it('allows Product Hunt badge images in img-src', () => {
    expect(MANIFEST_CSP_DIRECTIVES.imgSrc).toContain('https://api.producthunt.com');
  });
});
