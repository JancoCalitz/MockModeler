import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import { useEffect, useRef, useState } from 'react';

interface Canvas {
  zoom(level: 'fit-viewport'): void;
  addMarker(element: string, marker: string): void;
}

interface BpmnCanvasProps {
  xml: string;
  highlight: readonly string[];
  label: string;
}

// A read-only diagram that can be dragged and zoomed. The bpmn.io logo it draws must stay, under
// bpmn-js's licence.
export default function BpmnCanvas({ xml, highlight, label }: BpmnCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const viewer = new NavigatedViewer({ container: container.current! });
    let active = true;
    viewer
      .importXML(xml)
      .then(() => {
        if (!active) return;
        const canvas = viewer.get<Canvas>('canvas');
        canvas.zoom('fit-viewport');
        for (const element of highlight) canvas.addMarker(element, 'diagram-highlight');
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      viewer.destroy();
    };
  }, [xml, highlight]);

  if (failed) {
    return (
      <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">
        This diagram could not be drawn. Use its description below instead.
      </p>
    );
  }
  return (
    <div
      ref={container}
      role="img"
      aria-label={label}
      data-testid="bpmn-diagram"
      className="h-72 w-full overflow-hidden rounded border border-slate-300 bg-[#ffffff]"
    />
  );
}
