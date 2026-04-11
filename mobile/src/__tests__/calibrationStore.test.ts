import {
  useCalibrationStore,
  averageCalibration,
  deriveTypicalSize,
  type CalibrationGarment,
  type EstimatedMeasurements,
} from '../store/calibrationStore';

const baseGarment: Omit<CalibrationGarment, 'id' | 'addedAt'> = {
  brand: 'Levi',
  size: '28',
  category: 'bottom',
  fit: 'perfect',
  estimated: { bust_cm: 90, waist_cm: 70, hips_cm: 95, shoulders_cm: 38 },
};

describe('calibrationStore', () => {
  beforeEach(() => {
    useCalibrationStore.setState({ garments: [] });
  });

  describe('addGarment', () => {
    it('prepends new entries with generated id + timestamp', () => {
      useCalibrationStore.getState().addGarment(baseGarment);
      const state = useCalibrationStore.getState();
      expect(state.garments).toHaveLength(1);
      expect(state.garments[0].brand).toBe('Levi');
      expect(state.garments[0].id).toBeTruthy();
      expect(state.garments[0].addedAt).toBeTruthy();
    });

    it('caps the list at 20 entries (FIFO)', () => {
      for (let i = 0; i < 25; i += 1) {
        useCalibrationStore.getState().addGarment({
          ...baseGarment,
          brand: `Brand${i}`,
        });
      }
      const state = useCalibrationStore.getState();
      expect(state.garments).toHaveLength(20);
      // Most recent first
      expect(state.garments[0].brand).toBe('Brand24');
    });

    it('generates unique ids when added in the same millisecond', () => {
      useCalibrationStore.getState().addGarment(baseGarment);
      useCalibrationStore.getState().addGarment(baseGarment);
      const state = useCalibrationStore.getState();
      expect(state.garments[0].id).not.toBe(state.garments[1].id);
    });
  });

  describe('removeGarment', () => {
    it('removes only the matching id', () => {
      useCalibrationStore.getState().addGarment(baseGarment);
      useCalibrationStore.getState().addGarment({ ...baseGarment, brand: 'Other' });
      const idToRemove = useCalibrationStore.getState().garments[0].id;
      useCalibrationStore.getState().removeGarment(idToRemove);
      const state = useCalibrationStore.getState();
      expect(state.garments).toHaveLength(1);
      expect(state.garments[0].brand).toBe('Levi');
    });
  });

  describe('clearAll', () => {
    it('removes every entry', () => {
      useCalibrationStore.getState().addGarment(baseGarment);
      useCalibrationStore.getState().addGarment(baseGarment);
      useCalibrationStore.getState().clearAll();
      expect(useCalibrationStore.getState().garments).toHaveLength(0);
    });
  });
});

describe('averageCalibration', () => {
  it('returns null when no garments', () => {
    expect(averageCalibration([])).toBeNull();
  });

  it('rounds the per-field mean across all entries', () => {
    const garments: CalibrationGarment[] = [
      {
        id: '1',
        brand: 'A',
        size: 'M',
        category: 'top',
        fit: 'perfect',
        addedAt: '',
        estimated: { bust_cm: 90, waist_cm: 70, hips_cm: 95, shoulders_cm: 38 },
      },
      {
        id: '2',
        brand: 'B',
        size: 'M',
        category: 'top',
        fit: 'perfect',
        addedAt: '',
        estimated: { bust_cm: 94, waist_cm: 72, hips_cm: 99, shoulders_cm: 40 },
      },
    ];
    expect(averageCalibration(garments)).toEqual({
      bust_cm: 92,
      waist_cm: 71,
      hips_cm: 97,
      shoulders_cm: 39,
    });
  });

  it('handles a single garment by returning its measurements (rounded)', () => {
    const garments: CalibrationGarment[] = [
      {
        id: '1',
        brand: 'A',
        size: 'M',
        category: 'top',
        fit: 'perfect',
        addedAt: '',
        estimated: { bust_cm: 91.4, waist_cm: 70.6, hips_cm: 96, shoulders_cm: 38.5 },
      },
    ];
    expect(averageCalibration(garments)).toEqual({
      bust_cm: 91,
      waist_cm: 71,
      hips_cm: 96,
      shoulders_cm: 39, // 38.5 rounds to 39 with Math.round (banker would be 38 but JS uses half-away-from-zero)
    });
  });
});

describe('deriveTypicalSize', () => {
  it('returns null for null input', () => {
    expect(deriveTypicalSize(null)).toBeNull();
  });

  const make = (bust: number, hips: number): EstimatedMeasurements => ({
    bust_cm: bust,
    waist_cm: 70,
    hips_cm: hips,
    shoulders_cm: 38,
  });

  it('classifies XS for very small measurements', () => {
    const result = deriveTypicalSize(make(80, 84));
    expect(result?.size).toBe('XS');
    expect(result?.confidence).toBe('high');
  });

  it('classifies S for slightly small measurements', () => {
    // bust 80 → score 1, hips 90 → score 2, avg 1.5 → S, divergence 1 → medium
    const result = deriveTypicalSize(make(80, 90));
    expect(result?.size).toBe('S');
    expect(result?.confidence).toBe('medium');
  });

  it('classifies M for average measurements', () => {
    const result = deriveTypicalSize(make(92, 96));
    expect(result?.size).toBe('M');
    expect(result?.confidence).toBe('high');
  });

  it('classifies L for larger measurements', () => {
    const result = deriveTypicalSize(make(98, 102));
    expect(result?.size).toBe('L');
    expect(result?.confidence).toBe('high');
  });

  it('classifies XXL for extra-large measurements', () => {
    const result = deriveTypicalSize(make(110, 115));
    expect(result?.size).toBe('XXL');
    expect(result?.confidence).toBe('high');
  });

  it('marks confidence as medium when bust and hip scores diverge by 1', () => {
    // bust 86 → score 2 (S), hips 100 → score 3 (L). avg = 2.5 → M
    const result = deriveTypicalSize(make(86, 100));
    expect(result?.size).toBe('M');
    expect(result?.confidence).toBe('medium');
  });

  it('marks confidence as low when bust and hip scores diverge by 2+', () => {
    // bust 80 → score 1, hips 110 → score 4. avg = 2.5 → M
    const result = deriveTypicalSize(make(80, 110));
    expect(result?.confidence).toBe('low');
  });
});
