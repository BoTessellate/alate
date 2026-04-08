import {
  getBodyFigurineMetrics,
  getFocusFill,
  getHeightOptionLabel,
} from '../components/bodyFigurineModel';

describe('bodyFigurineModel', () => {
  it('widens shoulders for broad profiles and narrows them for narrow profiles', () => {
    const narrow = getBodyFigurineMetrics({ shoulders: 'narrow' });
    const average = getBodyFigurineMetrics({ shoulders: 'average' });
    const broad = getBodyFigurineMetrics({ shoulders: 'broad' });

    expect(narrow.shoulderHalf).toBeLessThan(average.shoulderHalf);
    expect(broad.shoulderHalf).toBeGreaterThan(average.shoulderHalf);
  });

  it('tightens the waist for defined bodies and relaxes it for straighter waists', () => {
    const defined = getBodyFigurineMetrics({ waist: 'defined' });
    const average = getBodyFigurineMetrics({ waist: 'average' });
    const straight = getBodyFigurineMetrics({ waist: 'undefined' });

    expect(defined.waistHalf).toBeLessThan(average.waistHalf);
    expect(straight.waistHalf).toBeGreaterThan(average.waistHalf);
  });

  it('adjusts hip and thigh mass by category', () => {
    const narrow = getBodyFigurineMetrics({ hips: 'narrow', thighs: 'slim' });
    const curvy = getBodyFigurineMetrics({ hips: 'extra-wide', thighs: 'full' });

    expect(curvy.hipHalf).toBeGreaterThan(narrow.hipHalf);
    expect(curvy.thighWidth).toBeGreaterThan(narrow.thighWidth);
  });

  it('rebalances torso length against leg length', () => {
    const shortTorso = getBodyFigurineMetrics({ torsoLength: 'short' });
    const longTorso = getBodyFigurineMetrics({ torsoLength: 'long' });

    expect(longTorso.crotchY).toBeGreaterThan(shortTorso.crotchY);
    expect(longTorso.kneeY - longTorso.crotchY).toBeLessThan(
      shortTorso.kneeY - shortTorso.crotchY
    );
  });

  it('maps height buckets to readable labels and figure scale', () => {
    const petite = getBodyFigurineMetrics({ heightCm: 155 });
    const tall = getBodyFigurineMetrics({ heightCm: 183 });

    expect(getHeightOptionLabel(155)).toBe("Under 5'3\"");
    expect(getHeightOptionLabel(183)).toBe("Over 5'11\"");
    expect(tall.figureScaleY).toBeGreaterThan(petite.figureScaleY);
  });

  it('returns a single active highlight region', () => {
    expect(getFocusFill('waist')).toEqual({
      height: false,
      shoulders: false,
      bust: false,
      waist: true,
      hips: false,
      thighs: false,
      torso: false,
    });
  });
});
