'use client';

import { useState } from 'react';
import { QuickReply } from '@/components/mobile/QuickReply';
import { MessageCircle } from 'lucide-react';

export default function QuickReplyTestPage() {
  const [showQuickReply, setShowQuickReply] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>('');

  async function handleSend(message: string) {
    // Simulate sending a message
    setLastMessage(message);
    console.log('Sending message:', message);

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-card shadow-sm p-4">
        <h1 className="text-xl font-bold">Quick Reply Test</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Test the quick reply component with canned responses
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4">
        {/* Test conversation info */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold mb-2">Conversation Details</h2>
          <div className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Customer:</span> John Doe</p>
            <p><span className="text-muted-foreground">Conversation ID:</span> test-conv-123</p>
          </div>
        </div>

        {/* Last sent message preview */}
        {lastMessage && (
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-semibold mb-2 text-sm">Last Sent Message:</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {lastMessage}
            </p>
          </div>
        )}

        {/* Instructions */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <h3 className="font-semibold mb-2 text-sm">Test Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>Click the "Quick Reply" button below</li>
            <li>Search or browse canned responses</li>
            <li>Select a template</li>
            <li>Click "Send" to test the functionality</li>
            <li>The message will appear in the "Last Sent Message" section above</li>
          </ol>
        </div>

        {/* Open Quick Reply button */}
        <button
          onClick={() => setShowQuickReply(true)}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <MessageCircle className="h-5 w-5" />
          Open Quick Reply
        </button>
      </div>

      {/* Quick Reply Modal */}
      <QuickReply
        open={showQuickReply}
        conversationId="test-conv-123"
        customerName="John Doe"
        onSend={handleSend}
        onClose={() => setShowQuickReply(false)}
      />
    </div>
  );
}
