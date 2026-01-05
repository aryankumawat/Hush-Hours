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
  
  // For friends tab, completely bypass ALL animations - no fade, no transitions
  if (tab === "friends") {
    if (content) {
      // Remove ALL animation classes
      content.classList.remove("fade-out", "fade-in", "content-slide-up")
      // Set visibility immediately with no transitions
      content.style.cssText = `
        opacity: 1 !important;
        transform: none !important;
        display: block !important;
        visibility: visible !important;
        transition: none !important;
      `
    }
    // Render immediately - no delays, no animations
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
    // For friends tab, NO animations at all - just ensure visibility
    if (tab === "friends") {
      content.style.cssText = `
        opacity: 1 !important;
        transform: none !important;
        display: block !important;
        visibility: visible !important;
        transition: none !important;
      `
    } else {
      // For other tabs, use normal styles
      content.style.opacity = "1"
      content.style.transform = "translateY(0)"
      content.style.display = ""
      content.style.visibility = "visible"
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
      // Force content to be visible with maximum priority and disable transitions
      if (content) {
        content.classList.remove("fade-out", "fade-in", "content-slide-up")
        content.style.cssText = `
          opacity: 1 !important;
          transform: translateY(0) !important;
          display: block !important;
          visibility: visible !important;
          transition: none !important;
        `
        // Force immediate style application
        void content.offsetHeight
      }
      // NO ANIMATIONS - just render friends immediately
      renderFriends()
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
