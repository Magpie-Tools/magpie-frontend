export interface MapView {
  zoom: number;
  pan: [number, number];
}

export interface MapFrame {
  width: number;
  height: number;
  worldWidth: number;
  worldTop: number;
  worldBottom: number;
}

export const MAP_MAX_ZOOM = 8;
export const MAP_ZOOM_STEP = 1.25;
export const INITIAL_MAP_VIEW: MapView = {zoom: 1, pan: [0, 0]};

export function zoomMapView(view: MapView, factor: number, anchor: [number, number], minZoom: number): MapView {
  const zoom = Math.max(minZoom, Math.min(MAP_MAX_ZOOM, view.zoom * factor));
  if (Math.abs(zoom - view.zoom) < 1e-6) return view;
  const ratio = zoom / view.zoom;
  return {
    zoom,
    pan: [anchor[0] - (anchor[0] - view.pan[0]) * ratio, anchor[1] - (anchor[1] - view.pan[1]) * ratio],
  };
}

export function constrainMapView(view: MapView, frame: MapFrame): MapView {
  const width = frame.worldWidth * view.zoom;
  const x = ((view.pan[0] + width / 2) % width + width) % width - width / 2;
  const y = Math.min(-frame.worldTop * view.zoom, Math.max(frame.height - frame.worldBottom * view.zoom, view.pan[1]));
  return {zoom: view.zoom, pan: [Math.abs(x) < 1e-6 ? 0 : x, Math.abs(y) < 1e-6 ? 0 : y]};
}

export function mapWheelZoomFactor(event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>, pageHeight: number): number {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pageHeight : 1;
  return Math.exp(-Math.max(-1000, Math.min(1000, event.deltaY * unit)) * 0.002);
}

export function mapZoomKeyFactor(event: KeyboardEvent): number | undefined {
  if (event.ctrlKey || event.metaKey || event.altKey) return undefined;
  if (event.key === '+' || event.key === '=') return MAP_ZOOM_STEP;
  if (event.key === '-' || event.key === '_') return 1 / MAP_ZOOM_STEP;
  return undefined;
}

export function mapPanKeyStep(key: string): [number, number] | undefined {
  switch (key) {
    case 'ArrowLeft': return [32, 0];
    case 'ArrowRight': return [-32, 0];
    case 'ArrowUp': return [0, 32];
    case 'ArrowDown': return [0, -32];
    default: return undefined;
  }
}

export function svgMapPoint(svg: SVGSVGElement, event: MouseEvent): DOMPoint {
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
}
