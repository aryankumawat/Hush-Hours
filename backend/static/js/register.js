var registerData = {
    username: "",
    display_name: "",
    password: "",
    gender: "",
    age: 18,
    avatar: "panther.png"
}

var navState = {
  current: "screen_choice",
  history: ["screen_choice"]
}

function $(id) {
  return document.getElementById(id)
}


var screens = document.querySelectorAll(".screen")      // collect all screens

var avatarOptions = document.querySelectorAll(".avatar_option")
var confirmAvatarBtn = document.getElementById("confirm_avatar")
var avatarList = document.querySelector(".avatar_list")
var avatarScrollTimeout = null


function show_screen(id, goingBack = false) {
  for (var i = 0; i < screens.length; i++) {
    screens[i].style.display = "none"
  }

  var target = document.getElementById(id)
  if (!target) return

  target.style.display = "flex"

  if (!goingBack && navState.history[navState.history.length - 1] !== id) {
    navState.history.push(id)
  }

  navState.current = id
}


function go_back() {
  if (navState.history.length > 1) {
    navState.history.pop()
    show_screen(navState.history[navState.history.length - 1], true)
  }
}


document.addEventListener("click", function (e) {
  if (e.target.matches("[data-action='back']")) {
    go_back()
  }
})


// forward navigation handlers

document.getElementById("go_login").onclick = function () {
  show_screen("screen_login")
}

document.getElementById("go_register").onclick = function () {
  show_screen("screen_username")
}


document.getElementById("next_to_password").onclick = function () {
    registerData.username = $("username").value
    registerData.display_name = $("display_name").value
  
    show_screen("screen_password")
}

document.getElementById("next_to_gender").onclick = function () {
    registerData.password = $("password").value
    show_screen("screen_gender")
}

document.getElementById("finish_register").onclick = function () {
  show_screen("screen_avatar")
}


// gender selection logic
var genderButtons = document.querySelectorAll(".gender_btn")
var nextToAgeButton = document.getElementById("next_to_age")

for (var i = 0; i < genderButtons.length; i++) {
  genderButtons[i].onclick = function () {
    for (var j = 0; j < genderButtons.length; j++) {
      genderButtons[j].classList.remove("selected")
    }

    this.classList.add("selected")
    // Try both data-gender and data_gender for compatibility
    registerData.gender = this.getAttribute("data-gender") || this.getAttribute("data_gender")

    nextToAgeButton.disabled = false
  }
}

nextToAgeButton.onclick = function () {
    show_screen("screen_age")
}

// age slider logic
var ageSlider = $("age")
var ageValue = $("age_value")

ageSlider.oninput = function () {
    ageValue.innerText = ageSlider.value
    registerData.age = ageSlider.value
}





// ----- Avatar carousel logic -----

function setActiveAvatar(index) {
  if (!avatarOptions[index]) return

  // clear previous selected state (we keep transforms handled separately)
  for (var i = 0; i < avatarOptions.length; i++) {
    avatarOptions[i].classList.remove("selected")
  }

  var centerEl = avatarOptions[index]
  centerEl.classList.add("selected")

  registerData.avatar = centerEl.getAttribute("data_avatar")
  confirmAvatarBtn.disabled = false
}

function updateAvatarVisuals() {
  if (!avatarList || avatarOptions.length === 0) return

  var containerRect = avatarList.getBoundingClientRect()
  var containerCenter = containerRect.left + containerRect.width / 2

  var maxScale = 1.6
  var minScale = 0.7
  var maxOpacity = 1.0
  var minOpacity = 0.3

  // distance at which the avatar is considered "far" from the center
  var maxDistance = containerRect.width / 2

  for (var i = 0; i < avatarOptions.length; i++) {
    var rect = avatarOptions[i].getBoundingClientRect()
    var elCenter = rect.left + rect.width / 2
    var distance = Math.abs(containerCenter - elCenter)

    var ratio = Math.min(distance / maxDistance, 1) // 0 (center) -> 1 (far)
    var scale = maxScale - (maxScale - minScale) * ratio
    var opacity = maxOpacity - (maxOpacity - minOpacity) * ratio

    avatarOptions[i].style.transform = "scale(" + scale + ")"
    avatarOptions[i].style.opacity = opacity
  }
}

function snapToAvatar(index, smooth) {
  if (!avatarList || !avatarOptions[index]) return

  var el = avatarOptions[index]
  var target =
    el.offsetLeft - (avatarList.clientWidth / 2 - el.offsetWidth / 2)

  avatarList.scrollTo({
    left: target,
    behavior: smooth ? "smooth" : "auto"
  })

  setActiveAvatar(index)
  updateAvatarVisuals()
}

function findClosestAvatarIndex() {
  if (!avatarList || avatarOptions.length === 0) return 0

  var containerRect = avatarList.getBoundingClientRect()
  var containerCenter = containerRect.left + containerRect.width / 2

  var closestIndex = 0
  var closestDistance = Infinity

  for (var i = 0; i < avatarOptions.length; i++) {
    var rect = avatarOptions[i].getBoundingClientRect()
    var elCenter = rect.left + rect.width / 2
    var distance = Math.abs(containerCenter - elCenter)

    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = i
    }
  }

  return closestIndex
}

// click to center & select
for (var i = 0; i < avatarOptions.length; i++) {
  (function (idx) {
    avatarOptions[idx].onclick = function () {
      snapToAvatar(idx, true)
    }
  })(i)
}

// scroll snapping behaviour
if (avatarList) {
  avatarList.addEventListener("scroll", function () {
    // continuously update scale/opacity while scrolling
    updateAvatarVisuals()

    if (avatarScrollTimeout) {
      clearTimeout(avatarScrollTimeout)
    }

    avatarScrollTimeout = setTimeout(function () {
      var index = findClosestAvatarIndex()
      snapToAvatar(index, true)
    }, 80)
  })
  
  // initialize visuals on load (in case avatar screen is visible)
  setTimeout(function () {
    updateAvatarVisuals()
  }, 0)
}


document.getElementById("confirm_avatar").onclick = function () {
  if (!registerData.avatar) {
    alert("Please select an avatar")
    return
  }

  const confirmBtn = document.getElementById("confirm_avatar")
  const originalText = confirmBtn.innerHTML
  
  // Show loading state
  confirmBtn.disabled = true
  confirmBtn.classList.add("button-loading")
  confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...'

  // Show loading overlay
  showLoadingOverlay("Creating your account...")

  // Debug: Log registration data before sending
  console.log("[DEBUG register] Sending registration data:", registerData)

  fetch("/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",  // Include cookies for session
    body: JSON.stringify(registerData)
  })
  .then(function (response) {
    return response.json()
  })
  .then(function (data) {
    if (data.success) {
      // Success animation
      hideLoadingOverlay()
      showSuccessAnimation()
      
      // Small delay before redirect for animation
      setTimeout(function() {
        window.location.href = "/app"
      }, 800)
    } else {
      hideLoadingOverlay()
      confirmBtn.disabled = false
      confirmBtn.classList.remove("button-loading")
      confirmBtn.innerHTML = originalText
      alert(data.error || "Registration failed")
    }
  })
  .catch(function (error) {
    hideLoadingOverlay()
    confirmBtn.disabled = false
    confirmBtn.classList.remove("button-loading")
    confirmBtn.innerHTML = originalText
    alert("Server error. Please try again.")
    console.error(error)
  })
}


document.getElementById("login_submit").onclick = function () {
  var username = document.getElementById("login_username").value
  var password = document.getElementById("login_password").value

  if (!username || !password) {
    alert("Please enter username and password")
    return
  }

  const loginBtn = document.getElementById("login_submit")
  const originalText = loginBtn.innerHTML
  
  // Show loading state
  loginBtn.disabled = true
  loginBtn.classList.add("button-loading")
  loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...'

  // Show loading overlay
  showLoadingOverlay("Logging in...")

  fetch("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials:"include",
    body: JSON.stringify({
      username: username,
      password: password
    })
  })
  .then(function (response) {
    return response.json()
  })
  .then(function (data) {
    if (data.success) {
      // Success animation
      hideLoadingOverlay()
      showSuccessAnimation()
      
      // Small delay before redirect for animation
      setTimeout(function() {
        window.location.href = "/app"
      }, 800)
    } else {
      hideLoadingOverlay()
      loginBtn.disabled = false
      loginBtn.classList.remove("button-loading")
      loginBtn.innerHTML = originalText
      // Shake animation for error
      document.getElementById("screen_login").classList.add("shake")
      setTimeout(function() {
        document.getElementById("screen_login").classList.remove("shake")
      }, 500)
      alert(data.error || "Invalid username or password")
    }
  })
  .catch(function () {
    hideLoadingOverlay()
    loginBtn.disabled = false
    loginBtn.classList.remove("button-loading")
    loginBtn.innerHTML = originalText
    alert("Server error. Please try again.")
  })
}


// Loading overlay functions
function showLoadingOverlay(text) {
  // Remove existing overlay if any
  const existing = document.getElementById("loading-overlay")
  if (existing) {
    existing.remove()
  }
  
  const overlay = document.createElement("div")
  overlay.id = "loading-overlay"
  overlay.className = "loading-overlay"
  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-overlay-text">${text || "Loading..."}</div>
  `
  document.body.appendChild(overlay)
}

function hideLoadingOverlay() {
  const overlay = document.getElementById("loading-overlay")
  if (overlay) {
    overlay.style.animation = "fadeOut 0.3s ease-out"
    setTimeout(function() {
      overlay.remove()
    }, 300)
  }
}

function showSuccessAnimation() {
  const overlay = document.createElement("div")
  overlay.id = "success-overlay"
  overlay.className = "loading-overlay"
  overlay.style.background = "rgba(34, 197, 94, 0.9)"
  overlay.innerHTML = `
    <div style="width: 80px; height: 80px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; animation: scaleIn 0.3s ease-out;">
      <i class="fa-solid fa-check" style="font-size: 40px; color: #22c55e; animation: checkmark-animation 0.5s ease-out;"></i>
    </div>
    <div class="loading-overlay-text">Success!</div>
  `
  document.body.appendChild(overlay)
  
  setTimeout(function() {
    overlay.style.animation = "fadeOut 0.3s ease-out"
    setTimeout(function() {
      overlay.remove()
    }, 300)
  }, 600)
}

// initial screen
show_screen("screen_choice")

