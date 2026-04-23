jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

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

const { scheduleAppointment, PROVIDERS, PATIENT_PLANS } = require('./healthcare');

describe('scheduleAppointment', () => {
  it('should schedule an appointment for a valid patient with coverage', async () => {
    const result = await scheduleAppointment({
      patientId: 'PAT-2001',
      providerId: 'DR-101',
      department: 'primary-care',
      appointmentDate: '2026-06-15',
    });

    expect(result.success).toBe(true);
    expect(result.patientId).toBe('PAT-2001');
    expect(result.provider).toBe('Dr. Sarah Kim');
    expect(result.copay).toBe(20);
    expect(result.status).toBe('confirmed');
    expect(result.appointmentId).toBeDefined();
  });

  it('should return the correct copay for each plan tier', async () => {
    const gold = await scheduleAppointment({
      patientId: 'PAT-2001',
      providerId: 'DR-101',
      department: 'primary-care',
      appointmentDate: '2026-06-15',
    });
    expect(gold.copay).toBe(20);

    const silver = await scheduleAppointment({
      patientId: 'PAT-2002',
      providerId: 'DR-102',
      department: 'cardiology',
      appointmentDate: '2026-06-15',
    });
    expect(silver.copay).toBe(35);

    const bronze = await scheduleAppointment({
      patientId: 'PAT-2003',
      providerId: 'DR-103',
      department: 'dermatology',
      appointmentDate: '2026-06-15',
    });
    expect(bronze.copay).toBe(50);
  });

  it('should throw an error for an unknown patient ID', async () => {
    await expect(
      scheduleAppointment({
        patientId: 'PAT-9999',
        providerId: 'DR-101',
        department: 'primary-care',
        appointmentDate: '2026-06-15',
      }),
    ).rejects.toThrow('No active coverage found for patient PAT-9999');
  });

  it('should throw an error when appointment date is beyond coverage period', async () => {
    await expect(
      scheduleAppointment({
        patientId: 'PAT-2001',
        providerId: 'DR-101',
        department: 'primary-care',
        appointmentDate: '2028-01-15',
      }),
    ).rejects.toThrow('No active coverage found for patient PAT-2001');
  });

  it('should use providerId as fallback when provider is not found', async () => {
    const result = await scheduleAppointment({
      patientId: 'PAT-2001',
      providerId: 'DR-999',
      department: 'primary-care',
      appointmentDate: '2026-06-15',
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('DR-999');
  });
});

describe('PATIENT_PLANS', () => {
  it('should have coverageEnd field (not coverageEndDate) for all plans', () => {
    for (const [, plan] of Object.entries(PATIENT_PLANS)) {
      expect(plan).toHaveProperty('coverageEnd');
      expect(plan.coverageEndDate).toBeUndefined();
      expect(new Date(plan.coverageEnd).getTime()).not.toBeNaN();
    }
  });

  it('should have copayAmount for all plans', () => {
    for (const [, plan] of Object.entries(PATIENT_PLANS)) {
      expect(typeof plan.copayAmount).toBe('number');
      expect(plan.copayAmount).toBeGreaterThan(0);
    }
  });
});

describe('PROVIDERS', () => {
  it('should contain valid provider entries', () => {
    expect(PROVIDERS.length).toBeGreaterThan(0);
    for (const provider of PROVIDERS) {
      expect(provider).toHaveProperty('id');
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('department');
      expect(provider).toHaveProperty('specialty');
    }
  });
});
