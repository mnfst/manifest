// Default mock for @mnfst/server — overridden per test via jest.doMock
module.exports = {
  start: jest.fn().mockResolvedValue({}),
  version: "0.0.0-mock",
};
