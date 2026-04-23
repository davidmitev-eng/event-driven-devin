jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

const { createWorkOrder, EQUIPMENT_CLASSES } = require('./industrials');

// Mock telemetry and external dependencies to isolate business logic
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

describe('createWorkOrder', () => {
  const validData = {
    equipmentId: 'EQ-001',
    equipmentCategory: 'rotating',
    issueType: 'preventive',
    priority: 'high',
    estimatedHours: 4,
    partsEstimate: 500,
  };

  it('should create a work order with a lowercase category', async () => {
    const result = await createWorkOrder(validData);
    expect(result.success).toBe(true);
    expect(result.workOrderId).toBeDefined();
    expect(result.costEstimate).toBeDefined();
    expect(result.costEstimate.labor).toBe(340);
    expect(result.costEstimate.materials).toBe(600);
    expect(result.costEstimate.total).toBe(940);
  });

  it('should create a work order with a capitalized category (frontend default)', async () => {
    const result = await createWorkOrder({
      ...validData,
      equipmentCategory: 'Rotating',
    });
    expect(result.success).toBe(true);
    expect(result.costEstimate).toBeDefined();
    expect(result.costEstimate.labor).toBe(340);
  });

  it('should create a work order with an uppercase category', async () => {
    const result = await createWorkOrder({
      ...validData,
      equipmentCategory: 'ROTATING',
    });
    expect(result.success).toBe(true);
    expect(result.costEstimate).toBeDefined();
  });

  it('should work for all equipment class categories', async () => {
    for (const cls of EQUIPMENT_CLASSES) {
      const result = await createWorkOrder({
        ...validData,
        equipmentCategory: cls.category,
      });
      expect(result.success).toBe(true);
      expect(result.costEstimate.labor).toBe(cls.laborRate * validData.estimatedHours);
      expect(result.costEstimate.materials).toBe(validData.partsEstimate * cls.partsMultiplier);
    }
  });

  it('should throw for an unknown equipment category', async () => {
    await expect(
      createWorkOrder({ ...validData, equipmentCategory: 'nonexistent' }),
    ).rejects.toThrow();
  });

  it('should throw when equipmentCategory is undefined', async () => {
    await expect(
      createWorkOrder({ ...validData, equipmentCategory: undefined }),
    ).rejects.toThrow();
  });

  it('should throw when equipmentCategory is null', async () => {
    await expect(
      createWorkOrder({ ...validData, equipmentCategory: null }),
    ).rejects.toThrow();
  });
});
