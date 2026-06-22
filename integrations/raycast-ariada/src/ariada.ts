/** One Ariada finding rendered as a Raycast row. */
export interface RaycastViolation {
  id: string;
  impact: string;
  description: string;
  helpUrl?: string;
}

/** Minimal Ariada CLI result consumed by the Raycast extension. */
export interface RaycastScanResult {
  url: string;
  status: 'pass' | 'fail';
  violations: RaycastViolation[];
  reportUrl?: string;
}

/** Serializable row model for Raycast list rendering. */
export interface RaycastListItem {
  title: string;
  subtitle: string;
  accessories: string[];
  actions: Array<{ title: string; url: string }>;
}

/** Builds the CLI argv used by the Raycast command. */
export function buildScanArgs(url: string): string[] {
  if (!/^https?:\/\/\S+$/iu.test(url)) {
    throw new Error('Raycast command expects an http or https URL');
  }
  return ['scan', url, '--format', 'json'];
}

/** Converts Ariada CLI JSON into Raycast list rows. */
export function toRaycastItems(result: RaycastScanResult): RaycastListItem[] {
  if (result.violations.length === 0) {
    return [
      {
        title: `PASS ${result.url}`,
        subtitle: 'No violations in the supplied Ariada result.',
        accessories: ['pass'],
        actions: result.reportUrl ? [{ title: 'Open report', url: result.reportUrl }] : []
      }
    ];
  }

  return result.violations.map((violation) => ({
    title: `${violation.impact.toUpperCase()} ${violation.id}`,
    subtitle: violation.description,
    accessories: [result.status],
    actions: [
      ...(violation.helpUrl ? [{ title: 'Open rule help', url: violation.helpUrl }] : []),
      ...(result.reportUrl ? [{ title: 'Open report', url: result.reportUrl }] : [])
    ]
  }));
}
