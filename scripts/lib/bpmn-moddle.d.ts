// The parts of bpmn-moddle that the content check uses. The package has no types of its own.
declare module 'bpmn-moddle' {
  export class BpmnModdle {
    fromXML(xml: string): Promise<{
      warnings: { message: string }[];
      elementsById: Record<string, unknown>;
    }>;
  }
}
