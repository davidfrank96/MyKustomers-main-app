export function redactDiagnosticText(value: string, secrets?: string[]): string;

export function preparePlaywrightArtifacts(options?: {
  inputDir?: string;
  outputDir?: string;
  secrets?: string[];
}): void;
