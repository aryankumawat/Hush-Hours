import { state } from "../state.js"
import { fetchMessages, sendMessageApi } from "./api.js"
import { dom } from "../utils/dom.js"


export async function loadMessages() {
  if (!state.ACTIVE_CONVERSATION_ID) return

  const messages = await fetchMessages(state.ACTIVE_CONVERSATION_ID)
  const messagesDiv = dom.messages()

  if (!messages || messages.length === 0) {
    messagesDiv.innerHTML = ""
    return
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
    
    // Add data attributes for debugging and verification
    row.setAttribute('data-message-id', msg.id)
    row.setAttribute('data-message-index', index)
    row.setAttribute('data-message-timestamp', msg.timestamp || msg.created_at || '')
    
    const avatar = msg.sender_avatar || (msg.sender_id === state.CURRENT_USER_ID ? state.CURRENT_USER_AVATAR : null)
    const avatarSrc = avatar ? `/static/avatars/${avatar}` : '/static/avatars/default.png'

    if (msg.sender_id === state.CURRENT_USER_ID) {
      row.className = "message-row outgoing-row"
      row.innerHTML = `
        <div class="message outgoing">
          <p class="text">${msg.content}</p>
        </div>
        <img class="message-avatar" src="${avatarSrc}" alt="Avatar" onerror="this.src='/static/avatars/default.png'">
      `
    } else {
      row.className = "message-row incoming-row"
      row.innerHTML = `
        <img class="message-avatar" src="${avatarSrc}" alt="Avatar" onerror="this.src='/static/avatars/default.png'">
        <div class="message incoming">
          <p class="text">${msg.content}</p>
        </div>
      `
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
