const { executeTrade } = require('./financial-services');

// Mock dependencies to isolate business logic
jest.mock('uuid', () => ({ v4: () => 'test-trade-id' }));
jest.mock('../../telemetry/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../telemetry/datadog', () => ({
  incrementMetric: jest.fn(),
  recordTiming: jest.fn(),
}));
jest.mock('../../telemetry/sentry', () => ({
  Sentry: { captureException: jest.fn() },
}));
jest.mock('../devin-session', () => ({
  createSessionAndAlert: jest.fn().mockResolvedValue({}),
}));

describe('executeTrade', () => {
  const baseTrade = {
    symbol: 'AAPL',
    side: 'buy',
    quantity: 10,
    price: 227.63,
    tierId: 1,
    accountId: 'ACCT-INV-001',
  };

  it('should execute a trade successfully with standard tier (tierId=1)', async () => {
    const result = await executeTrade({ ...baseTrade, tierId: 1 });
    expect(result.success).toBe(true);
    expect(result.symbol).toBe('AAPL');
    expect(result.side).toBe('buy');
    expect(result.quantity).toBe(10);
    expect(result.status).toBe('filled');
    expect(typeof result.fee).toBe('number');
    expect(result.fee).toBeGreaterThan(0);
    expect(typeof result.total).toBe('number');
  });

  it('should execute a trade successfully with active tier (tierId=2)', async () => {
    const result = await executeTrade({ ...baseTrade, tierId: 2 });
    expect(result.success).toBe(true);
    expect(result.status).toBe('filled');
    expect(typeof result.fee).toBe('number');
  });

  it('should execute a trade successfully with VIP tier (tierId=3)', async () => {
    const result = await executeTrade({ ...baseTrade, tierId: 3 });
    expect(result.success).toBe(true);
    expect(result.status).toBe('filled');
    const expectedTradeValue = 10 * 227.63;
    const vipRate = 0.001;
    const expectedFee = Math.round(Math.max(expectedTradeValue * vipRate, 0) * 100) / 100;
    expect(result.fee).toBe(expectedFee);
  });

  it('should execute a trade with string tierId from frontend', async () => {
    const result = await executeTrade({ ...baseTrade, tierId: '1' });
    expect(result.success).toBe(true);
    expect(result.status).toBe('filled');
  });

  it('should calculate correct fee for standard tier', async () => {
    const result = await executeTrade({ ...baseTrade, tierId: 1 });
    const expectedTradeValue = 10 * 227.63;
    const standardRate = 0.005;
    const minFee = 4.95;
    const expectedFee = Math.round(Math.max(expectedTradeValue * standardRate, minFee) * 100) / 100;
    expect(result.fee).toBe(expectedFee);
  });

  it('should throw for unknown tierId', async () => {
    await expect(executeTrade({ ...baseTrade, tierId: 99 })).rejects.toThrow(
      'Unknown commission tier: 99'
    );
  });

  it('should throw for null tierId', async () => {
    await expect(executeTrade({ ...baseTrade, tierId: null })).rejects.toThrow(
      'Unknown commission tier'
    );
  });

  it('should throw for undefined tierId', async () => {
    await expect(executeTrade({ ...baseTrade, tierId: undefined })).rejects.toThrow(
      'Unknown commission tier'
    );
  });

  it('should handle sell side correctly', async () => {
    const result = await executeTrade({ ...baseTrade, side: 'sell', tierId: 1 });
    expect(result.success).toBe(true);
    expect(result.side).toBe('sell');
    const tradeValue = 10 * 227.63;
    expect(result.total).toBeLessThan(tradeValue);
  });
});
