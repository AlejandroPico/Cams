const COLORS = {
  day: '#ffe03f',
  twilight: '#ff911f',
  night: '#2e97ff'
} as const;

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawCamera(context: CanvasRenderingContext2D, outline: string) {
  context.clearRect(0, 0, 72, 54);
  context.save();
  context.shadowColor = outline;
  context.shadowBlur = 6;
  context.lineJoin = 'round';
  context.lineCap = 'round';

  context.fillStyle = '#030405';
  context.strokeStyle = outline;
  context.lineWidth = 5;

  roundedRect(context, 10, 17, 52, 30, 5);
  context.fill();
  context.stroke();

  context.beginPath();
  context.moveTo(22, 17);
  context.lineTo(27, 10);
  context.lineTo(43, 10);
  context.lineTo(48, 17);
  context.closePath();
  context.fill();
  context.stroke();

  context.shadowBlur = 0;
  context.beginPath();
  context.arc(36, 32, 10, 0, Math.PI * 2);
  context.fillStyle = '#101722';
  context.fill();
  context.strokeStyle = '#eef6ff';
  context.lineWidth = 2.5;
  context.stroke();

  context.beginPath();
  context.arc(36, 32, 4.5, 0, Math.PI * 2);
  context.fillStyle = outline;
  context.globalAlpha = 0.9;
  context.fill();
  context.restore();
}

function createIcon(color: string): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = 72;
  canvas.height = 54;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D no disponible');
  drawCamera(context, color);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

export async function createCameraIcons(): Promise<Record<keyof typeof COLORS, ImageData>> {
  return {
    day: createIcon(COLORS.day),
    twilight: createIcon(COLORS.twilight),
    night: createIcon(COLORS.night)
  };
}
