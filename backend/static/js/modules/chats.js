import { state } from "../state.js"
import { fetchConversations, likeConversation, unlikeConversation, likeGroup, unlikeGroup } from "./api.js"
import { loadMessages, sendMessage } from "./messages.js"
import { dom } from "../utils/dom.js"
import { 
  startRecording, 
  stopRecording, 
  cancelRecording, 
  isRecording,
  startRecordingTimer,
  clearRecordingTimer,
  isRecordingSupported
} from "./voiceRecorder.js"

export async function renderChats() {
  dom.topBar().innerHTML = `
    <div class="top-nav">
      <i class="fa-solid fa-comments active" data-mode="all"></i>
      <i class="fa-solid fa-users" data-mode="groups"></i>
      <i class="fa-solid fa-user-lock" data-mode="private"></i>
      <i class="fa-solid fa-heart" data-mode="favourites"></i>
    </div>
  `

  setupTopNav()
  
  // Add create group button to page header (extreme right)
  const pageHeader = document.querySelector(".page-header")
  if (pageHeader) {
    // Remove existing button if any
    const existingBtn = pageHeader.querySelector(".create-group-header-btn")
    if (existingBtn) {
      existingBtn.remove()
    }
    
    // Add new button at extreme right
    const createBtn = document.createElement("button")
    createBtn.className = "create-group-header-btn"
    createBtn.id = "create-group-header-btn"
    createBtn.title = "Create Group"
    createBtn.innerHTML = '<i class="fa-solid fa-plus"></i>'
    createBtn.style.marginLeft = "auto" // Push to extreme right
    pageHeader.appendChild(createBtn)
    setupCreateGroupButton()
  }

  const card = document.querySelector(".card")
  const bottomNav = document.querySelector(".bottom-nav")
  if (card) card.classList.remove("chat-active")
  if (bottomNav) bottomNav.style.display = "flex"

  dom.content().className = "app-content"
  dom.content().innerHTML = `<div class="chat-list" id="chat-list"></div>`

  const conversations = await fetchConversations()
  console.log("[DEBUG Frontend] Received conversations:", conversations)
  console.log("[DEBUG Frontend] Number of conversations:", conversations.length)
  
  // Debug: Log each conversation
  conversations.forEach((conv, i) => {
    if (conv.is_group) {
      console.log(`  ${i+1}. Group ${conv.group_id}: ${conv.other_display_name}`)
    } else {
      console.log(`  ${i+1}. Conversation ${conv.conversation_id} with ${conv.other_display_name || conv.other_username} (user_id: ${conv.other_user_id}), last_msg_time: ${conv.last_message_time}`)
    }
  })
  
  // CRITICAL: Sort conversations by last_message_time (most recent first)
  // This ensures chats with the most recent messages appear at the top
  const sortedConversations = [...conversations].sort((a, b) => {
    const timeA = a.last_message_time || "1970-01-01T00:00:00"
    const timeB = b.last_message_time || "1970-01-01T00:00:00"
    
    // Most recent first (DESC order)
    if (timeA > timeB) return -1
    if (timeA < timeB) return 1
    
    // If times are equal, sort by ID (conversation_id for personal chats, group_id for groups)
    const idA = a.conversation_id || a.group_id || 0
    const idB = b.conversation_id || b.group_id || 0
    return idB - idA  // Newer IDs first
  })
  
  console.log("[DEBUG Frontend] Sorted conversations by last_message_time:")
  sortedConversations.forEach((conv, i) => {
    if (conv.is_group) {
      console.log(`  ${i+1}. Group ${conv.group_id}: ${conv.other_display_name} - last_message_time: ${conv.last_message_time}`)
    } else {
      console.log(`  ${i+1}. Conversation ${conv.conversation_id} with ${conv.other_display_name || conv.other_username} (user_id: ${conv.other_user_id}) - last_message_time: ${conv.last_message_time}`)
    }
  })
  
  state.allConversations = sortedConversations

  const list = dom.chatList()

  if (sortedConversations.length === 0) {
    list.innerHTML = `<p style="text-align:center; opacity:0.6;">No chats yet</p>`
    return
  }

  console.log("[DEBUG Frontend] Displaying conversations:", sortedConversations.length)
  displayConversations(sortedConversations, list)
}

function displayConversations(conversations, list) {
  list.innerHTML = ""
  
  console.log("[DEBUG displayConversations] Displaying", conversations.length, "conversations")
  
  // Filter out any null or invalid conversations
  const validConversations = conversations.filter(conv => {
    // Groups are valid even without conversation_id
    if (conv.is_group) return true
    // Personal chats must have conversation_id
    if (!conv.conversation_id) {
      console.warn("[DEBUG displayConversations] Skipping conversation without ID:", conv)
      return false
    }
    return true
  })
  
  console.log("[DEBUG displayConversations] Valid conversations:", validConversations.length)

  validConversations.forEach((conv, index) => {
    console.log(`[DEBUG displayConversations] Rendering item ${index + 1}:`, conv.is_group ? `Group ${conv.group_id}: ${conv.other_display_name}` : `Conversation ${conv.conversation_id} with ${conv.other_display_name || conv.other_username}`)
    
    const item = document.createElement("div")
    item.className = "chat-item stagger-item"
    item.style.animationDelay = `${index * 0.05}s`
    item.setAttribute("data-conversation-id", conv.conversation_id || "group-" + conv.group_id)

    const preview = conv.last_message_content || "Tap to open chat"
    const isLiked = conv.is_liked || false
    const heartClass = isLiked ? "chat-heart liked" : "chat-heart"

    // Check if it's a group
    const isGroup = conv.is_group || false
    
    if (isGroup) {
      // Extract emoji from group name or use random emoji
      const emoji = extractEmoji(conv.other_display_name) || getRandomEmoji(conv.group_id)
      const isLikedGroup = conv.is_liked || false
      const heartClassGroup = isLikedGroup ? "chat-heart liked" : "chat-heart"
      // Group chat item
      item.innerHTML = `
        <div class="chat-avatar group-avatar-emoji">
          ${emoji}
        </div>
        <div class="chat-meta">
          <div class="chat-name">${conv.other_display_name}</div>
          <div class="chat-preview">${preview}</div>
        </div>
        <i class="fa-solid fa-heart ${heartClassGroup}" data-group-id="${conv.group_id}"></i>
      `
    } else {
      // Personal chat item
      const avatarSrc = conv.other_avatar ? `/static/avatars/${conv.other_avatar}` : '/static/avatars/default.png'
      item.innerHTML = `
        <img class="chat-avatar" src="${avatarSrc}" onerror="this.src='/static/avatars/default.png'">
        <div class="chat-meta">
          <div class="chat-name">${conv.other_display_name || conv.other_username}</div>
          <div class="chat-preview">${preview}</div>
        </div>
        <i class="fa-solid fa-heart ${heartClass}" data-conversation-id="${conv.conversation_id}"></i>
      `
    }

    // Click on chat item (not heart) to open chat
    item.onclick = async (e) => {
      // Don't open chat if clicking on heart
      if (e.target.closest('.chat-heart')) {
        return
      }
      
      if (isGroup) {
        // Open group chat
        state.ACTIVE_GROUP_ID = conv.group_id
        state.CAME_FROM_GROUPS = false  // Coming from chats, not groups page
        dom.pageTitle().innerText = conv.other_display_name
        const { renderGroupChatView } = await import("./groupChat.js")
        renderGroupChatView()
      } else {
        // Open personal chat
        state.ACTIVE_CONVERSATION_ID = conv.conversation_id
        state.ACTIVE_CHAT_OTHER_USER_ID = conv.other_user_id  // Store other user ID for profile viewing
        dom.pageTitle().innerText = conv.other_display_name || conv.other_username
        renderChatView()
      }
    }

    // Heart click handler (for both personal chats and groups)
    const heartIcon = item.querySelector('.chat-heart')
    if (heartIcon) {
      heartIcon.onclick = async (e) => {
        e.stopPropagation() // Prevent opening chat
        
        if (isGroup) {
          // Handle group like/unlike
          const groupId = conv.group_id
          const wasLiked = conv.is_liked || false
          
          try {
            if (wasLiked) {
              await unlikeGroup(groupId)
              conv.is_liked = false
              heartIcon.classList.remove('liked')
            } else {
              await likeGroup(groupId)
              conv.is_liked = true
              heartIcon.classList.add('liked')
            }
            
            // Update state
            const stateGroup = state.allConversations.find(c => c.group_id === groupId && c.is_group)
            if (stateGroup) {
              stateGroup.is_liked = conv.is_liked
            }
            
            // If in favourites mode, refresh the list
            const activeMode = document.querySelector('.top-nav i.active')?.dataset.mode
            if (activeMode === 'favourites') {
              filterChats('favourites')
            }
          } catch (error) {
            console.error("Error toggling group like:", error)
          }
        } else {
          // Handle personal chat like/unlike
          const conversationId = conv.conversation_id
          const wasLiked = conv.is_liked || false
          
          try {
            if (wasLiked) {
              await unlikeConversation(conversationId)
              conv.is_liked = false
              heartIcon.classList.remove('liked')
            } else {
              await likeConversation(conversationId)
              conv.is_liked = true
              heartIcon.classList.add('liked')
            }
            
            // Update state
            const stateConv = state.allConversations.find(c => c.conversation_id === conversationId)
            if (stateConv) {
              stateConv.is_liked = conv.is_liked
            }
            
            // If in favourites mode, refresh the list
            const activeMode = document.querySelector('.top-nav i.active')?.dataset.mode
            if (activeMode === 'favourites') {
              filterChats('favourites')
            }
          } catch (error) {
            console.error("Error toggling like:", error)
          }
        }
      }
    }

    list.appendChild(item)
  })
}

export function renderChatView() {
  // Remove create group button when opening a chat
  const pageHeader = document.querySelector(".page-header")
  if (pageHeader) {
    const existingBtn = pageHeader.querySelector(".create-group-header-btn")
    if (existingBtn) {
      existingBtn.remove()
    }
  }
  
  // Show top bar for chat view
  const topBar = dom.topBar()
  if (!topBar) {
    console.error("[DEBUG chats] Top bar not found!")
    return
  }
  
  topBar.style.display = "flex"
  
  // Get username from page title or use a default
  const pageTitleEl = dom.pageTitle()
  const username = (pageTitleEl && pageTitleEl.innerText) ? pageTitleEl.innerText : "Chat"
  
  topBar.innerHTML = `
    <button class="back-button">
      <i class="fa-solid fa-arrow-left"></i>
      <span>Back</span>
    </button>
    <h2 class="chat-header-title" id="personal-chat-header-title" style="cursor: pointer; user-select: none; pointer-events: auto;">${username}</h2>
  `
  
  // Make username header clickable to view profile (only for personal chats, not groups)
  setTimeout(() => {
    const chatHeaderTitle = document.getElementById("personal-chat-header-title")
    if (chatHeaderTitle && state.ACTIVE_CHAT_OTHER_USER_ID) {
      console.log("[DEBUG chats] Setting up personal chat header click handler for user:", state.ACTIVE_CHAT_OTHER_USER_ID)
      chatHeaderTitle.onclick = (e) => {
        e.preventDefault()
        e.stopPropagation()
        console.log("[DEBUG chats] Personal chat header clicked!")
        import("./profile.js").then(({ viewProfile }) => {
          viewProfile(state.ACTIVE_CHAT_OTHER_USER_ID)
        })
      }
      // Also add touch event for mobile
      chatHeaderTitle.ontouchstart = (e) => {
        e.preventDefault()
        e.stopPropagation()
        import("./profile.js").then(({ viewProfile }) => {
          viewProfile(state.ACTIVE_CHAT_OTHER_USER_ID)
        })
      }
    }
  }, 100)

  topBar.querySelector(".back-button").onclick = async () => {
    console.log("[DEBUG renderChatView] Back button clicked")
    
    // Check where we came from
    if (state.CAME_FROM_FRIENDS) {
      // If we came from friends, go back to friends
      state.CAME_FROM_FRIENDS = false
      const { showTab } = await import("./navigation.js")
      showTab("friends")
      return
    }
    
    // Otherwise, go back to chats list
    state.allConversations = []
    await renderChats()
    // Update navigation to show chats tab as active
    const chatsTab = document.querySelector('.nav-item[data-tab="chats"]')
    if (chatsTab) {
      document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'))
      chatsTab.classList.add('active')
    }
  }

  const card = document.querySelector(".card")
  const bottomNav = document.querySelector(".bottom-nav")
  if (card) card.classList.add("chat-active")
  if (bottomNav) bottomNav.style.display = "none"

  // Ensure avatar click handler is set up even when bottom nav is hidden
  setTimeout(() => {
    const avatarImg = dom.avatarImg()
    const avatarNavItem = document.querySelector(".avatar-nav")
    
    if (avatarImg) {
      avatarImg.style.cursor = "pointer"
      avatarImg.onclick = (e) => {
        e.stopPropagation()
        // Navigate to profile tab
        import("./navigation.js").then(({ showTab }) => {
          showTab("avatar")
        })
      }
    }
    
    if (avatarNavItem) {
      avatarNavItem.style.cursor = "pointer"
      avatarNavItem.onclick = (e) => {
        e.stopPropagation()
        import("./navigation.js").then(({ showTab }) => {
          showTab("avatar")
        })
      }
    }
  }, 100)

  dom.content().className = "app-content chat-active"
  dom.content().innerHTML = `
    <div class="chat-window">
      <div class="messages" id="messages"></div>
      <div class="chat-input">
        <button id="voice-button" class="voice-button" title="Hold to record voice message">
          <i class="fa-solid fa-microphone"></i>
        </button>
        <input id="message-input" placeholder="Type a message">
        <button id="send-button">↑</button>
      </div>
      <div id="recording-indicator" class="recording-indicator" style="display: none;">
        <div class="recording-pulse"></div>
        <span id="recording-time">0:00</span>
        <button id="cancel-recording" class="cancel-recording-btn" title="Cancel">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
    </div>
  `

  document.getElementById("send-button").onclick = sendMessage
  document.getElementById("message-input").onkeypress = e => {
    if (e.key === "Enter") sendMessage()
  }

  // Setup voice recording
  setupVoiceRecording()

  loadMessages()
}

function setupTopNav() {
  const icons = document.querySelectorAll(".top-nav i")

  icons.forEach(icon => {
    icon.onclick = () => {
      icons.forEach(i => i.classList.remove("active"))
      icon.classList.add("active")
      filterChats(icon.dataset.mode)
    }
  })
}

function setupCreateGroupButton() {
  const createGroupBtn = document.getElementById("create-group-header-btn")
  if (createGroupBtn) {
    createGroupBtn.onclick = () => {
      showCreateGroupModal()
    }
  }
}

export function showCreateGroupModal() {
  const modal = document.createElement("div")
  modal.className = "create-group-modal"
  modal.innerHTML = `
    <div class="create-group-modal-content">
      <div class="create-group-modal-header">
        <h3>Create New Group</h3>
        <button class="modal-close-btn" id="close-create-modal">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
      <div class="create-group-modal-body">
        <input type="text" id="group-name-input" placeholder="Enter group name..." maxlength="50" autofocus>
        <div class="modal-actions">
          <button class="modal-cancel-btn" id="cancel-create-group">Cancel</button>
          <button class="modal-create-btn" id="confirm-create-group">Create</button>
        </div>
      </div>
    </div>
  `
  
  document.body.appendChild(modal)
  
  // Close handlers
  const closeBtn = modal.querySelector("#close-create-modal")
  const cancelBtn = modal.querySelector("#cancel-create-group")
  const confirmBtn = modal.querySelector("#confirm-create-group")
  const nameInput = modal.querySelector("#group-name-input")
  
  const closeModal = () => {
    document.body.removeChild(modal)
  }
  
  closeBtn.onclick = closeModal
  cancelBtn.onclick = closeModal
  
  // Create group
  confirmBtn.onclick = async () => {
    const groupName = nameInput.value.trim()
    
    if (!groupName) {
      alert("Please enter a group name")
      return
    }
    
    try {
      const response = await fetch("/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: groupName })
      })
      
      if (response.ok) {
        const groupData = await response.json()
        closeModal()
        
        // Open the newly created group chat immediately
        state.ACTIVE_GROUP_ID = groupData.id
        state.CAME_FROM_GROUPS = false  // Coming from chats, not groups page
        dom.pageTitle().innerText = groupData.name
        
        const { renderGroupChatView } = await import("./groupChat.js")
        await renderGroupChatView()
      } else {
        const data = await response.json()
        alert(data.error || "Failed to create group")
      }
    } catch (error) {
      console.error("[DEBUG chats] Error creating group:", error)
      alert("Failed to create group. Please try again.")
    }
  }
  
  // Close on escape key
  nameInput.onkeydown = (e) => {
    if (e.key === "Escape") {
      closeModal()
    } else if (e.key === "Enter") {
      confirmBtn.click()
    }
  }
}

function filterChats(mode) {
  const list = dom.chatList()
  if (!list) return

  // Add/remove glow effect on heart icon in top nav
  const heartIcon = document.querySelector('.top-nav i[data-mode="favourites"]')
  if (heartIcon) {
    if (mode === "favourites") {
      heartIcon.classList.add("glow")
    } else {
      heartIcon.classList.remove("glow")
    }
  }

  if (mode === "all" || mode === "private") {
    // Re-sort conversations before displaying (in case new messages arrived)
    // Filter to only show personal chats (not groups) for "private" mode
    let conversationsToShow = state.allConversations
    if (mode === "private") {
      conversationsToShow = state.allConversations.filter(conv => !conv.is_group)
    }
    
    console.log(`[DEBUG filterChats] Mode: ${mode}, Showing ${conversationsToShow.length} conversations`)
    
    const sorted = [...conversationsToShow].sort((a, b) => {
      const timeA = a.last_message_time || "1970-01-01T00:00:00"
      const timeB = b.last_message_time || "1970-01-01T00:00:00"
      if (timeA > timeB) return -1
      if (timeA < timeB) return 1
      return (b.conversation_id || 0) - (a.conversation_id || 0)
    })
    displayConversations(sorted, list)
  } else if (mode === "groups") {
    // Show only groups (joined groups from conversations)
    const groupsOnly = state.allConversations.filter(conv => conv.is_group)
    
    console.log(`[DEBUG filterChats] Mode: groups, Showing ${groupsOnly.length} groups`)
    
    if (groupsOnly.length === 0) {
      list.innerHTML = "<p style='opacity:0.6; text-align:center; padding:40px;'>No groups yet. Join a group to start chatting!</p>"
    } else {
      // Sort groups by last message time
      const sorted = [...groupsOnly].sort((a, b) => {
        const timeA = a.last_message_time || "1970-01-01T00:00:00"
        const timeB = b.last_message_time || "1970-01-01T00:00:00"
        if (timeA > timeB) return -1
        if (timeA < timeB) return 1
        return (b.group_id || 0) - (a.group_id || 0)
      })
      displayConversations(sorted, list)
    }
  } else if (mode === "favourites") {
    // Show only liked chats and groups, sorted by last message time
    const likedChats = state.allConversations.filter(conv => conv.is_liked)
    const sorted = [...likedChats].sort((a, b) => {
      const timeA = a.last_message_time || "1970-01-01T00:00:00"
      const timeB = b.last_message_time || "1970-01-01T00:00:00"
      if (timeA > timeB) return -1
      if (timeA < timeB) return 1
      // Sort by ID (conversation_id for chats, group_id for groups)
      const idA = a.conversation_id || a.group_id || 0
      const idB = b.conversation_id || b.group_id || 0
      return idB - idA
    })
    
    if (sorted.length === 0) {
      list.innerHTML = "<p style='opacity:0.6; text-align:center; padding:40px;'>No liked chats yet</p>"
    } else {
      displayConversations(sorted, list)
    }
  }
}

// Helper functions for group emojis
function extractEmoji(text) {
  // Extract first emoji from text using regex
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u
  const match = text.match(emojiRegex)
  return match ? match[0] : null
}

function getRandomEmoji(groupId) {
  // Use groupId as seed for consistent emoji per group
  const emojis = ['🎉', '🌟', '🔥', '💫', '⚡', '🎊', '✨', '🎈', '🎁', '🎯', '🎪', '🎭', '🎨', '🎬', '🎮', '🎲', '🎸', '🎺', '🎻', '🥁']
  return emojis[groupId % emojis.length]
}

// Voice Recording Setup
function setupVoiceRecording() {
  const voiceButton = document.getElementById("voice-button")
  const recordingIndicator = document.getElementById("recording-indicator")
  const recordingTime = document.getElementById("recording-time")
  const cancelBtn = document.getElementById("cancel-recording")
  
  if (!voiceButton || !isRecordingSupported()) {
    // Hide voice button if not supported
    if (voiceButton) voiceButton.style.display = "none"
    return
  }
  
  let isPressing = false
  let pressTimer = null
  
  // Mouse/Touch events for recording
  const startPress = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (isPressing) return
    isPressing = true
    
    // Start recording after short delay (to distinguish from click)
    pressTimer = setTimeout(async () => {
      const started = await startRecording()
      if (started) {
        // Show recording indicator
        if (recordingIndicator) recordingIndicator.style.display = "flex"
        voiceButton.classList.add("recording")
        
        // Start timer
        startRecordingTimer((duration) => {
          const minutes = Math.floor(duration / 60)
          const seconds = duration % 60
          if (recordingTime) {
            recordingTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`
          }
        })
      }
    }, 200) // 200ms delay to distinguish from click
  }
  
  const endPress = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!isPressing) return
    isPressing = false
    
    clearTimeout(pressTimer)
    
    // If recording, stop and send
    if (isRecording()) {
      try {
        const recording = await stopRecording()
        clearRecordingTimer()
        
        // Hide recording indicator
        if (recordingIndicator) recordingIndicator.style.display = "none"
        voiceButton.classList.remove("recording")
        
        // Send voice message
        if (recording.duration >= 1) { // At least 1 second
          await sendVoiceMessage(recording.blob, recording.duration)
        } else {
          alert("Recording too short. Please record at least 1 second.")
        }
      } catch (error) {
        console.error("[DEBUG voiceRecorder] Error stopping recording:", error)
        alert("Failed to process recording. Please try again.")
        if (recordingIndicator) recordingIndicator.style.display = "none"
        voiceButton.classList.remove("recording")
        clearRecordingTimer()
      }
    }
  }
  
  // Mouse events
  voiceButton.onmousedown = startPress
  voiceButton.onmouseup = endPress
  voiceButton.onmouseleave = endPress // Stop if mouse leaves button
  
  // Touch events for mobile
  voiceButton.ontouchstart = startPress
  voiceButton.ontouchend = endPress
  voiceButton.ontouchcancel = endPress
  
  // Cancel button
  if (cancelBtn) {
    cancelBtn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (isRecording()) {
        cancelRecording()
        clearRecordingTimer()
        if (recordingIndicator) recordingIndicator.style.display = "none"
        voiceButton.classList.remove("recording")
      }
    }
  }
}

// Send voice message
async function sendVoiceMessage(audioBlob, duration) {
  if (!state.ACTIVE_CONVERSATION_ID) return
  
  try {
    // Convert blob to base64
    const reader = new FileReader()
    const base64Audio = await new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(audioBlob)
    })
    
    // Send to backend
    const response = await fetch("/messages/voice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        conversation_id: state.ACTIVE_CONVERSATION_ID,
        audio_data: base64Audio,
        duration: duration
      })
    })
    
    if (!response.ok) {
      throw new Error("Failed to send voice message")
    }
    
    // Reload messages
    await loadMessages()
    
    // Refresh chat list if needed
    if (state.CAME_FROM_FRIENDS) {
      import("./chats.js").then(({ renderChats }) => {
        setTimeout(() => {
          renderChats().catch(err => console.error("[DEBUG] Error refreshing chats:", err))
        }, 500)
      })
    }
    
    // Scroll to bottom
    const messagesDiv = dom.messages()
    if (messagesDiv) {
      setTimeout(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight
      }, 100)
    }
    
  } catch (error) {
    console.error("[DEBUG voiceRecorder] Error sending voice message:", error)
    alert("Failed to send voice message. Please try again.")
  }
}
