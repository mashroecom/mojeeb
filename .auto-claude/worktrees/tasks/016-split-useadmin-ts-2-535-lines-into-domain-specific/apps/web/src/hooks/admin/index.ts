/**
 * Admin Hooks Barrel Export
 *
 * Centralized export point for all admin-specific React Query hooks.
 * This file re-exports hooks from domain-specific modules for admin functionality.
 */

// DLQ (Dead Letter Queue) Management
export * from './useAdminDLQ';

// Feature Flags
export * from './useAdminFeatureFlags';

// File Management
export * from './useAdminFiles';

// Landing Page
export * from './useAdminLandingPage';

// Logs (Error Logs & Webhook Logs)
export * from './useAdminLogs';

// Plans & Subscriptions
export * from './useAdminPlans';

// Settings (Site Settings, Config, Notifications, Org Defaults)
export * from './useAdminSettings';

// Templates & Tags
export * from './useAdminTemplates';
