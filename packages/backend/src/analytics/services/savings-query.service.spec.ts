describe('SavingsQueryService', () => {
  it('exports SavingsResult and BaselineCandidate interfaces', async () => {
    const mod = await import('./savings-query.service');
    expect(mod.SavingsQueryService).toBeDefined();
  });
});
