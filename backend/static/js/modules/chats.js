import { state } from "../state.js"
import { fetchConversations, likeConversation, unlikeConversation } from "./api.js"
import { loadMessages, sendMessage } from "./messages.js"
import { dom } from "../utils/dom.js"

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

  const card = document.querySelector(".card")
  const bottomNav = document.querySelector(".bottom-nav")
  if (card) card.classList.remove("chat-active")
  if (bottomNav) bottomNav.style.display = "flex"

  dom.content().className = "app-content"
  dom.content().innerHTML = `<div class="chat-list" id="chat-list"></div>`

  const conversations = await fetchConversations()
  console.log("[DEBUG Frontend] Received conversations:", conversations)
  console.log("[DEBUG Frontend] Number of conversations:", conversations.length)
  
  // CRITICAL: Sort conversations by last_message_time (most recent first)
  // This ensures chats with the most recent messages appear at the top
  const sortedConversations = [...conversations].sort((a, b) => {
    const timeA = a.last_message_time || "1970-01-01T00:00:00"
    const timeB = b.last_message_time || "1970-01-01T00:00:00"
    
    // Most recent first (DESC order)
    if (timeA > timeB) return -1
    if (timeA < timeB) return 1
    
    // If times are equal, sort by conversation_id DESC (newer conversations first)
    return (b.conversation_id || 0) - (a.conversation_id || 0)
  })
  
  console.log("[DEBUG Frontend] Sorted conversations by last_message_time:")
  sortedConversations.forEach((conv, i) => {
    console.log(`  ${i+1}. Conversation ${conv.conversation_id} with ${conv.other_display_name || conv.other_username} - last_message_time: ${conv.last_message_time}`)
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

  conversations.forEach(conv => {
    const item = document.createElement("div")
    item.className = "chat-item"
    item.setAttribute("data-conversation-id", conv.conversation_id)

    const preview = conv.last_message_content || "Tap to open chat"
    const isLiked = conv.is_liked || false
    const heartClass = isLiked ? "chat-heart liked" : "chat-heart"

    item.innerHTML = `
      <img class="chat-avatar" src="/static/avatars/${conv.other_avatar}">
      <div class="chat-meta">
        <div class="chat-name">${conv.other_display_name || conv.other_username}</div>
        <div class="chat-preview">${preview}</div>
      </div>
      <i class="fa-solid fa-heart ${heartClass}" data-conversation-id="${conv.conversation_id}"></i>
    `

    // Click on chat item (not heart) to open chat
    item.onclick = (e) => {
      // Don't open chat if clicking on heart
      if (e.target.closest('.chat-heart')) {
        return
      }
      state.ACTIVE_CONVERSATION_ID = conv.conversation_id
      dom.pageTitle().innerText = conv.other_display_name || conv.other_username
      renderChatView()
    }

    // Heart click handler
    const heartIcon = item.querySelector('.chat-heart')
    heartIcon.onclick = async (e) => {
      e.stopPropagation() // Prevent opening chat
      
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

    list.appendChild(item)
  })
}

function renderChatView() {
  const username = dom.pageTitle().innerText
  dom.topBar().innerHTML = `
    <button class="back-button">
      <i class="fa-solid fa-arrow-left"></i>
      <span>Back</span>
    </button>
    <h2 class="chat-header-title">${username}</h2>
  `

  dom.topBar().querySelector(".back-button").onclick = renderChats

  const card = document.querySelector(".card")
  const bottomNav = document.querySelector(".bottom-nav")
  if (card) card.classList.add("chat-active")
  if (bottomNav) bottomNav.style.display = "none"

  dom.content().className = "app-content chat-active"
  dom.content().innerHTML = `
    <div class="chat-window">
      <div class="messages" id="messages"></div>
      <div class="chat-input">
        <input id="message-input" placeholder="Type a message">
        <button id="send-button">↑</button>
      </div>
    </div>
  `

  document.getElementById("send-button").onclick = sendMessage
  document.getElementById("message-input").onkeypress = e => {
    if (e.key === "Enter") sendMessage()
  }

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
    const sorted = [...state.allConversations].sort((a, b) => {
      const timeA = a.last_message_time || "1970-01-01T00:00:00"
      const timeB = b.last_message_time || "1970-01-01T00:00:00"
      if (timeA > timeB) return -1
      if (timeA < timeB) return 1
      return (b.conversation_id || 0) - (a.conversation_id || 0)
    })
    displayConversations(sorted, list)
  } else if (mode === "groups") {
    list.innerHTML = "<p style='opacity:0.6; text-align:center; padding:40px;'>Group chats coming soon</p>"
  } else if (mode === "favourites") {
    // Show only liked chats, sorted by last message time
    const likedChats = state.allConversations.filter(conv => conv.is_liked)
    const sorted = [...likedChats].sort((a, b) => {
      const timeA = a.last_message_time || "1970-01-01T00:00:00"
      const timeB = b.last_message_time || "1970-01-01T00:00:00"
      if (timeA > timeB) return -1
      if (timeA < timeB) return 1
      return (b.conversation_id || 0) - (a.conversation_id || 0)
    })
    
    if (sorted.length === 0) {
      list.innerHTML = "<p style='opacity:0.6; text-align:center; padding:40px;'>No liked chats yet</p>"
    } else {
      displayConversations(sorted, list)
    }
  }
}
