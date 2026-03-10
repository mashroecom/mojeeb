/**
 * Offline Storage Utility using IndexedDB
 *
 * Provides offline storage capabilities for the mobile PWA.
 * Stores conversations, messages, and queued actions for offline access.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stored conversation data matching the API response format
 */
export interface StoredConversation {
  id: string;
  customerId: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  orgId: string;
  status: 'ACTIVE' | 'HANDED_OFF' | 'WAITING' | 'RESOLVED' | 'ARCHIVED';
  summary: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  // Additional fields from API
  org?: { id: string; name: string; logoUrl: string | null };
  channel?: { id: string; name: string; type: string };
  agent?: { id: string; name: string };
  _count?: { messages: number };
  // Cache metadata
  cachedAt: number; // Timestamp when cached
}

/**
 * Stored message data
 */
export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'CUSTOMER' | 'AI_AGENT' | 'HUMAN_AGENT' | 'SYSTEM';
  content: string;
  contentType: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  metadata?: any;
  createdAt: string;
  // Cache metadata
  cachedAt: number;
}

/**
 * Queued action to be synced when online
 */
export interface QueuedAction {
  id: string; // Unique ID for the queued action
  type: 'send_message' | 'update_status' | 'quick_action';
  conversationId: string;
  payload: any;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

/**
 * Result of a database operation
 */
export interface OfflineStorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'SupraDashOfflineDB';
const DB_VERSION = 1;

const STORE_CONVERSATIONS = 'conversations';
const STORE_MESSAGES = 'messages';
const STORE_QUEUE = 'queue';

// Cache expiration: 7 days
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Database Initialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if IndexedDB is supported
 */
export function isIndexedDBSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return 'indexedDB' in window;
}

/**
 * Open and initialize the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBSupported()) {
      reject(new Error('IndexedDB is not supported in this browser'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create conversations store
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        const conversationStore = db.createObjectStore(STORE_CONVERSATIONS, {
          keyPath: 'id',
        });
        conversationStore.createIndex('orgId', 'orgId', { unique: false });
        conversationStore.createIndex('status', 'status', { unique: false });
        conversationStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      // Create messages store
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const messageStore = db.createObjectStore(STORE_MESSAGES, {
          keyPath: 'id',
        });
        messageStore.createIndex('conversationId', 'conversationId', {
          unique: false,
        });
        messageStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      // Create queue store for offline actions
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_QUEUE, {
          keyPath: 'id',
        });
        queueStore.createIndex('conversationId', 'conversationId', {
          unique: false,
        });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation Storage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save a single conversation to offline storage
 */
export async function saveConversation(
  conversation: Omit<StoredConversation, 'cachedAt'>,
): Promise<OfflineStorageResult<StoredConversation>> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_CONVERSATIONS], 'readwrite');
    const store = transaction.objectStore(STORE_CONVERSATIONS);

    const conversationWithCache: StoredConversation = {
      ...conversation,
      cachedAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(conversationWithCache);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();

    return {
      success: true,
      data: conversationWithCache,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save conversation',
    };
  }
}

/**
 * Save multiple conversations to offline storage
 */
export async function saveConversations(
  conversations: Omit<StoredConversation, 'cachedAt'>[],
): Promise<OfflineStorageResult<StoredConversation[]>> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_CONVERSATIONS], 'readwrite');
    const store = transaction.objectStore(STORE_CONVERSATIONS);

    const conversationsWithCache: StoredConversation[] = conversations.map((conv) => ({
      ...conv,
      cachedAt: Date.now(),
    }));

    await Promise.all(
      conversationsWithCache.map(
        (conv) =>
          new Promise<void>((resolve, reject) => {
            const request = store.put(conv);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          }),
      ),
    );

    db.close();

    return {
      success: true,
      data: conversationsWithCache,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save conversations',
    };
  }
}

/**
 * Get a single conversation from offline storage
 */
export async function getConversation(
  conversationId: string,
): Promise<OfflineStorageResult<StoredConversation>> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_CONVERSATIONS], 'readonly');
    const store = transaction.objectStore(STORE_CONVERSATIONS);

    const conversation = await new Promise<StoredConversation | undefined>((resolve, reject) => {
      const request = store.get(conversationId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();

    if (!conversation) {
      return {
        success: false,
        error: 'Conversation not found in offline storage',
      };
    }

    // Check if cache is expired
    if (Date.now() - conversation.cachedAt > CACHE_MAX_AGE) {
      return {
        success: false,
        error: 'Cached conversation has expired',
      };
    }

    return {
      success: true,
      data: conversation,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversation',
    };
  }
}

/**
 * Get all conversations from offline storage
 */
export async function getConversations(options?: {
  orgId?: string;
  status?: string;
  limit?: number;
}): Promise<OfflineStorageResult<StoredConversation[]>> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_CONVERSATIONS], 'readonly');
    const store = transaction.objectStore(STORE_CONVERSATIONS);

    let conversations: StoredConversation[] = [];

    // If filtering by orgId, use the index
    if (options?.orgId) {
      const index = store.index('orgId');
      conversations = await new Promise((resolve, reject) => {
        const request = index.getAll(options.orgId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } else {
      // Otherwise, get all conversations
      conversations = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    db.close();

    // Filter by status if specified
    if (options?.status) {
      conversations = conversations.filter((conv) => conv.status === options.status);
    }

    // Remove expired conversations
    const now = Date.now();
    conversations = conversations.filter((conv) => now - conv.cachedAt <= CACHE_MAX_AGE);

    // Sort by lastMessageAt (most recent first)
    conversations.sort((a, b) => {
      const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return dateB - dateA;
    });

    // Apply limit if specified
    if (options?.limit && options.limit > 0) {
      conversations = conversations.slice(0, options.limit);
    }

    return {
      success: true,
      data: conversations,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversations',
    };
  }
}

/**
 * Delete a conversation from offline storage
 */
export async function deleteConversation(conversationId: string): Promise<OfflineStorageResult> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_CONVERSATIONS], 'readwrite');
    const store = transaction.objectStore(STORE_CONVERSATIONS);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(conversationId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete conversation',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Storage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save messages for a conversation
 */
export async function saveMessages(
  messages: Omit<StoredMessage, 'cachedAt'>[],
): Promise<OfflineStorageResult<StoredMessage[]>> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_MESSAGES], 'readwrite');
    const store = transaction.objectStore(STORE_MESSAGES);

    const messagesWithCache: StoredMessage[] = messages.map((msg) => ({
      ...msg,
      cachedAt: Date.now(),
    }));

    await Promise.all(
      messagesWithCache.map(
        (msg) =>
          new Promise<void>((resolve, reject) => {
            const request = store.put(msg);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          }),
      ),
    );

    db.close();

    return {
      success: true,
      data: messagesWithCache,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save messages',
    };
  }
}

/**
 * Get messages for a specific conversation
 */
export async function getMessages(
  conversationId: string,
): Promise<OfflineStorageResult<StoredMessage[]>> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_MESSAGES], 'readonly');
    const store = transaction.objectStore(STORE_MESSAGES);
    const index = store.index('conversationId');

    const messages = await new Promise<StoredMessage[]>((resolve, reject) => {
      const request = index.getAll(conversationId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();

    // Remove expired messages
    const now = Date.now();
    const validMessages = messages.filter((msg) => now - msg.cachedAt <= CACHE_MAX_AGE);

    // Sort by createdAt (oldest first)
    validMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return {
      success: true,
      data: validMessages,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get messages',
    };
  }
}

/**
 * Delete all messages for a conversation
 */
export async function deleteMessages(conversationId: string): Promise<OfflineStorageResult> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_MESSAGES], 'readwrite');
    const store = transaction.objectStore(STORE_MESSAGES);
    const index = store.index('conversationId');

    const messages = await new Promise<StoredMessage[]>((resolve, reject) => {
      const request = index.getAll(conversationId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await Promise.all(
      messages.map(
        (msg) =>
          new Promise<void>((resolve, reject) => {
            const request = store.delete(msg.id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          }),
      ),
    );

    db.close();

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete messages',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Queued Actions (for offline sync)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add an action to the offline queue
 */
export async function queueAction(
  action: Omit<QueuedAction, 'id' | 'createdAt' | 'retryCount'>,
): Promise<OfflineStorageResult<QueuedAction>> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORE_QUEUE);

    const queuedAction: QueuedAction = {
      ...action,
      id: `${action.type}_${action.conversationId}_${Date.now()}`,
      createdAt: Date.now(),
      retryCount: 0,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(queuedAction);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();

    return {
      success: true,
      data: queuedAction,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue action',
    };
  }
}

/**
 * Get all queued actions
 */
export async function getQueuedActions(): Promise<OfflineStorageResult<QueuedAction[]>> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_QUEUE], 'readonly');
    const store = transaction.objectStore(STORE_QUEUE);

    const actions = await new Promise<QueuedAction[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();

    // Sort by createdAt (oldest first for FIFO processing)
    actions.sort((a, b) => a.createdAt - b.createdAt);

    return {
      success: true,
      data: actions,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get queued actions',
    };
  }
}

/**
 * Update a queued action (e.g., increment retry count or add error)
 */
export async function updateQueuedAction(
  actionId: string,
  updates: Partial<QueuedAction>,
): Promise<OfflineStorageResult<QueuedAction>> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORE_QUEUE);

    const existingAction = await new Promise<QueuedAction | undefined>((resolve, reject) => {
      const request = store.get(actionId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!existingAction) {
      db.close();
      return {
        success: false,
        error: 'Queued action not found',
      };
    }

    const updatedAction: QueuedAction = {
      ...existingAction,
      ...updates,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(updatedAction);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();

    return {
      success: true,
      data: updatedAction,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update queued action',
    };
  }
}

/**
 * Remove a queued action (after successful sync)
 */
export async function removeQueuedAction(actionId: string): Promise<OfflineStorageResult> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORE_QUEUE);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(actionId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove queued action',
    };
  }
}

/**
 * Clear all queued actions
 */
export async function clearQueuedActions(): Promise<OfflineStorageResult> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORE_QUEUE);

    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear queued actions',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clear all expired data from offline storage
 */
export async function clearExpiredData(): Promise<OfflineStorageResult> {
  try {
    const db = await openDatabase();
    const now = Date.now();

    // Clear expired conversations
    const convTransaction = db.transaction([STORE_CONVERSATIONS], 'readwrite');
    const convStore = convTransaction.objectStore(STORE_CONVERSATIONS);
    const convIndex = convStore.index('cachedAt');

    const expiredConversations = await new Promise<StoredConversation[]>((resolve, reject) => {
      const request = convIndex.getAll();
      request.onsuccess = () => {
        const all = request.result;
        const expired = all.filter((conv) => now - conv.cachedAt > CACHE_MAX_AGE);
        resolve(expired);
      };
      request.onerror = () => reject(request.error);
    });

    await Promise.all(
      expiredConversations.map(
        (conv) =>
          new Promise<void>((resolve, reject) => {
            const request = convStore.delete(conv.id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          }),
      ),
    );

    // Clear expired messages
    const msgTransaction = db.transaction([STORE_MESSAGES], 'readwrite');
    const msgStore = msgTransaction.objectStore(STORE_MESSAGES);
    const msgIndex = msgStore.index('cachedAt');

    const expiredMessages = await new Promise<StoredMessage[]>((resolve, reject) => {
      const request = msgIndex.getAll();
      request.onsuccess = () => {
        const all = request.result;
        const expired = all.filter((msg) => now - msg.cachedAt > CACHE_MAX_AGE);
        resolve(expired);
      };
      request.onerror = () => reject(request.error);
    });

    await Promise.all(
      expiredMessages.map(
        (msg) =>
          new Promise<void>((resolve, reject) => {
            const request = msgStore.delete(msg.id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          }),
      ),
    );

    db.close();

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear expired data',
    };
  }
}

/**
 * Clear all data from offline storage
 */
export async function clearAllData(): Promise<OfflineStorageResult> {
  try {
    const db = await openDatabase();

    const transaction = db.transaction(
      [STORE_CONVERSATIONS, STORE_MESSAGES, STORE_QUEUE],
      'readwrite',
    );

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(STORE_CONVERSATIONS).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(STORE_MESSAGES).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(STORE_QUEUE).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
    ]);

    db.close();

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear all data',
    };
  }
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<
  OfflineStorageResult<{
    conversations: number;
    messages: number;
    queuedActions: number;
  }>
> {
  try {
    const db = await openDatabase();

    const transaction = db.transaction(
      [STORE_CONVERSATIONS, STORE_MESSAGES, STORE_QUEUE],
      'readonly',
    );

    const [conversationCount, messageCount, queuedActionCount] = await Promise.all([
      new Promise<number>((resolve, reject) => {
        const request = transaction.objectStore(STORE_CONVERSATIONS).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
      new Promise<number>((resolve, reject) => {
        const request = transaction.objectStore(STORE_MESSAGES).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
      new Promise<number>((resolve, reject) => {
        const request = transaction.objectStore(STORE_QUEUE).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
    ]);

    db.close();

    return {
      success: true,
      data: {
        conversations: conversationCount,
        messages: messageCount,
        queuedActions: queuedActionCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get storage stats',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Online/Offline Detection and Sync
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if the browser is currently online
 */
export function isOnline(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

/**
 * Sync handler function type
 * Returns true if sync was successful, false otherwise
 */
export type SyncHandler = (action: QueuedAction) => Promise<boolean>;

/**
 * Process queued actions when coming back online
 *
 * @param syncHandler - Function that handles syncing each action
 * @param maxRetries - Maximum number of retries per action (default: 3)
 * @returns Result with count of successful and failed syncs
 */
export async function syncQueuedActions(
  syncHandler: SyncHandler,
  maxRetries: number = 3,
): Promise<
  OfflineStorageResult<{
    total: number;
    synced: number;
    failed: number;
    remaining: number;
  }>
> {
  try {
    // Get all queued actions
    const actionsResult = await getQueuedActions();

    if (!actionsResult.success || !actionsResult.data) {
      return {
        success: false,
        error: actionsResult.error ?? 'Failed to get queued actions',
      };
    }

    const actions = actionsResult.data;
    let synced = 0;
    let failed = 0;

    // Process each action
    for (const action of actions) {
      try {
        // Call the sync handler
        const success = await syncHandler(action);

        if (success) {
          // Remove from queue on success
          await removeQueuedAction(action.id);
          synced++;
        } else {
          // Increment retry count on failure
          const newRetryCount = action.retryCount + 1;

          if (newRetryCount >= maxRetries) {
            // Remove action if max retries reached
            await removeQueuedAction(action.id);
            failed++;
          } else {
            // Update retry count
            await updateQueuedAction(action.id, {
              retryCount: newRetryCount,
              lastError: 'Sync failed, will retry',
            });
          }
        }
      } catch (error) {
        // Increment retry count on error
        const newRetryCount = action.retryCount + 1;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (newRetryCount >= maxRetries) {
          // Remove action if max retries reached
          await removeQueuedAction(action.id);
          failed++;
        } else {
          // Update retry count and error
          await updateQueuedAction(action.id, {
            retryCount: newRetryCount,
            lastError: errorMessage,
          });
        }
      }
    }

    // Get remaining actions
    const remainingResult = await getQueuedActions();
    const remaining = remainingResult.success ? (remainingResult.data?.length ?? 0) : 0;

    return {
      success: true,
      data: {
        total: actions.length,
        synced,
        failed,
        remaining,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync queued actions',
    };
  }
}

/**
 * Setup online/offline event listeners
 *
 * @param onOnline - Callback when browser comes online
 * @param onOffline - Callback when browser goes offline
 * @returns Cleanup function to remove listeners
 */
export function setupOnlineListeners(onOnline: () => void, onOffline: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
