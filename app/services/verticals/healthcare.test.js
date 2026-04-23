jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

const { scheduleAppointment, PROVIDERS, PATIENT_PLANS } = require('./healthcare');

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

describe('scheduleAppointment', () => {
  const validInput = {
    patientId: 'PAT-2001',
    providerId: 'DR-101',
    department: 'primary-care',
    appointmentDate: '2026-06-15',
  };

  it('should succeed for a valid patient with active coverage', async () => {
    const result = await scheduleAppointment(validInput);

    expect(result.success).toBe(true);
    expect(result.appointmentId).toBeDefined();
    expect(result.patientId).toBe('PAT-2001');
    expect(result.copay).toBe(20);
    expect(result.provider).toBe('Dr. Sarah Kim');
    expect(result.status).toBe('confirmed');
  });

  it('should succeed for all known patients with valid coverage', async () => {
    for (const patientId of Object.keys(PATIENT_PLANS)) {
      const result = await scheduleAppointment({
        ...validInput,
        patientId,
      });
      expect(result.success).toBe(true);
      expect(result.copay).toBe(PATIENT_PLANS[patientId].copayAmount);
    }
  });

  it('should throw an error for an unknown patient ID', async () => {
    await expect(
      scheduleAppointment({
        ...validInput,
        patientId: 'PAT-UNKNOWN',
      })
    ).rejects.toThrow('No valid coverage found for patient PAT-UNKNOWN');
  });

  it('should throw an error when appointment date is past coverage end', async () => {
    await expect(
      scheduleAppointment({
        ...validInput,
        appointmentDate: '2027-06-15',
      })
    ).rejects.toThrow('No valid coverage found');
  });

  it('should return correct copay amounts per plan', async () => {
    const goldResult = await scheduleAppointment({ ...validInput, patientId: 'PAT-2001' });
    expect(goldResult.copay).toBe(20);

    const silverResult = await scheduleAppointment({ ...validInput, patientId: 'PAT-2002' });
    expect(silverResult.copay).toBe(35);

    const bronzeResult = await scheduleAppointment({ ...validInput, patientId: 'PAT-2003' });
    expect(bronzeResult.copay).toBe(50);
  });

  it('should resolve provider name from PROVIDERS list', async () => {
    const result = await scheduleAppointment({
      ...validInput,
      providerId: 'DR-102',
    });
    expect(result.provider).toBe('Dr. James Patel');
  });

  it('should fall back to providerId when provider is not found', async () => {
    const result = await scheduleAppointment({
      ...validInput,
      providerId: 'DR-999',
    });
    expect(result.provider).toBe('DR-999');
  });
});
