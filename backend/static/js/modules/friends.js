import { state } from "../state.js"
import { dom } from "../utils/dom.js"
import { renderChatView } from "./chats.js"

export async function renderFriends() {
  // Remove create group button from friends page
  const pageHeader = document.querySelector(".page-header")
  if (pageHeader) {
    const existingBtn = pageHeader.querySelector(".create-group-header-btn")
    if (existingBtn) {
      existingBtn.remove()
    }
  }
  
  const content = dom.content()
  if (!content) {
    console.error("[DEBUG friends] Content element not found")
    return
  }
  
  // CRITICAL: Set visibility IMMEDIATELY before any async operations
  // This prevents any fade-out from happening
  content.className = "app-content friends-content"
  content.classList.remove("fade-out", "fade-in", "content-slide-up")
  // Disable CSS transitions completely for friends content
  content.style.cssText = `
    opacity: 1 !important;
    transform: translateY(0) !important;
    display: block !important;
    visibility: visible !important;
    transition: none !important;
  `
  // Force a reflow to apply styles immediately
  void content.offsetHeight
  
  try {
    // Fetch friends list
    const response = await fetch("/friends", { credentials: "include" })
    
    if (!response.ok) {
      throw new Error("Failed to fetch friends")
    }
    
    const friends = await response.json()
    
    console.log("[DEBUG friends] Received friends:", friends)
    console.log("[DEBUG friends] Friends count:", friends.length)
    
    // Re-apply visibility styles right before setting innerHTML
    content.classList.remove("fade-out", "fade-in", "content-slide-up")
    content.style.cssText = `
      opacity: 1 !important;
      transform: translateY(0) !important;
      display: block !important;
      visibility: visible !important;
      transition: none !important;
    `
    
    // Render search bar and friends list
    content.innerHTML = `
      <div class="friends-search-container">
        <div class="friends-search-box">
          <i class="fa-solid fa-search"></i>
          <input type="text" id="friends-search-input" placeholder="Search by username..." autocomplete="off">
          <button class="search-clear-btn" id="search-clear-btn" style="display: none;">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <div class="search-results" id="search-results" style="display: none;"></div>
      </div>
      <div class="friends-list-container">
        <h3 class="friends-list-title">Your Friends</h3>
        <div class="friends-list" id="friends-list">
          ${friends.length === 0 ? `
            <div class="friends-empty">
              <p>No friends yet</p>
              <p class="friends-empty-hint">Start chatting with someone to add them to your friends list</p>
            </div>
          ` : friends.map((friend, index) => `
            <div class="friend-item stagger-item" data-friend-id="${friend.friend_id}" style="animation-delay: ${index * 0.05}s;">
              <img class="friend-avatar" src="/static/avatars/${friend.avatar || 'default.png'}" alt="${friend.display_name}" onerror="this.src='/static/avatars/default.png'">
              <div class="friend-info">
                <div class="friend-name">${friend.display_name}</div>
                <div class="friend-points">${friend.points || 0} points</div>
              </div>
              <div class="friend-actions">
                <button class="friend-chat-btn" data-conversation-id="${friend.conversation_id}" data-friend-id="${friend.friend_id}" data-friend-name="${friend.display_name}">
                  <i class="fa-solid fa-comment"></i>
                </button>
                <button class="friend-delete-btn" data-friend-id="${friend.friend_id}">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `
    
    // Setup search functionality
    setupSearch()
    
    // Setup event listeners
    setupFriendListeners()
    
    // Ensure content is visible after rendering - use !important to override everything
    // Use multiple requestAnimationFrame calls to ensure visibility
    // Also use setInterval as a watchdog to keep content visible
    const keepVisible = () => {
      if (content) {
        content.classList.remove("fade-out", "fade-in", "content-slide-up")
        content.style.cssText = `
          opacity: 1 !important;
          transform: translateY(0) !important;
          display: block !important;
          visibility: visible !important;
          transition: none !important;
        `
      }
    }
    
    // Immediate check
    keepVisible()
    
    // Multiple animation frames
    requestAnimationFrame(keepVisible)
    requestAnimationFrame(() => requestAnimationFrame(keepVisible))
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(keepVisible)))
    
    // Watchdog interval to keep content visible (runs for 2 seconds)
    const watchdog = setInterval(keepVisible, 50)
    setTimeout(() => clearInterval(watchdog), 2000)
    
    // Return promise for proper async handling
    return Promise.resolve()
    
  } catch (error) {
    console.error("[DEBUG friends] Error rendering friends:", error)
    if (content) {
      content.className = "app-content friends-content"
      content.innerHTML = `
        <div class="friends-error">
          <p>Error loading friends</p>
          <button class="retry-btn" onclick="location.reload()">Retry</button>
        </div>
      `
    }
    return Promise.reject(error)
  }
}

let searchTimeout = null

function setupSearch() {
  const searchInput = document.getElementById("friends-search-input")
  const searchResults = document.getElementById("search-results")
  const clearBtn = document.getElementById("search-clear-btn")
  const friendsListContainer = document.querySelector(".friends-list-container")
  
  if (!searchInput) return
  
  searchInput.oninput = (e) => {
    const query = e.target.value.trim()
    
    if (query.length === 0) {
      searchResults.style.display = "none"
      clearBtn.style.display = "none"
      if (friendsListContainer) friendsListContainer.style.display = "block"
      return
    }
    
    clearBtn.style.display = "flex"
    if (friendsListContainer) friendsListContainer.style.display = "none"
    
    // Debounce search
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
    
    searchTimeout = setTimeout(async () => {
      try {
        const response = await fetch(`/search-users?q=${encodeURIComponent(query)}`, {
          credentials: "include"
        })
        
        if (!response.ok) {
          throw new Error("Search failed")
        }
        
        const users = await response.json()
        displaySearchResults(users, query)
      } catch (error) {
        console.error("[DEBUG friends] Search error:", error)
        searchResults.innerHTML = `<p class="search-error">Error searching users</p>`
        searchResults.style.display = "block"
      }
    }, 300)
  }
  
  clearBtn.onclick = () => {
    searchInput.value = ""
    searchResults.style.display = "none"
    clearBtn.style.display = "none"
    if (friendsListContainer) friendsListContainer.style.display = "block"
  }
}

function displaySearchResults(users, query) {
  const searchResults = document.getElementById("search-results")
  
  if (users.length === 0) {
    searchResults.innerHTML = `
      <div class="search-empty">
        <p>No users found matching "@${query}"</p>
      </div>
    `
    searchResults.style.display = "block"
    return
  }
  
  searchResults.innerHTML = `
    <div class="search-results-list">
      ${users.map(user => `
        <div class="search-result-item">
          <img class="search-avatar" src="/static/avatars/${user.avatar || 'default.png'}" alt="${user.username}" onerror="this.src='/static/avatars/default.png'">
          <div class="search-user-info">
            <div class="search-username">@${user.username}</div>
            <div class="search-display-name">${user.display_name}</div>
            <div class="search-points">${user.points || 0} points</div>
          </div>
          <div class="search-actions">
            ${user.has_conversation ? `
              <button class="search-chat-btn" data-user-id="${user.user_id}" data-username="${user.username}">
                <i class="fa-solid fa-comment"></i>
                <span>Chat</span>
              </button>
            ` : `
              <button class="search-start-chat-btn" data-user-id="${user.user_id}" data-username="${user.username}">
                <i class="fa-solid fa-plus"></i>
                <span>Start Chat</span>
              </button>
            `}
          </div>
        </div>
      `).join('')}
    </div>
  `
  
  searchResults.style.display = "block"
  
  // Setup search result button handlers
  setupSearchResultListeners()
}

function setupSearchResultListeners() {
  // Chat button (existing conversation)
  const chatButtons = document.querySelectorAll(".search-chat-btn")
  chatButtons.forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation()
      const userId = parseInt(btn.dataset.userId)
      const username = btn.dataset.username
      
      // Get conversation ID by fetching friends or conversations
      try {
        const response = await fetch("/friends", { credentials: "include" })
        const friends = await response.json()
        const friend = friends.find(f => f.friend_id === userId)
        
        if (friend && friend.conversation_id) {
          state.ACTIVE_CONVERSATION_ID = friend.conversation_id
          state.ACTIVE_CHAT_OTHER_USER_ID = friend.friend_id  // Store other user ID for profile viewing
          state.CAME_FROM_FRIENDS = true
          dom.pageTitle().innerText = friend.display_name
          renderChatView()
        }
      } catch (error) {
        console.error("[DEBUG friends] Error opening chat:", error)
        alert("Failed to open chat")
      }
    }
  })
  
  // Start chat button (new conversation)
  const startChatButtons = document.querySelectorAll(".search-start-chat-btn")
  startChatButtons.forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation()
      const userId = parseInt(btn.dataset.userId)
      const username = btn.dataset.username
      
      try {
        const response = await fetch("/start-conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ user_id: userId })
        })
        
        if (!response.ok) {
          throw new Error("Failed to start conversation")
        }
        
        const data = await response.json()
        
        if (data.success && data.conversation_id) {
          state.ACTIVE_CONVERSATION_ID = data.conversation_id
          state.CAME_FROM_FRIENDS = true
          dom.pageTitle().innerText = username
          renderChatView()
        }
      } catch (error) {
        console.error("[DEBUG friends] Error starting conversation:", error)
        alert("Failed to start conversation")
      }
    }
  })
}

function setupFriendListeners() {
  // Chat button handlers
  const chatButtons = document.querySelectorAll(".friend-chat-btn")
  chatButtons.forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation()
      const conversationId = parseInt(btn.dataset.conversationId)
      const friendName = btn.dataset.friendName
      const friendId = parseInt(btn.dataset.friendId) || null
      
      if (conversationId) {
        state.ACTIVE_CONVERSATION_ID = conversationId
        state.ACTIVE_CHAT_OTHER_USER_ID = friendId  // Store other user ID for profile viewing
        state.CAME_FROM_FRIENDS = true // Track that we came from friends
        // Set page title before rendering chat view
        dom.pageTitle().innerText = friendName
        // Small delay to ensure title is set
        setTimeout(() => {
          renderChatView()
        }, 0)
      }
    }
  })
  
  // Delete button handlers
  const deleteButtons = document.querySelectorAll(".friend-delete-btn")
  deleteButtons.forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation()
      const friendId = parseInt(btn.dataset.friendId)
      
      if (!confirm(`Are you sure you want to remove this friend from your list?`)) {
        return
      }
      
      try {
        const response = await fetch(`/friends/${friendId}`, {
          method: "DELETE",
          credentials: "include"
        })
        
        if (response.ok) {
          // Remove friend from list
          const friendItem = btn.closest(".friend-item")
          if (friendItem) {
            friendItem.style.opacity = "0"
            friendItem.style.transform = "translateX(-20px)"
            setTimeout(() => {
              friendItem.remove()
              // If no friends left, show empty state
              const friendsList = document.querySelector(".friends-list")
              if (friendsList && friendsList.children.length === 0) {
                renderFriends()
              }
            }, 300)
          }
        } else {
          alert("Failed to remove friend. Please try again.")
        }
      } catch (error) {
        console.error("[DEBUG friends] Error deleting friend:", error)
        alert("Failed to remove friend. Please try again.")
      }
    }
  })
}

