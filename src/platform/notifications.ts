/**
 * Web Notifications API wrapper.
 * Provides a simplified interface for browser notifications.
 */

/**
 * Notification options matching the standard NotificationOptions interface.
 */
export interface NotificationOptions {
  /** Body text of the notification */
  body?: string;
  /** Icon URL for the notification */
  icon?: string;
  /** Badge icon for mobile devices */
  badge?: string;
  /** Tag for grouping notifications */
  tag?: string;
  /** Whether to require user interaction */
  requireInteraction?: boolean;
  /** Vibration pattern for mobile devices */
  vibrate?: number[];
  /** Additional data attached to the notification */
  data?: unknown;
}

/**
 * Notifications manager providing a clean interface for web notifications.
 */
export const notifications = {
  /**
   * Check if notifications are supported.
   * @returns True if Notification API is available
   */
  isSupported(): boolean {
    return 'Notification' in window;
  },

  /**
   * Get current permission status.
   * @returns Current permission state
   */
  getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  },

  /**
   * Request notification permission from the user.
   * @returns Promise resolving to the permission result
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    return Notification.requestPermission();
  },

  /**
   * Send a notification.
   * Requires 'granted' permission.
   * @param title - Notification title
   * @param options - Optional notification settings
   * @returns The Notification instance or null if not permitted
   */
  send(title: string, options?: NotificationOptions): Notification | null {
    if (!this.isSupported()) {
      console.warn('bQuery: Notifications not supported in this browser');
      return null;
    }

    if (Notification.permission !== 'granted') {
      console.warn('bQuery: Notification permission not granted');
      return null;
    }

    return new Notification(title, options);
  },
};
