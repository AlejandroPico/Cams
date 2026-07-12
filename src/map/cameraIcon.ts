const CAMERA_SOURCE = 'data:image/png;base64,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';

const COLORS = {
  day: [255, 224, 63],
  twilight: [255, 145, 31],
  night: [46, 151, 255]
} as const;

async function loadSource(): Promise<ImageData> {
  const image = new Image();
  image.src = CAMERA_SOURCE;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 72;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D no disponible');
  context.drawImage(image, 0, 0, 96, 72);
  return context.getImageData(0, 0, 96, 72);
}

function outlined(source: ImageData, color: readonly [number, number, number]): ImageData {
  const { width, height, data } = source;
  const output = new ImageData(width, height);
  const radius = 3;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      let dilation = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          dilation = Math.max(dilation, data[(yy * width + xx) * 4 + 3]);
        }
      }

      if (alpha > 0) {
        output.data[index] = 2;
        output.data[index + 1] = 2;
        output.data[index + 2] = 2;
        output.data[index + 3] = alpha;
      } else if (dilation > 0) {
        output.data[index] = color[0];
        output.data[index + 1] = color[1];
        output.data[index + 2] = color[2];
        output.data[index + 3] = dilation;
      }
    }
  }
  return output;
}

export async function createCameraIcons(): Promise<Record<keyof typeof COLORS, ImageData>> {
  const source = await loadSource();
  return {
    day: outlined(source, COLORS.day),
    twilight: outlined(source, COLORS.twilight),
    night: outlined(source, COLORS.night)
  };
}
