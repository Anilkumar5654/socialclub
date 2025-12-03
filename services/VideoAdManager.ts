import { Platform } from 'react-native';
import { api } from './api'; 

// Variable declarations to hold the module dynamically
let InterstitialAd: any = null;
let AdEventType: any = null;
let TestIds: any = null;
let MobileAdsModule: any = null; // New variable to hold the module
let isAdMobInitialized = false; // New flag

// 🔥 CRITICAL FIX: Only require the native module if NOT on Web
if (Platform.OS !== 'web') {
  try {
    const MobileAds = require('react-native-google-mobile-ads');
    InterstitialAd = MobileAds.InterstitialAd;
    AdEventType = MobileAds.AdEventType;
    TestIds = MobileAds.TestIds;
    MobileAdsModule = MobileAds; // Save the module reference

    // 🛑 CRITICAL: Initialize AdMob SDK 
    MobileAds.mobileAds()
      .initialize()
      .then((status: any) => {
        console.log('[AdManager] AdMob SDK Initialized successfully.');
        isAdMobInitialized = true;
      })
      .catch((error: any) => {
        console.error('[AdManager] AdMob Initialization Failed:', error);
      });

  } catch (e) {
    console.warn('AdMob module not found or failed to load.');
  }
}

// ⚠️ REPLACE WITH REAL ADMOB ID FOR PRODUCTION
const AD_UNIT_ID = (TestIds) ? TestIds.INTERSTITIAL : 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyy';

let interstitial: any = null;
let adLoaded = false;

export const VideoAdManager = {
  
  // 1. Load Ad
  loadAd: () => {
    // If on Web, module not loaded, or NOT INITIALIZED, stop here
    if (Platform.OS === 'web' || !InterstitialAd || !isAdMobInitialized) {
        if (!isAdMobInitialized) {
            console.log('[AdManager] AdMob not yet initialized. Skipping loadAd.');
        }
        return;
    }

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

    // TRACKING: When revenue is generated
    interstitial.addAdEventListener(AdEventType.PAID, (params: any) => {
      console.log('[AdManager] Revenue:', params);
    });

    interstitial.load();
  },

  // 2. Show Ad Logic
  showAd: async (currentVideo: any) => {
    // If on Web, skip ad logic completely
    if (Platform.OS === 'web' || !InterstitialAd || !isAdMobInitialized) {
      console.log('[AdManager] AdMob not ready, skipping ad.');
      return false;
    }

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
      // Fallback revenue
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
