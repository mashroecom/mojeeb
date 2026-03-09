'use client';

import { useState } from 'react';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';

interface TestData {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

const sampleData: TestData[] = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin', status: 'Active' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'User', status: 'Active' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'User', status: 'Inactive' },
  { id: 4, name: 'Diana Prince', email: 'diana@example.com', role: 'Moderator', status: 'Active' },
  { id: 5, name: 'Eve Davis', email: 'eve@example.com', role: 'User', status: 'Active' },
];

export default function TableAccessibilityTestPage() {
  const [loading, setLoading] = useState(false);

  const simulateLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 3000);
  };

  const columns = [
    {
      key: 'id',
      header: 'ID',
      sortable: false,
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
    },
  ];

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Table Accessibility Testing</h1>
        <p className="text-muted-foreground">
          This page is for testing the accessibility improvements to the Table component.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border p-6 bg-card">
        <h2 className="text-xl font-semibold">Test Instructions</h2>
        <div className="space-y-2 text-sm">
          <p><strong>Test 1: Loading State (aria-busy)</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Enable your screen reader (NVDA, JAWS, VoiceOver, or Orca)</li>
            <li>Click the "Simulate Loading" button below</li>
            <li>Navigate to or focus on the table</li>
            <li>Verify the screen reader announces "busy" or "loading"</li>
            <li>After 3 seconds, verify the busy state clears</li>
          </ul>

          <p className="pt-4"><strong>Test 2: Sortable Columns (aria-sort="none")</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Navigate to the table header row</li>
            <li>Move through each column header (Name, Email, Role, Status)</li>
            <li>Verify sortable columns are announced as "sortable" or "sortable, none"</li>
            <li>Verify the ID column (non-sortable) has no sorting announcement</li>
          </ul>

          <p className="pt-4"><strong>Test 3: Sort Indicators (aria-label)</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Navigate to a sortable column header (e.g., "Name")</li>
            <li>Listen for the complete announcement including chevron icons</li>
            <li>Verify "Sort ascending" and "Sort descending" are announced</li>
          </ul>

          <p className="pt-4"><strong>Test 4: Sort Interaction</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Focus on a sortable column header</li>
            <li>Press Enter or Space to activate sorting</li>
            <li>Verify "sorted ascending" is announced</li>
            <li>Press Enter/Space again, verify "sorted descending" is announced</li>
            <li>Press Enter/Space once more, verify it returns to "sortable, none"</li>
          </ul>

          <p className="pt-4"><strong>Test 5: Visual Appearance</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Verify the table looks normal (no visible ARIA text)</li>
            <li>Verify chevron icons display correctly and change opacity when sorting</li>
            <li>Verify skeleton rows display during loading</li>
            <li>Verify hover effects work on sortable columns</li>
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-4">
          <Button onClick={simulateLoading} disabled={loading}>
            {loading ? 'Loading...' : 'Simulate Loading (3s)'}
          </Button>
        </div>

        <Table
          columns={columns}
          data={sampleData}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No users found"
        />
      </div>

      <div className="space-y-4 rounded-lg border p-6 bg-card">
        <h2 className="text-xl font-semibold">Expected HTML Attributes</h2>
        <div className="space-y-2 text-sm font-mono bg-muted p-4 rounded">
          <p><strong>When loading:</strong></p>
          <p className="ml-4">&lt;table aria-busy="true"&gt;</p>

          <p className="pt-4"><strong>When not loading:</strong></p>
          <p className="ml-4">&lt;table&gt; (no aria-busy attribute)</p>

          <p className="pt-4"><strong>Sortable, unsorted column:</strong></p>
          <p className="ml-4">&lt;th aria-sort="none"&gt;</p>

          <p className="pt-4"><strong>Sorted ascending:</strong></p>
          <p className="ml-4">&lt;th aria-sort="ascending"&gt;</p>

          <p className="pt-4"><strong>Sorted descending:</strong></p>
          <p className="ml-4">&lt;th aria-sort="descending"&gt;</p>

          <p className="pt-4"><strong>Non-sortable column (ID):</strong></p>
          <p className="ml-4">&lt;th&gt; (no aria-sort attribute)</p>

          <p className="pt-4"><strong>Chevron icons:</strong></p>
          <p className="ml-4">&lt;svg aria-label="Sort ascending"&gt; (up chevron)</p>
          <p className="ml-4">&lt;svg aria-label="Sort descending"&gt; (down chevron)</p>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border p-6 bg-card">
        <h2 className="text-xl font-semibold">Browser DevTools Inspection</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Right-click on the table and select "Inspect"</li>
          <li>In the Elements panel, verify the attributes match the expected values above</li>
          <li>Click "Simulate Loading" and watch aria-busy appear and disappear</li>
          <li>Click column headers and watch aria-sort values change</li>
          <li>Open the Accessibility panel/inspector to see ARIA properties</li>
        </ol>
      </div>

      <div className="space-y-4 rounded-lg border p-6 bg-card border-green-500">
        <h2 className="text-xl font-semibold text-green-600">Acceptance Criteria</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Screen reader announces "busy" or "loading" when table is loading</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Screen reader announces sortable columns as "sortable" or "sortable, none"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Screen reader announces "Sort ascending" and "Sort descending" for chevron icons</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Sorting interaction announces state changes (ascending, descending, none)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Visual appearance unchanged for sighted users</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Keyboard navigation works correctly (Tab, Enter, Space)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
