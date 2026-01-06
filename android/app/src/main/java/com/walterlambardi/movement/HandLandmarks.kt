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
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult

class HandLandmarks(reactContext: ReactApplicationContext): ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "HandLandmarks"
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
        if (HandLandmarkerHolder.handLandmarker != null) {
            val alreadyInitializedParams = Arguments.createMap()
            alreadyInitializedParams.putString("status", "Hand model already initialized")
            sendEvent("onHandLandmarksStatus", alreadyInitializedParams)
            return
        }

        val resultListener = OutputHandler.ResultListener { result: HandLandmarkerResult, inputImage: MPImage ->
            Log.d("HandLandmarksFrameProcessor", "Detected ${result.landmarks().size} hands")

            val handsArray = Arguments.createArray()

            for ((handIndex, handLandmarks) in result.landmarks().withIndex()) {
                val handData = Arguments.createMap()
                val landmarksArray = Arguments.createArray()
                
                for ((landmarkIndex, landmark) in handLandmarks.withIndex()) {
                    val landmarkMap = Arguments.createMap()
                    landmarkMap.putInt("index", landmarkIndex)
                    landmarkMap.putDouble("x", landmark.x().toDouble())
                    landmarkMap.putDouble("y", landmark.y().toDouble())
                    landmarkMap.putDouble("z", landmark.z().toDouble())
                    landmarkMap.putDouble("visibility", 1.0) // Hand landmarks typically have high visibility
                    landmarksArray.pushMap(landmarkMap)
                }
                
                handData.putInt("handIndex", handIndex)
                handData.putArray("landmarks", landmarksArray)
                
                // Add handedness information if available
                if (result.handedness().size > handIndex && result.handedness()[handIndex].isNotEmpty()) {
                    val handedness = result.handedness()[handIndex][0]
                    handData.putString("label", handedness.categoryName()) // "Left" or "Right"
                    handData.putDouble("score", handedness.score().toDouble())
                }
                
                handsArray.pushMap(handData)
            }

            val params = Arguments.createMap()
            params.putArray("hands", handsArray)

            sendEvent("onHandLandmarksDetected", params)
        }

        try {
            val context: Context = reactApplicationContext
            val baseOptions = BaseOptions.builder()
                .setModelAssetPath("hand_landmarker.task")
                .build()

            val handLandmarkerOptions = HandLandmarker.HandLandmarkerOptions.builder()
                .setBaseOptions(baseOptions)
                .setNumHands(2) // Track up to 2 hands
                .setRunningMode(RunningMode.LIVE_STREAM)
                .setMinHandDetectionConfidence(0.5f)
                .setMinHandPresenceConfidence(0.5f)
                .setMinTrackingConfidence(0.5f)
                .setResultListener(resultListener)
                .build()

            HandLandmarkerHolder.handLandmarker = HandLandmarker.createFromOptions(context, handLandmarkerOptions)

            val successParams = Arguments.createMap()
            successParams.putString("status", "Hand model initialized successfully")
            sendEvent("onHandLandmarksStatus", successParams)

        } catch (e: Exception) {
            Log.e("HandLandmarksFrameProcessor", "Error initializing HandLandmarker", e)

            val errorParams = Arguments.createMap()
            errorParams.putString("error", e.message)
            sendEvent("onHandLandmarksError", errorParams)
        }
    }

    @ReactMethod
    fun clearModel() {
        HandLandmarkerHolder.handLandmarker?.close()
        HandLandmarkerHolder.handLandmarker = null
        
        val params = Arguments.createMap()
        params.putString("status", "Hand model cleared")
        sendEvent("onHandLandmarksStatus", params)
    }
}