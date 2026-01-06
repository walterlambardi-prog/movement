package com.walterlambardi.movement

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.OutputHandler
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult

class PoseLandmarks(reactContext: ReactApplicationContext): ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "PoseLandmarks"
    }

    override fun initialize() {
        super.initialize()
        initModel()
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun initModel() {
        if (PoseLandmarkerHolder.poseLandmarker !== null) {
            var alreadyInitializedParams = Arguments.createMap()
            alreadyInitializedParams.putString("status", "Model already initialized")
            sendEvent("onPoseLandmarksStatus", alreadyInitializedParams)
        }

        var resultListener = OutputHandler.ResultListener{ result: PoseLandmarkerResult,  inputImage: MPImage ->
            Log.d("PoseLandmarksFrameProcessor", "Detected ${result.landmarks().size} poses")

            val landmarksArray = Arguments.createArray()

            for (poseLandmarks in result.landmarks()) {
                val poseMap = Arguments.createArray()
                for ((index, posedmark) in poseLandmarks.withIndex()) {
                    val landmarkMap = Arguments.createMap()
                    landmarkMap.putInt("keypoint", index)
                    landmarkMap.putDouble("x", posedmark.x().toDouble())
                    landmarkMap.putDouble("y", posedmark.y().toDouble())
                    landmarkMap.putDouble("z", posedmark.z().toDouble())
                    landmarkMap.putDouble("visibility", posedmark.visibility().orElse(0f).toDouble())
                    landmarkMap.putDouble("presence", posedmark.presence().orElse(0f).toDouble())
                    poseMap.pushMap(landmarkMap)
                }
                landmarksArray.pushArray(poseMap)
            }

            val params = Arguments.createMap()
            params.putArray("landmarks", landmarksArray)

            sendEvent("onPoseLandmarksDetected", params)
        }

        try {
            val context: Context = reactApplicationContext
            val baseOptions = BaseOptions.builder()
                .setModelAssetPath("pose_landmarker_lite.task")
                .build()

            val poseLandmarkerOptions = PoseLandmarker.PoseLandmarkerOptions.builder()
                .setBaseOptions(baseOptions)
                .setNumPoses(1)
                .setRunningMode(RunningMode.LIVE_STREAM)
                .setMinTrackingConfidence(0.8f)
                .setMinPoseDetectionConfidence(0.8f)
                .setMinPosePresenceConfidence(0.8f)
                .setResultListener(resultListener)
                .build()

            PoseLandmarkerHolder.poseLandmarker = PoseLandmarker.createFromOptions(context, poseLandmarkerOptions)

            val successParams = Arguments.createMap()
            successParams.putString("status", "Model initialized successfully")
            sendEvent("onPoseLandmarksStatus", successParams)

        } catch (e: Exception) {
            Log.e("PoseLandmarksFrameProcessor", "Error initializing PoseLandmarker", e)

            val errorParams = Arguments.createMap()
            errorParams.putString("error", e.message)
            sendEvent("onPoseLandmarksError", errorParams)
        }
    }
}