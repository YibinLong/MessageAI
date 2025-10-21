/**
 * Network Status Hook
 * 
 * This hook monitors network connectivity using @react-native-community/netinfo.
 * It provides real-time updates about internet connection status.
 * 
 * WHY: We need to know when the user is offline so we can:
 * - Show connection status banner
 * - Queue messages for later sending
 * - Retry failed operations when reconnected
 * 
 * WHAT: Subscribes to network state changes and returns current status
 */

import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

/**
 * Network Status Interface
 * 
 * WHAT: Describes the network connection state
 * - isConnected: Whether device has any network connection (WiFi, cellular, etc.)
 * - isInternetReachable: Whether device can actually reach the internet (not just connected to WiFi)
 */
export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
}

/**
 * Hook to monitor network connectivity
 * 
 * WHY: Real-time network status is critical for offline-first messaging
 * WHAT: Returns current network status and updates when it changes
 * 
 * USAGE:
 * const { isConnected, isInternetReachable } = useNetworkStatus();
 * 
 * @returns NetworkStatus object with connection state
 */
export function useNetworkStatus(): NetworkStatus {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true, // Assume connected initially (optimistic)
    isInternetReachable: true,
  });

  useEffect(() => {
    /**
     * Subscribe to network state changes
     * 
     * WHY: We need to know immediately when connection status changes
     * WHAT: NetInfo fires callback whenever WiFi/cellular/offline state changes
     */
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      console.log('[NetworkStatus] Connection changed:', {
        type: state.type,
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
      });

      setNetworkStatus({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? false,
      });
    });

    /**
     * Fetch initial network state
     * 
     * WHY: The listener doesn't fire immediately, so we need to get current state
     * WHAT: Calls NetInfo.fetch() once on mount to get initial status
     */
    NetInfo.fetch().then((state: NetInfoState) => {
      console.log('[NetworkStatus] Initial state:', {
        type: state.type,
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
      });

      setNetworkStatus({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? false,
      });
    });

    // Cleanup: unsubscribe when component unmounts
    return () => {
      unsubscribe();
    };
  }, []);

  return networkStatus;
}


