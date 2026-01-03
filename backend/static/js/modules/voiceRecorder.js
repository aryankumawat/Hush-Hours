// Voice Recording Module
let mediaRecorder = null
let audioChunks = []
let recordingStartTime = null
let recordingTimer = null

/**
 * Request microphone access and start recording
 */
export async function startRecording() {
  try {
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    
    // Create MediaRecorder instance
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus' // Use webm for better browser support
    })
    
    audioChunks = []
    recordingStartTime = Date.now()
    
    // Collect audio data chunks
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }
    
    // Start recording
    mediaRecorder.start(100) // Collect data every 100ms
    
    console.log("[DEBUG voiceRecorder] Recording started")
    return true
  } catch (error) {
    console.error("[DEBUG voiceRecorder] Error starting recording:", error)
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      alert("Microphone permission denied. Please allow microphone access to record voice messages.")
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      alert("No microphone found. Please connect a microphone to record voice messages.")
    } else {
      alert("Failed to start recording. Please try again.")
    }
    return false
  }
}

/**
 * Stop recording and return audio blob
 */
export async function stopRecording() {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      reject(new Error("No active recording"))
      return
    }
    
    mediaRecorder.onstop = async () => {
      try {
        // Create blob from audio chunks
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' })
        
        // Stop all tracks to release microphone
        if (mediaRecorder.stream) {
          mediaRecorder.stream.getTracks().forEach(track => track.stop())
        }
        
        // Calculate recording duration
        const duration = recordingStartTime ? Math.round((Date.now() - recordingStartTime) / 1000) : 0
        
        // Clear recording state
        audioChunks = []
        mediaRecorder = null
        recordingStartTime = null
        clearRecordingTimer()
        
        console.log("[DEBUG voiceRecorder] Recording stopped, duration:", duration, "seconds")
        
        resolve({
          blob: audioBlob,
          duration: duration,
          size: audioBlob.size
        })
      } catch (error) {
        console.error("[DEBUG voiceRecorder] Error processing recording:", error)
        reject(error)
      }
    }
    
    // Stop recording
    mediaRecorder.stop()
  })
}

/**
 * Cancel current recording
 */
export function cancelRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
    
    // Stop all tracks
    if (mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach(track => track.stop())
    }
    
    audioChunks = []
    mediaRecorder = null
    recordingStartTime = null
    clearRecordingTimer()
    
    console.log("[DEBUG voiceRecorder] Recording cancelled")
  }
}

/**
 * Check if currently recording
 */
export function isRecording() {
  return mediaRecorder && mediaRecorder.state === 'recording'
}

/**
 * Get current recording duration in seconds
 */
export function getRecordingDuration() {
  if (recordingStartTime) {
    return Math.round((Date.now() - recordingStartTime) / 1000)
  }
  return 0
}

/**
 * Start recording timer callback
 */
export function startRecordingTimer(callback) {
  clearRecordingTimer()
  recordingTimer = setInterval(() => {
    const duration = getRecordingDuration()
    if (callback) callback(duration)
  }, 1000) // Update every second
}

/**
 * Clear recording timer
 */
export function clearRecordingTimer() {
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
}

/**
 * Check if browser supports audio recording
 */
export function isRecordingSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && MediaRecorder)
}

/**
 * Convert blob to base64 for sending
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64data = reader.result
      resolve(base64data)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

