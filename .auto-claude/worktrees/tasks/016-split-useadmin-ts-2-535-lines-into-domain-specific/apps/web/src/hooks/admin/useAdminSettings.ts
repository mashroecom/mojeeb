'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminSettingsKeys = {
  siteSettings: ['admin', 'site-settings'] as const,
  config: (category?: string) => ['admin', 'config', category] as const,
  configCategory: (category: string) => ['admin', 'config', category] as const,
  notificationSettings: ['admin', 'notification-settings'] as const,
  orgDefaults: ['admin', 'org-defaults'] as const,
};

// ---------------------------------------------------------------------------
// Site Settings Hooks
// ---------------------------------------------------------------------------

/**
 * Get site-wide settings including branding, SEO, and general configuration.
 * Admin-only endpoint for retrieving global site settings.
 */
export function useAdminSiteSettings() {
  return useQuery({
    queryKey: adminSettingsKeys.siteSettings,
    queryFn: async () => {
      const { data } = await api.get('/admin/site-settings');
      return data.data;
    },
  });
}

/**
 * Update site-wide settings.
 * Admin can modify site name, description, branding, and other global settings.
 */
export function useUpdateSiteSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.patch('/admin/site-settings', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSettingsKeys.siteSettings });
    },
  });
}

/**
 * Upload site logo image.
 * Uploads a logo file and updates site settings with the new logo URL.
 */
export function useUploadSiteLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      const { data } = await api.post('/admin/site-settings/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSettingsKeys.siteSettings });
    },
  });
}

/**
 * Upload site favicon.
 * Uploads a favicon file and updates site settings with the new favicon URL.
 */
export function useUploadSiteFavicon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('favicon', file);
      const { data } = await api.post('/admin/site-settings/upload-favicon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSettingsKeys.siteSettings });
    },
  });
}

/**
 * Upload site Open Graph image for social media previews.
 * Uploads an OG image file and updates site settings with the new image URL.
 */
export function useUploadSiteOgImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('ogImage', file);
      const { data } = await api.post('/admin/site-settings/upload-og-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSettingsKeys.siteSettings });
    },
  });
}

// ---------------------------------------------------------------------------
// Config Hooks
// ---------------------------------------------------------------------------

/**
 * Get all admin configuration settings across all categories.
 * Returns complete configuration object for admin dashboard.
 */
export function useAdminConfig(category?: string) {
  return useQuery({
    queryKey: adminSettingsKeys.config(category),
    queryFn: async () => {
      const url = category ? `/admin/config?category=${category}` : '/admin/config';
      const { data } = await api.get(url);
      return data.data;
    },
  });
}

/**
 * Get configuration settings for a specific category.
 * Returns config values scoped to a particular category (e.g., 'email', 'security', 'integrations').
 */
export function useAdminConfigCategory(category: string) {
  return useQuery({
    queryKey: adminSettingsKeys.configCategory(category),
    queryFn: async () => {
      const { data } = await api.get(`/admin/config/${category}`);
      return data.data;
    },
  });
}

/**
 * Update admin configuration settings.
 * Admin can modify configuration values for various categories.
 */
export function useUpdateAdminConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { category?: string; key: string; value: unknown }) => {
      const { data } = await api.patch('/admin/config', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'config'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Notification Settings Hooks
// ---------------------------------------------------------------------------

/**
 * Get admin notification settings.
 * Returns notification preferences and configuration for admin alerts.
 */
export function useAdminNotificationSettings() {
  return useQuery({
    queryKey: adminSettingsKeys.notificationSettings,
    queryFn: async () => {
      const { data } = await api.get('/admin/notification-settings');
      return data.data;
    },
  });
}

/**
 * Update admin notification settings.
 * Admin can configure which notifications are enabled and their delivery channels.
 */
export function useUpdateAdminNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.patch('/admin/notification-settings', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSettingsKeys.notificationSettings });
    },
  });
}

// ---------------------------------------------------------------------------
// Organization Defaults Hooks
// ---------------------------------------------------------------------------

/**
 * Get default settings applied to new organizations.
 * Returns default configuration values that will be set when creating new organizations.
 */
export function useAdminOrgDefaults() {
  return useQuery({
    queryKey: adminSettingsKeys.orgDefaults,
    queryFn: async () => {
      const { data } = await api.get('/admin/org-defaults');
      return data.data;
    },
  });
}

/**
 * Update default settings for new organizations.
 * Admin can modify default values applied to newly created organizations.
 */
export function useUpdateAdminOrgDefaults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.patch('/admin/org-defaults', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSettingsKeys.orgDefaults });
    },
  });
}
