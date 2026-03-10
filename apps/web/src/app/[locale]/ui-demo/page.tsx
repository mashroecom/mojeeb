import { StatusDot } from '@/components/ui/StatusDot';

export default function UIDemoPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">UI Component Demo</h1>
        <p className="text-muted-foreground">Test page for verifying UI components</p>
      </div>

      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">StatusDot Component</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Hover over each dot to see the tooltip with human-readable status label. This addresses
          WCAG 2.1 SC 1.4.1 (color not sole indicator).
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <StatusDot status="online" size="md" />
            <span>Online (green) - Should show "Online" tooltip</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot status="offline" size="md" />
            <span>Offline (gray) - Should show "Offline" tooltip</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot status="active" size="md" />
            <span>Active (blue) - Should show "Active" tooltip</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot status="warning" size="md" />
            <span>Warning (yellow) - Should show "Warning" tooltip</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot status="error" size="md" />
            <span>Error (red) - Should show "Error" tooltip</span>
          </div>
        </div>

        <div className="mt-6 p-4 bg-muted rounded">
          <p className="text-sm font-semibold mb-2">Accessibility Testing:</p>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>Hover each dot - tooltip should appear</li>
            <li>Tab through dots - tooltip should appear on focus</li>
            <li>Check console - should be no errors</li>
            <li>Screen reader - aria-label should still announce status</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
