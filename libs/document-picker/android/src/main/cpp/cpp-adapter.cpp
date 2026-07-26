#include <jni.h>
#include <fbjni/fbjni.h>
#include <android/bitmap.h>
#include "NitroOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::nitro::registerAllNatives();
  });
}
