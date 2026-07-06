const core = await import('@dot/tactile-core');
const contract = await import('@dot/tactile-contract');

const resolution = contract.DOTPAD_320;
const grid = contract.createBlankGrid(resolution);
grid[0] = 1;
grid[resolution.cols + 1] = 1;

const hex = core.gridToHex(grid, resolution.cols, resolution.rows);
const roundTrip = core.hexToGrid(hex, resolution.cols, resolution.rows);
const dtms = core.buildDtmsJSON([{ canvasData: roundTrip, altText: 'node import check' }], 'NodeCheck', resolution.cols, resolution.rows);
const parsed = core.parseDtms(dtms);

const source = core.createSourceImageStateFromRgba(new Uint8ClampedArray([
  0, 0, 0, 255,
  255, 255, 255, 255,
  64, 64, 64, 255,
  255, 255, 255, 255,
]), 2, 2);
const dots = core.convertToDots(source, { method: 'global', threshold: 128, minComp: 1 }, 2, 2);

if (parsed.fileName !== 'NodeCheck') {
  throw new Error('DTMS parse failed after package import');
}
if (dots[0] !== 1 || dots[1] !== 0 || dots[2] !== 1 || dots[3] !== 0) {
  throw new Error('Engine conversion failed after package import');
}

console.log('Node import check passed');
