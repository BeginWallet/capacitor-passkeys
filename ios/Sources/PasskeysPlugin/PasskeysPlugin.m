#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Objective-C bridge for Swift plugin
// Required for Capacitor to discover the plugin

CAP_PLUGIN(PasskeysPlugin, "Passkeys",
    CAP_PLUGIN_METHOD(isSupported, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(create, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(get, CAPPluginReturnPromise);
)
