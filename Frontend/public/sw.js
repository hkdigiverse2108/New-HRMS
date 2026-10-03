// Service Worker for Push Notifications
// This file is served from /sw.js

const CACHE_NAME = 'hrms-push-v1';
const VAPID_PUBLIC_KEY = '/api/push/vapid-public-key';

// Convert base64 to Uint8Array for push subscription
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(clients.claim());
});

// Push event - handles notifications when app is closed
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'HRMS Notification', body: event.data.text() };
    }
  }

  const title = data.title || 'HRMS Notification';
  const icon = data.icon || '/favicon.ico';
  const options = {
    body: data.body || 'You have a new notification',
    icon: icon,
    badge: data.badge || '/favicon.ico',
    image: data.image,
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Dismiss' }
    ],
    requireInteraction: data.requireInteraction !== false,
    tag: (data.data && data.data.notificationId) ? `hrms-${data.data.notificationId}` : `hrms-${Date.now()}`,
    renotify: true,
    vibrate: [100, 50, 100],
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  const action = event.action;
  const notificationData = event.notification.data || {};
  let targetUrl = notificationData.url || '/';

  // For meeting summons, ensure query parameters are present on targetUrl so newly opened windows render it immediately
  if (notificationData.type === 'meeting_summon' || notificationData.action === 'meeting_summon') {
    if (!targetUrl.includes('meeting_summon')) {
      const sep = targetUrl.includes('?') ? '&' : '?';
      targetUrl = `${targetUrl}${sep}meeting_summon=1&summon_id=${encodeURIComponent(notificationData.summon_id || '')}&caller_name=${encodeURIComponent(notificationData.caller_name || '')}&caller_role=${encodeURIComponent(notificationData.caller_role || '')}&location=${encodeURIComponent(notificationData.location || '')}&notes=${encodeURIComponent(notificationData.notes || '')}&timestamp=${encodeURIComponent(notificationData.timestamp || '')}`;
    }
  }

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = new URL(targetUrl, self.location.origin).href;
  }
  
  if (action === 'close') {
    return;
  }
  
  // Focus existing window and bring to front, or open new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to find an existing HRMS window
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({ 
              type: 'OPEN_MEETING_SUMMON', 
              summonData: notificationData,
              url: targetUrl 
            });
            client.postMessage({ 
              type: 'NOTIFICATION_CLICK', 
              url: targetUrl, 
              data: notificationData 
            });
            return client.focus();
          }
        }
        // No existing window, open new one
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});

// Background sync for offline support
self.addEventListener('sync', (event) => {
  if (event.tag === 'push-subscription-sync') {
    event.waitUntil(syncPushSubscription());
  }
});

async function syncPushSubscription() {
  // Handle offline subscription sync if needed
  console.log('[SW] Syncing push subscription');
}

// Message from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SUBSCRIBE_PUSH') {
    event.waitUntil(subscribeToPush(event.data.vapidPublicKey));
  }
});

// Subscribe to push
async function subscribeToPush(vapidPublicKey) {
  try {
    const registration = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
    
    // Send subscription to backend
    const token = await getAuthToken();
    if (token) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          endpoint: registration.endpoint,
          p256dh: arrayBufferToBase64(registration.getKey('p256dh')),
          auth: arrayBufferToBase64(registration.getKey('auth'))
        })
      });
    }
  } catch (err) {
    console.error('[SW] Push subscription failed:', err);
  }
}

async function getAuthToken() {
  // Try to get token from IndexedDB or send message to main thread
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (e) => resolve(e.data.token);
    self.clients.matchAll().then(clients => {
      if (clients.length > 0) {
        clients[0].postMessage({ type: 'GET_AUTH_TOKEN' }, [channel.port2]);
      } else {
        resolve(null);
      }
    });
  });
}

function arrayBufferToBase64(buffer) {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

console.log('[SW] Service worker loaded');