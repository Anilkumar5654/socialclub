import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { api } from './api'; 

// ⚠️ REPLACE WITH REAL ADMOB ID FOR PRODUCTION
// Android: ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy
const AD_UNIT_ID = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyy';

let interstitial: InterstitialAd | null = null;
let adLoaded = false;

export const VideoAdManager = {
  
  // 1. Load Ad
  loadAd: () => {
    if (adLoaded) return; 

    interstitial = InterstitialAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      console.log('[AdManager] Ad Loaded');
      adLoaded = true;
    });

    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[AdManager] Ad Closed');
      adLoaded = false;
      // Load the next ad immediately
      VideoAdManager.loadAd(); 
    });

    // 🔥 TRACKING: When revenue is generated
    interstitial.addAdEventListener(AdEventType.PAID, (params) => {
      console.log('[AdManager] Revenue:', params);
      // Future: You can send revenue tracking to backend here
    });

    interstitial.load();
  },

  // 2. Show Ad Logic
  showAd: async (currentVideo: any) => {
    if (adLoaded && interstitial) {
      console.log('[AdManager] Showing Ad...');
      
      // Log impression in database
      await VideoAdManager.trackImpression(currentVideo);
      
      interstitial.show();
      adLoaded = false; 
      return true; 
    }
    
    console.log('[AdManager] Ad not ready, loading for next time...');
    VideoAdManager.loadAd();
    return false; 
  },

  // 3. Backend Tracking
  trackImpression: async (video: any) => {
    try {
      // Fallback revenue (Real calculation happens via backend cron job)
      const estimatedRevenue = 0.001; 

      await api.ads.trackImpression({ 
        video_id: video.id,
        creator_id: video.user?.id || video.user_id, // Safety check for ID
        ad_network: 'admob',
        revenue: estimatedRevenue 
      });
      console.log('[AdManager] Impression tracked in DB');
    } catch (error) {
      console.error('[AdManager] Tracking Failed:', error);
    }
  }
};
        
