# Capacitor Passkeys Plugin ProGuard Rules

# Keep Capacitor plugin
-keep class io.anthropic.passkeys.** { *; }

# Keep Credential Manager classes
-keep class androidx.credentials.** { *; }
-keep class com.google.android.gms.** { *; }
