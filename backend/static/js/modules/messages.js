import { state } from "../state.js"
import { fetchMessages, sendMessageApi } from "./api.js"
import { dom } from "../utils/dom.js"

// Function to determine if a color is light or dark
function isLightColor(color) {
  if (!color || typeof color !== 'string') {
    console.log(`[DEBUG isLightColor] Invalid color input: ${color} (type: ${typeof color})`)
    return false
  }
  
  if (!color.startsWith('#')) {
    console.log(`[DEBUG isLightColor] Color doesn't start with #: ${color}`)
    return false
  }
  
  try {
    // Convert hex to RGB
    const hex = color.replace('#', '').trim()
    if (hex.length !== 6) {
      console.log(`[DEBUG isLightColor] Invalid hex length: ${hex.length} for ${color}`)
      return false
    }
    
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      console.log(`[DEBUG isLightColor] Invalid RGB values: r=${r}, g=${g}, b=${b} for ${color}`)
      return false
    }
    
    // Calculate luminance using relative luminance formula
    // https://www.w3.org/WAI/GL/wiki/Relative_luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    
    const isLight = luminance > 0.5
    console.log(`[DEBUG isLightColor] Color: ${color}, RGB: (${r}, ${g}, ${b}), Luminance: ${luminance.toFixed(3)}, isLight: ${isLight}`)
    
    return isLight
  } catch (e) {
    console.error(`[DEBUG isLightColor] Error processing color ${color}:`, e)
    return false
  }
}

// Function to get appropriate text color based on background
function getTextColor(backgroundColor) {
  const isLight = isLightColor(backgroundColor)
  const textColor = isLight ? '#000000' : '#ffffff'
  console.log(`[DEBUG getTextColor] Background: ${backgroundColor}, isLight: ${isLight}, Text: ${textColor}`)
  return textColor
}


export async function loadMessages() {
  if (!state.ACTIVE_CONVERSATION_ID) return

  const messages = await fetchMessages(state.ACTIVE_CONVERSATION_ID)
  const messagesDiv = dom.messages()

  // Check if messages container exists before trying to update it
  if (!messagesDiv) {
    console.log("[DEBUG messages] Messages container not found, skipping load")
    return
  }

  if (!messages || messages.length === 0) {
    messagesDiv.innerHTML = ""
    return
  }
  
  // Debug: Log first message to see what data we're getting
  if (messages.length > 0) {
    console.log("[DEBUG messages] First message data:", JSON.stringify(messages[0], null, 2))
    console.log("[DEBUG messages] First message has message_color?", "message_color" in messages[0])
    console.log("[DEBUG messages] First message message_color value:", messages[0].message_color)
    console.log("[DEBUG messages] Current user color from state:", state.CURRENT_USER_MESSAGE_COLOR)
    console.log("[DEBUG messages] Current user color from localStorage:", localStorage.getItem("messageColor"))
  }

  // Clear messages container
  messagesDiv.innerHTML = ""

  // CRITICAL: Backend should already send messages in correct order (oldest first)
  // But verify and sort as backup to ensure correct order
  // Sort by timestamp ASC (oldest first), then by id ASC (earlier first)
  messages.sort((a, b) => {
    // Parse timestamps
    const timeA = a.created_at || a.timestamp
    const timeB = b.created_at || b.timestamp
    
    if (!timeA && !timeB) return (a.id || 0) - (b.id || 0)
    if (!timeA) return -1  // A comes first if it has no timestamp
    if (!timeB) return 1   // B comes first if it has no timestamp
    
    const dateA = new Date(timeA).getTime()
    const dateB = new Date(timeB).getTime()
    
    // If timestamps are different, sort by timestamp (oldest first)
    if (dateA !== dateB) {
      return dateA - dateB
    }
    
    // If timestamps are equal, sort by ID (earlier messages have lower IDs)
    return (a.id || 0) - (b.id || 0)
  })
  
  // Debug: Log order verification
  console.log("[DEBUG messages.js] Message order verification:")
  console.log(`  Total messages: ${messages.length}`)
  if (messages.length > 0) {
    console.log(`  First message: id=${messages[0].id}, content="${messages[0].content.substring(0, 30)}...", timestamp=${messages[0].timestamp || messages[0].created_at}`)
    console.log(`  Last message: id=${messages[messages.length - 1].id}, content="${messages[messages.length - 1].content.substring(0, 30)}...", timestamp=${messages[messages.length - 1].timestamp || messages[messages.length - 1].created_at}`)
  }

  // Build all messages in order (oldest to newest)
  const fragment = document.createDocumentFragment()
  let imageLoadCount = 0
  const totalImages = messages.length * 2 // Each message has an avatar
  
  const onImageLoad = () => {
    imageLoadCount++
  }
  
  messages.forEach((msg, index) => {
    const row = document.createElement("div")
    
    // Add animation for message appearance (subtle fade in)
    row.style.opacity = "0"
    row.style.animation = `fadeIn 0.3s ease-out ${index * 0.02}s forwards`
    
    // Add data attributes for debugging and verification
    row.setAttribute('data-message-id', msg.id)
    row.setAttribute('data-message-index', index)
    row.setAttribute('data-message-timestamp', msg.timestamp || msg.created_at || '')
    
    const avatar = msg.sender_avatar || (msg.sender_id === state.CURRENT_USER_ID ? state.CURRENT_USER_AVATAR : null)
    const avatarSrc = avatar ? `/static/avatars/${avatar}` : '/static/avatars/default.png'

    if (msg.sender_id === state.CURRENT_USER_ID) {
      row.className = "message-row outgoing-row"
      // Get message color from database (stored with message) or fallback to user's current color
      // Priority: 1. message_color from DB, 2. current user's color from state, 3. localStorage, 4. default
      const messageColor = msg.message_color || state.CURRENT_USER_MESSAGE_COLOR || localStorage.getItem("messageColor") || "#6b7280"
      console.log(`[DEBUG messages] Outgoing message ${msg.id}:`, {
        msg_message_color: msg.message_color,
        state_color: state.CURRENT_USER_MESSAGE_COLOR,
        localStorage_color: localStorage.getItem("messageColor"),
        final_color: messageColor,
        full_msg: msg
      })
      // Create elements and set styles directly to ensure they apply
      const messageDiv = document.createElement("div")
      messageDiv.className = "message outgoing"
      // Use appropriate text color based on background brightness
      const textColor = getTextColor(messageColor)
      const isLight = isLightColor(messageColor)
      console.log(`[DEBUG messages] Outgoing - Color: ${messageColor}, isLight: ${isLight}, textColor: ${textColor}`)
      // Set all styles using cssText for maximum override
      messageDiv.style.cssText = `
        background: ${messageColor} !important;
        background-image: none !important;
        background-color: ${messageColor} !important;
        color: ${textColor} !important;
      `
      // Regular text message
      const textP = document.createElement("p")
      textP.className = "text"
      textP.style.cssText = `color: ${textColor} !important; margin: 0; padding: 0;`
      textP.textContent = msg.content
      messageDiv.appendChild(textP)
      
      const avatarImg = document.createElement("img")
      avatarImg.className = "message-avatar"
      avatarImg.src = avatarSrc
      avatarImg.alt = "Avatar"
      avatarImg.onerror = function() { this.src = '/static/avatars/default.png' }
      // Add click handler to view profile (only for incoming messages)
      avatarImg.style.cursor = "pointer"
      avatarImg.onclick = (e) => {
        e.preventDefault()
        e.stopPropagation()
        // Immediately clear chat content for smooth transition
        const content = dom.content()
        if (content) {
          content.innerHTML = ""
          content.style.opacity = "0.5"
        }
        import("./profile.js").then(({ viewProfile }) => {
          viewProfile(msg.sender_id)
        })
      }
      
      row.appendChild(messageDiv)
      row.appendChild(avatarImg)
    } else {
      row.className = "message-row incoming-row"
      // For incoming messages, use the sender's message color from database
      // This allows everyone to see the color the sender chose
      const messageColor = msg.message_color || "#6b7280"  // Default grey if not set
      console.log(`[DEBUG messages] Incoming message ${msg.id}:`, {
        msg_message_color: msg.message_color,
        final_color: messageColor,
        full_msg: msg
      })
      // Create elements and set styles directly
      const avatarImg = document.createElement("img")
      avatarImg.className = "message-avatar"
      avatarImg.src = avatarSrc
      avatarImg.alt = "Avatar"
      avatarImg.onerror = function() { this.src = '/static/avatars/default.png' }
      // Add click handler to view profile (only for incoming messages)
      avatarImg.style.cursor = "pointer"
      avatarImg.onclick = (e) => {
        e.preventDefault()
        e.stopPropagation()
        // Immediately clear chat content for smooth transition
        const content = dom.content()
        if (content) {
          content.innerHTML = ""
          content.style.opacity = "0.5"
        }
        import("./profile.js").then(({ viewProfile }) => {
          viewProfile(msg.sender_id)
        })
      }
      
      // Use appropriate text color based on background brightness
      const textColor = getTextColor(messageColor)
      const isLight = isLightColor(messageColor)
      console.log(`[DEBUG messages] Incoming - Color: ${messageColor}, isLight: ${isLight}, textColor: ${textColor}`)
      
      const messageDiv = document.createElement("div")
      messageDiv.className = "message incoming"
      // Set all styles using cssText for maximum override
      messageDiv.style.cssText = `
        background: ${messageColor} !important;
        background-image: none !important;
        background-color: ${messageColor} !important;
        color: ${textColor} !important;
      `
      
      // Regular text message
      const textP = document.createElement("p")
      textP.className = "text"
      textP.style.cssText = `color: ${textColor} !important; margin: 0; padding: 0;`
      textP.textContent = msg.content
      messageDiv.appendChild(textP)
      
      row.appendChild(avatarImg)
      row.appendChild(messageDiv)
    }
    
    // Track image loads for scroll timing
    const img = row.querySelector('.message-avatar')
    if (img) {
      if (img.complete) {
        onImageLoad()
      } else {
        img.addEventListener('load', onImageLoad)
        img.addEventListener('error', onImageLoad) // Count errors too
      }
    } else {
      onImageLoad() // No image, count as loaded
    }
    
    fragment.appendChild(row)
  })
  
  // Add all messages at once to DOM
  messagesDiv.appendChild(fragment)
  
  // Verify DOM order after append
  const allRows = messagesDiv.querySelectorAll('.message-row')
  console.log(`[DEBUG DOM Order] Total rows in DOM: ${allRows.length}`)
  if (allRows.length > 0) {
    const firstRow = allRows[0]
    const lastRow = allRows[allRows.length - 1]
    console.log(`  First row in DOM: id=${firstRow.getAttribute('data-message-id')}, content="${firstRow.querySelector('.text')?.textContent?.substring(0, 30)}..."`)
    console.log(`  Last row in DOM: id=${lastRow.getAttribute('data-message-id')}, content="${lastRow.querySelector('.text')?.textContent?.substring(0, 30)}..."`)
  }
  
  // CRITICAL: Scroll to bottom function
  const scrollToBottom = () => {
    if (!messagesDiv) return
    
    // Calculate maximum scroll position
    const scrollHeight = messagesDiv.scrollHeight
    const clientHeight = messagesDiv.clientHeight
    const maxScroll = scrollHeight - clientHeight
    
    // Set scroll position to bottom
    messagesDiv.scrollTop = Math.max(0, maxScroll)
    
    // Debug scroll position
    const actualScroll = messagesDiv.scrollTop
    const isAtBottom = Math.abs(maxScroll - actualScroll) < 5
    
    console.log(`[DEBUG Scroll] scrollHeight=${scrollHeight}, clientHeight=${clientHeight}, maxScroll=${maxScroll}, actualScroll=${actualScroll}, isAtBottom=${isAtBottom}`)
  }
  
  // Immediate scroll
  scrollToBottom()
  
  // Scroll after short delays (for DOM layout)
  setTimeout(scrollToBottom, 0)
  setTimeout(scrollToBottom, 10)
  setTimeout(scrollToBottom, 50)
  setTimeout(scrollToBottom, 100)
  setTimeout(scrollToBottom, 200)
  
  // Scroll after images load (important for accurate scrollHeight)
  setTimeout(scrollToBottom, 300)
  setTimeout(scrollToBottom, 500)
  
  // Use requestAnimationFrame for after paint
  requestAnimationFrame(() => {
    scrollToBottom()
    requestAnimationFrame(() => {
      scrollToBottom()
      setTimeout(scrollToBottom, 50)
    })
  })
  
  // Final backup: scrollIntoView on last message
  setTimeout(() => {
    const lastRow = messagesDiv.lastElementChild
    if (lastRow) {
      lastRow.scrollIntoView({ block: 'end', behavior: 'auto', inline: 'nearest' })
      console.log("[DEBUG Scroll] Used scrollIntoView on last message")
    }
  }, 600)
}


export async function sendMessage() {
  const input = document.getElementById("message-input")
  const text = input.value.trim()

  if (!text || !state.ACTIVE_CONVERSATION_ID) return

  input.value = ""
  
  console.log("[DEBUG sendMessage] Sending message:", text)
  
  await sendMessageApi(state.ACTIVE_CONVERSATION_ID, text)

  // Reload all messages (this will sort and render them correctly)
  await loadMessages()
  
  // If we came from friends, refresh the chat list in the background
  // so the conversation appears when user goes back
  if (state.CAME_FROM_FRIENDS) {
    // Refresh chat list in background (don't await, just trigger)
    import("./chats.js").then(({ renderChats }) => {
      // Small delay to ensure message is saved
      setTimeout(() => {
        renderChats().catch(err => console.error("[DEBUG] Error refreshing chats:", err))
      }, 500)
    })
  }
  
  // Extra aggressive scroll to bottom after loadMessages completes
  const messagesDiv = dom.messages()
  if (messagesDiv) {
    const scrollToBottom = () => {
      const scrollHeight = messagesDiv.scrollHeight
      const clientHeight = messagesDiv.clientHeight
      const maxScroll = scrollHeight - clientHeight
      messagesDiv.scrollTop = Math.max(0, maxScroll)
      
      console.log(`[DEBUG sendMessage Scroll] scrollHeight=${scrollHeight}, clientHeight=${clientHeight}, scrollTop=${messagesDiv.scrollTop}`)
    }
    
    // Multiple scroll attempts
    scrollToBottom()
    setTimeout(scrollToBottom, 0)
    setTimeout(scrollToBottom, 50)
    setTimeout(scrollToBottom, 100)
    setTimeout(scrollToBottom, 200)
    setTimeout(scrollToBottom, 300)
    setTimeout(scrollToBottom, 500)
    
    requestAnimationFrame(() => {
      scrollToBottom()
      requestAnimationFrame(() => {
        scrollToBottom()
        setTimeout(scrollToBottom, 100)
      })
    })
    
    // Final backup: scrollIntoView
    setTimeout(() => {
      const lastRow = messagesDiv.lastElementChild
      if (lastRow) {
        lastRow.scrollIntoView({ block: 'end', behavior: 'auto', inline: 'nearest' })
        console.log("[DEBUG sendMessage] Used scrollIntoView on last message")
      }
    }, 600)
  }
}
