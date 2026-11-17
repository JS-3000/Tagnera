import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** Renders a QR code as inline SVG (sharp on screen and in print). */
export function QrCode({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toString(text, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''));
    return () => {
      alive = false;
    };
  }, [text]);
  return <div className={`qr ${className ?? ''}`} style={style} dangerouslySetInnerHTML={{ __html: svg }} />;
}
