# Builds native-lib.cpp (our JNI bridge) and links against the prebuilt
# nodejs-mobile v18.20.4 libnode.so for the target ABI. Pattern taken from
# JaneaSystems/nodejs-mobile-samples android/native-gradle-node-folder.

cmake_minimum_required(VERSION 3.22.1)

project(pcprowlermobile-native)

add_library(native-lib SHARED
            src/main/cpp/native-lib.cpp)

include_directories(${CMAKE_SOURCE_DIR}/libnode/include/node/)

add_library(libnode SHARED IMPORTED)
set_target_properties(libnode PROPERTIES IMPORTED_LOCATION
                       ${CMAKE_SOURCE_DIR}/libnode/bin/${ANDROID_ABI}/libnode.so)

find_library(log-lib log)

target_link_libraries(native-lib
                       libnode
                       ${log-lib})
