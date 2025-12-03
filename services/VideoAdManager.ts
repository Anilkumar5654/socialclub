import { RewardedInterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { api } from './api'; 

// 🔥 TUMHARI REAL UNIT ID (Production)
const PRODUCTION_ID = 'ca-app-pub-5607897410447560/1452792826';

// Safety: Development me Test ID use hogi, Real app me Real ID
const AD_UNIT_ID = __DEV__ ? TestIds.REWARDED_INTERSTITIAL : PRODUCTION_ID;

let rewardedInterstitial: RewardedInterstitialAd | null = null;
let adLoaded = false;

export const VideoAdManager = {
  
  // 1. Load Ad
  loadAd: () => {
    if (adLoaded) return; 

    // Create Rewarded Interstitial Ad
    rewardedInterstitial = RewardedInterstitialAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    rewardedInterstitial.addAdEventListener(AdEventType.LOADED, () => {
      console.log('[AdManager] Ad Loaded');
      adLoaded = true;
    });

    rewardedInterstitial.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[AdManager] Ad Closed');
      adLoaded = false;
      // Load next ad immediately
      VideoAdManager.loadAd(); 
    });

    // 🔥 TRACKING: Jab Paisa Banega (User earned reward)
    rewardedInterstitial.addAdEventListener(AdEventType.EARNED_REWARD, (reward) => {
      console.log('[AdManager] User Earned Reward:', reward);
      // Yahan hum tracking bhejenge (Amount abhi dummy hai)
    });

    rewardedInterstitial.load();
  },

  // 2. Show Ad Logic
  showAd: async (currentVideo: any) => {
    if (adLoaded && rewardedInterstitial) {
      console.log('[AdManager] Showing Rewarded Ad...');
      
      // Track Impression in Database
      await VideoAdManager.trackImpression(currentVideo);
      
      rewardedInterstitial.show();
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
      // Estimated Revenue (Backend will calculate real value later)
      const estimatedRevenue = 0.001; 

      await api.ads.trackImpression({ 
        video_id: video.id,
        creator_id: video.user?.id || video.user_id,
        ad_network: 'admob',
        revenue: estimatedRevenue 
      });
      console.log('[AdManager] Impression tracked in DB');
    } catch (error) {
      console.error('[AdManager] Tracking Failed:', error);
    }
  }
};
