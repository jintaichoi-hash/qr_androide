# Add project specific ProGuard rules here.
-keepattributes *Annotation*,InnerClasses,EnclosingMethod,Signature
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

