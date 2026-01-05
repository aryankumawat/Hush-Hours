import { renderChats } from "./chats.js"
import { renderProfile } from "./profile.js"
import { renderFriends } from "./friends.js"
import { renderSettings } from "./settings.js"
import { renderGroups } from "./groups.js"
import { dom } from "../utils/dom.js"
import { state } from "../state.js"

const navItems = document.querySelectorAll(".nav-item")

export function initNavigation() {
    navItems.forEach(item => {
    item.onclick = () => {
        navItems.forEach(i => i.classList.remove("active"))
        item.classList.add("active")
        showTab(item.dataset.tab)
        }
    })
}

// Helper function to remove create group button
function removeCreateGroupButton() {
  const pageHeader = document.querySelector(".page-header")
  if (pageHeader) {
    const existingBtn = pageHeader.querySelector(".create-group-header-btn")
    if (existingBtn) {
      existingBtn.remove()
    }
  }
}

export function showTab(tab) {
  const topBar = dom.topBar()
  const pageHeader = document.querySelector(".page-header")
  const content = dom.content()
  
  // Update active nav item with animation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active')
    if (item.dataset.tab === tab) {
      // Add bounce animation when activating
      item.style.animation = "bounce 0.4s ease-out"
      setTimeout(() => {
        item.style.animation = ""
      }, 400)
      item.classList.add('active')
    }
  })
  
  // Add/remove back button based on current tab
  updateBackButton(tab)
  
  // For friends tab, ensure content is visible before rendering
  if (tab === "friends") {
    if (content) {
      // Remove all animation classes and ensure visibility
      content.classList.remove("fade-out", "fade-in", "content-slide-up")
      content.style.opacity = "1"
      content.style.transform = "translateY(0)"
      content.style.display = "block"
      // Set a temporary loading state to prevent empty content
      if (!content.innerHTML.trim()) {
        content.innerHTML = '<div style="padding: 20px; text-align: center;">Loading friends...</div>'
      }
    }
    renderTabContent(tab, content, topBar)
    return
  }
  
  // For other tabs, use fade-out transition
  if (content && content.innerHTML.trim() !== "" && !content.classList.contains("fade-out")) {
    content.classList.add("fade-out")
    // Wait for fade out, then change content
    setTimeout(() => {
      renderTabContent(tab, content, topBar)
    }, 150)
  } else {
    // No existing content or already fading, render immediately
    if (content) {
      content.classList.remove("fade-out")
      content.style.opacity = "1"
    }
    renderTabContent(tab, content, topBar)
  }
}

function renderTabContent(tab, content, topBar) {
  // Remove fade-out class immediately to ensure content is visible
  if (content) {
    content.classList.remove("fade-out", "fade-in", "content-slide-up")
    // Force content to be visible before rendering
    content.style.opacity = "1"
    content.style.transform = "translateY(0)"
    content.style.display = "" // Ensure display is not none
    content.style.visibility = "visible"
    // For friends tab specifically, prevent any fade-out
    if (tab === "friends") {
      // Use a MutationObserver to prevent fade-out class from being added
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            if (content.classList.contains('fade-out')) {
              content.classList.remove('fade-out')
              content.style.opacity = "1"
              content.style.visibility = "visible"
            }
          }
        })
      })
      observer.observe(content, { attributes: true, attributeFilter: ['class'] })
      // Store observer to clean up later if needed
      if (!content._friendsObserver) {
        content._friendsObserver = observer
      }
    }
  }
  
  // Render content
    if (tab === "chats") {
      // Show top bar only for chats
      if (topBar) {
        topBar.style.display = "flex"
      }
      dom.pageTitle().innerText = "My Chats"
      // Clear active conversation/group when going to chats list
      state.ACTIVE_CONVERSATION_ID = null
      state.ACTIVE_GROUP_ID = null
      // Always refresh chats when switching to chats tab
      renderChats()
      // Fade in new content
      if (content) {
        setTimeout(() => {
          content.classList.remove("fade-out")
          content.classList.add("fade-in", "content-slide-up")
        }, 50)
      }
      return
    }

    if (tab === "groups") {
      // Show top bar is hidden for groups page (it's handled in renderGroups)
      if (topBar) {
        topBar.style.display = "none"
      }
      dom.pageTitle().innerText = "Groups"
      // Clear active group when going to groups list
      state.ACTIVE_GROUP_ID = null
      renderGroups()
      // Fade in new content
      if (content) {
        setTimeout(() => {
          content.classList.remove("fade-out")
          content.classList.add("fade-in", "content-slide-up")
        }, 50)
      }
      return
    }

    // Hide top bar for all other tabs
    if (topBar) {
      topBar.style.display = "none"
    }

    if (tab === "avatar") {
      dom.pageTitle().innerText = "Profile"
      // Store previous context before clearing (for back button)
      state.PROFILE_VIEW_PREVIOUS_CONVERSATION_ID = state.ACTIVE_CONVERSATION_ID
      state.PROFILE_VIEW_PREVIOUS_GROUP_ID = state.ACTIVE_GROUP_ID
      state.PROFILE_VIEW_PREVIOUS_PAGE_TITLE = dom.pageTitle()?.innerText || null
      // Clear active conversation/group when going to profile
      state.ACTIVE_CONVERSATION_ID = null
      state.ACTIVE_GROUP_ID = null
      renderProfile()
      // Fade in new content
      if (content) {
        setTimeout(() => {
          content.classList.remove("fade-out")
          content.classList.add("fade-in", "content-slide-up")
        }, 50)
      }
      return
    }

    if (tab === "friends") {
      dom.pageTitle().innerText = "Friends"
      // Clear active conversation when going to friends
      state.ACTIVE_CONVERSATION_ID = null
      // Ensure content is visible before async call
      if (content) {
        content.style.opacity = "1"
        content.style.transform = "translateY(0)"
        content.style.display = "block"
        content.classList.remove("fade-out")
      }
      // Render friends
      renderFriends().then(() => {
        // Ensure content remains visible after rendering
        if (content) {
          requestAnimationFrame(() => {
            content.style.opacity = "1"
            content.style.transform = "translateY(0)"
            content.style.display = "block"
            content.classList.remove("fade-out")
            content.classList.add("fade-in", "content-slide-up")
          })
        }
      }).catch((error) => {
        console.error("[DEBUG navigation] Error rendering friends:", error)
        // Even on error, ensure content is visible
        if (content) {
          content.style.opacity = "1"
          content.style.transform = "translateY(0)"
          content.style.display = "block"
          content.classList.remove("fade-out")
        }
      })
      return
    }

    if (tab === "settings") {
      dom.pageTitle().innerText = "Settings"
      renderSettings()
      // Fade in new content
      if (content) {
        setTimeout(() => {
          content.classList.remove("fade-out")
          content.classList.add("fade-in", "content-slide-up")
        }, 50)
      }
      return
    }
    
    // Fade in new content for all tabs
    if (content) {
      requestAnimationFrame(() => {
        content.classList.add("fade-in", "content-slide-up")
      })
    }
}

// Function to add/remove back button in page header
function updateBackButton(currentTab) {
  const pageHeader = document.querySelector(".page-header")
  if (!pageHeader) return
  
  // Remove existing back button if any
  const existingBackButton = pageHeader.querySelector(".back-button")
  if (existingBackButton) {
    existingBackButton.remove()
  }
  
  // Add back button for all tabs except "chats" (homepage)
  if (currentTab !== "chats") {
    const backButton = document.createElement("button")
    backButton.className = "back-button"
    backButton.innerHTML = '<i class="fa-solid fa-arrow-left"></i>'
    backButton.title = "Back to Chats"
    backButton.onclick = () => {
      showTab("chats")
    }
    
    // Insert at the beginning of page header
    pageHeader.insertBefore(backButton, pageHeader.firstChild)
  }
}
