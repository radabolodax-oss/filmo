// Minimal JNI bridge to boot nodejs-mobile (Node 18.20.4) inside the app
// process. Adapted from the JaneaSystems nodejs-mobile-samples
// "native-gradle-node-folder" sample (2017, pattern only -- binaries swapped
// for the v18.20.4 nodejs-mobile Android release). Unlike the old
// nodejs-mobile-cordova plugin, this has no JS<->Java message-channel
// machinery: the WebView side just polls http://127.0.0.1:<port> itself.
#include <jni.h>
#include <string>
#include <cstdlib>
#include <cstring>
#include "node.h"
#include <pthread.h>
#include <unistd.h>
#include <android/log.h>

static int pipe_stdout[2];
static int pipe_stderr[2];
static pthread_t thread_stdout;
static pthread_t thread_stderr;
static const char *ADBTAG = "NODEJS-MOBILE";

static void *thread_stderr_func(void *) {
    ssize_t redirect_size;
    char buf[2048];
    while ((redirect_size = read(pipe_stderr[0], buf, sizeof buf - 1)) > 0) {
        if (buf[redirect_size - 1] == '\n') --redirect_size;
        buf[redirect_size] = 0;
        __android_log_write(ANDROID_LOG_ERROR, ADBTAG, buf);
    }
    return 0;
}

static void *thread_stdout_func(void *) {
    ssize_t redirect_size;
    char buf[2048];
    while ((redirect_size = read(pipe_stdout[0], buf, sizeof buf - 1)) > 0) {
        if (buf[redirect_size - 1] == '\n') --redirect_size;
        buf[redirect_size] = 0;
        __android_log_write(ANDROID_LOG_INFO, ADBTAG, buf);
    }
    return 0;
}

static int start_redirecting_stdout_stderr() {
    setvbuf(stdout, 0, _IONBF, 0);
    pipe(pipe_stdout);
    dup2(pipe_stdout[1], STDOUT_FILENO);

    setvbuf(stderr, 0, _IONBF, 0);
    pipe(pipe_stderr);
    dup2(pipe_stderr[1], STDERR_FILENO);

    if (pthread_create(&thread_stdout, 0, thread_stdout_func, 0) == -1) return -1;
    pthread_detach(thread_stdout);

    if (pthread_create(&thread_stderr, 0, thread_stderr_func, 0) == -1) return -1;
    pthread_detach(thread_stderr);

    return 0;
}

// libuv requires all argv strings to live in contiguous memory.
extern "C" JNIEXPORT jint JNICALL
Java_com_tonsite_pcprowlermobile_MainActivity_startNodeWithArguments(
        JNIEnv *env,
        jobject /* this */,
        jobjectArray arguments) {

    jsize argument_count = env->GetArrayLength(arguments);

    int c_arguments_size = 0;
    for (int i = 0; i < argument_count; i++) {
        auto jstr = (jstring) env->GetObjectArrayElement(arguments, i);
        const char *raw = env->GetStringUTFChars(jstr, 0);
        c_arguments_size += (int) strlen(raw) + 1;
        env->ReleaseStringUTFChars(jstr, raw);
    }

    char *args_buffer = (char *) calloc(c_arguments_size, sizeof(char));
    char **argv = (char **) calloc(argument_count, sizeof(char *));
    char *current_args_position = args_buffer;

    for (int i = 0; i < argument_count; i++) {
        auto jstr = (jstring) env->GetObjectArrayElement(arguments, i);
        const char *current_argument = env->GetStringUTFChars(jstr, 0);
        size_t len = strlen(current_argument);
        strncpy(current_args_position, current_argument, len);
        argv[i] = current_args_position;
        current_args_position += len + 1;
        env->ReleaseStringUTFChars(jstr, current_argument);
    }

    if (start_redirecting_stdout_stderr() == -1) {
        __android_log_write(ANDROID_LOG_ERROR, ADBTAG, "Couldn't start redirecting stdout/stderr to logcat.");
    }

    __android_log_write(ANDROID_LOG_INFO, ADBTAG, "Starting node::Start()...");
    jint result = (jint) node::Start(argument_count, argv);
    __android_log_write(ANDROID_LOG_ERROR, ADBTAG, "node::Start() returned (unexpected: Node should run forever).");

    return result;
}
