// Avery Zweckform A4 label sheets. All sizes in millimetres.
// Values from the manufacturer's templates; small printer tolerances can be
// corrected with the X/Y offset on the label page.

export interface LabelFormat {
  id: string;
  name: string;
  description: string;
  width: number; // label width
  height: number; // label height
  cols: number;
  rows: number;
  marginTop: number;
  marginLeft: number;
  pitchX: number; // distance from left edge of one label to the next
  pitchY: number;
}

export const LABEL_FORMATS: LabelFormat[] = [
  {
    id: 'L6009',
    name: 'Avery L6009',
    description: '45,7 × 21,2 mm · 48 pro Blatt · Polyester silber, robust',
    width: 45.7,
    height: 21.2,
    cols: 4,
    rows: 12,
    marginTop: 21.5,
    marginLeft: 9.75,
    pitchX: 48.3,
    pitchY: 21.2,
  },
  {
    id: 'L6011',
    name: 'Avery L6011',
    description: '63,5 × 29,6 mm · 27 pro Blatt · Polyester silber, robust',
    width: 63.5,
    height: 29.6,
    cols: 3,
    rows: 9,
    marginTop: 15.3,
    marginLeft: 7.25,
    pitchX: 66.0,
    pitchY: 29.6,
  },
  {
    id: 'L6012',
    name: 'Avery L6012',
    description: '96 × 50,8 mm · 10 pro Blatt · Polyester silber, robust',
    width: 96,
    height: 50.8,
    cols: 2,
    rows: 5,
    marginTop: 21.5,
    marginLeft: 7.5,
    pitchX: 99,
    pitchY: 50.8,
  },
  {
    id: 'L4778',
    name: 'Avery L4778',
    description: '45,7 × 21,2 mm · 48 pro Blatt · wetterfest, weiß',
    width: 45.7,
    height: 21.2,
    cols: 4,
    rows: 12,
    marginTop: 21.5,
    marginLeft: 9.75,
    pitchX: 48.3,
    pitchY: 21.2,
  },
  {
    id: 'L4773',
    name: 'Avery L4773',
    description: '63,5 × 33,9 mm · 24 pro Blatt · wetterfest, weiß',
    width: 63.5,
    height: 33.9,
    cols: 3,
    rows: 8,
    marginTop: 12.9,
    marginLeft: 7.25,
    pitchX: 66.0,
    pitchY: 33.9,
  },
  {
    id: 'L7163',
    name: 'Avery L7163',
    description: '99,1 × 38,1 mm · 14 pro Blatt · Papier',
    width: 99.1,
    height: 38.1,
    cols: 2,
    rows: 7,
    marginTop: 15.15,
    marginLeft: 4.65,
    pitchX: 101.6,
    pitchY: 38.1,
  },
];

export const perSheet = (f: LabelFormat) => f.cols * f.rows;
